const supabase = require('../config/db');
const { hashPassword } = require('../utils/hash');
const { sanitizeObject, validateRequired, validateEmail, validatePhone, validateLevel } = require('../utils/validate');
const { getCurrentMonth } = require('../utils/format');
const emailService = require('../services/email.service');
const jwt = require('jsonwebtoken');
const { hashToken } = require('../middleware/auth');
const crypto = require('crypto');

// ── Dashboard Stats ────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [students, teachers, courses, payments, attendance, requests] = await Promise.all([
      supabase.from('students').select('id, level, status, enrollment_date', { count: 'exact' }).eq('status', 'active'),
      supabase.from('teachers').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('courses').select('id, status', { count: 'exact' }),
      supabase.from('payments').select('id, status').eq('month', getCurrentMonth()),
      supabase.from('attendance').select('id, status').eq('session_date', new Date().toISOString().split('T')[0]),
      supabase.from('requests').select('id', { count: 'exact' }).eq('status', 'pending')
    ]);

    const unpaid = payments.data ? payments.data.filter(p => p.status === 'unpaid').length : 0;
    const todayPresent = attendance.data ? attendance.data.filter(a => a.status === 'present').length : 0;
    const todayTotal = attendance.data ? attendance.data.length : 0;

    res.json({
      total_students: students.count || 0,
      total_teachers: teachers.count || 0,
      total_courses: courses.count || 0,
      open_courses: courses.data ? courses.data.filter(c => c.status === 'open').length : 0,
      unpaid_this_month: unpaid,
      today_attendance_rate: todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0,
      pending_requests: requests.count || 0
    });
  } catch (err) {
    next(err);
  }
};

// ── Students CRUD ──────────────────────────────────
exports.getStudents = async (req, res, next) => {
  try {
    const { course_id, teacher_id, status, payment_status, level, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('students')
      .select('*, courses(name, price), teachers(full_name)', { count: 'exact' });

    if (course_id) query = query.eq('course_id', course_id);
    if (teacher_id) query = query.eq('teacher_id', teacher_id);
    if (status) query = query.eq('status', status);
    if (level) query = query.eq('level', level);
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, count, error } = await query;
    if (error) throw error;

    let students = data || [];

    if (payment_status) {
      const month = getCurrentMonth();
      const { data: pmts } = await supabase.from('payments').select('student_id, status').eq('month', month);
      const paidIds = new Set((pmts || []).filter(p => p.status === 'paid').map(p => p.student_id));
      if (payment_status === 'paid') {
        students = students.filter(s => paidIds.has(s.id));
      } else if (payment_status === 'unpaid') {
        students = students.filter(s => !paidIds.has(s.id));
      }
    }

    res.json({
      students,
      total: count || 0,
      page: Number(page),
      pages: Math.ceil((count || 0) / limit)
    });
  } catch (err) {
    next(err);
  }
};

exports.getStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [studentRes, attendanceRes, paymentsRes, notesRes] = await Promise.all([
      supabase.from('students').select('*, courses(name, price, subject), teachers(full_name)').eq('id', id).single(),
      supabase.from('attendance').select('*').eq('student_id', id).order('session_date', { ascending: false }).limit(50),
      supabase.from('payments').select('*').eq('student_id', id).order('month', { ascending: false }),
      supabase.from('teacher_notes').select('*, teachers(full_name)').eq('student_id', id).order('created_at', { ascending: false })
    ]);

    if (studentRes.error) return res.status(404).json({ error: 'التلميذ غير موجود' });

    const att = attendanceRes.data || [];
    const total = att.length;
    const present = att.filter(a => a.status === 'present').length;

    res.json({
      student: studentRes.data,
      attendance_summary: {
        total,
        present,
        absent: att.filter(a => a.status === 'absent').length,
        late: att.filter(a => a.status === 'late').length,
        excused: att.filter(a => a.status === 'excused').length,
        rate: total > 0 ? Math.round((present / total) * 100) : 0
      },
      payments: paymentsRes.data || [],
      notes: notesRes.data || []
    });
  } catch (err) {
    next(err);
  }
};

exports.createStudent = async (req, res, next) => {
  try {
    const body = sanitizeObject(req.body);
    const reqErr = validateRequired(['first_name', 'last_name', 'phone', 'level'], body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const levelErr = validateLevel(body.level);
    if (levelErr) return res.status(400).json({ error: levelErr });
    if (body.email) {
      const emailErr = validateEmail(body.email);
      if (emailErr) return res.status(400).json({ error: emailErr });
    }
    const phoneErr = validatePhone(body.phone);
    if (phoneErr) return res.status(400).json({ error: phoneErr });

    const username = `${body.first_name.toLowerCase()}.${body.last_name.toLowerCase()}`.replace(/\s/g, '');
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPw = await hashPassword(tempPassword);

    let teacherId = null;
    if (body.course_id) {
      const { data: course } = await supabase.from('courses').select('teacher_id, enrolled_count, capacity, status').eq('id', body.course_id).single();
      if (course) {
        if (course.status === 'full') return res.status(400).json({ error: 'الدورة ممتلئة' });
        teacherId = course.teacher_id;
      }
    }

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        username,
        password_hash: hashedPw,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
        parent_phone: body.parent_phone || null,
        email: body.email || null,
        level: body.level,
        course_id: body.course_id || null,
        teacher_id: teacherId
      })
      .select()
      .single();

    if (error) throw error;

    if (body.course_id) {
      await supabase.rpc('increment_enrolled', { cid: body.course_id });
    }

    await logAudit(req, 'create_student', 'student', student.id, { student_name: `${body.first_name} ${body.last_name}` });

    res.status(201).json({ student, credentials: { username, password: tempPassword } });
  } catch (err) {
    next(err);
  }
};

exports.updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = sanitizeObject(req.body);
    delete body.password;
    delete body.username;

    body.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('students')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logAudit(req, 'update_student', 'student', id, body);
    res.json({ student: data });
  } catch (err) {
    next(err);
  }
};

exports.deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data: student } = await supabase.from('students').select('first_name, last_name, course_id').eq('id', id).single();

    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;

    if (student && student.course_id) {
      await supabase.rpc('decrement_enrolled', { cid: student.course_id });
    }

    await logAudit(req, 'delete_student', 'student', id, { reason, student_name: student ? `${student.first_name} ${student.last_name}` : '' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.updateStudentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['active', 'suspended', 'expelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة' });
    }

    const { data, error } = await supabase
      .from('students')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (status === 'suspended' || status === 'expelled') {
      await emailService.sendSuspensionNotification(data, reason || 'لم يُحدد سبب');
    }

    await logAudit(req, `${status}_student`, 'student', id, { reason });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.approveStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !student) return res.status(404).json({ error: 'التلميذ غير موجود' });
    if (student.status !== 'pending') return res.status(400).json({ error: 'التلميذ ليس في حالة انتظار' });

    const username = `${student.first_name.toLowerCase()}.${student.last_name.toLowerCase()}`.replace(/\s/g, '');
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPw = await hashPassword(tempPassword);

    const { error: updateErr } = await supabase
      .from('students')
      .update({
        username,
        password_hash: hashedPw,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    if (student.email) {
      try {
        const { sendEmail } = require('../config/email');
        await sendEmail({
          to: student.email,
          subject: 'تم قبول طلب تسجيلك - بيانات الدخول',
          html: `
            <div dir="rtl" style="font-family:Arial,sans-serif;padding:20px">
              <h2 style="color:#2d6a9f">مرحباً ${student.first_name} ${student.last_name}</h2>
              <p>تم قبول طلب تسجيلك في منصة المدرسة. يمكنك الآن تسجيل الدخول باستخدام البيانات التالية:</p>
              <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0">
                <p><strong>اسم المستخدم:</strong> ${username}</p>
                <p><strong>كلمة المرور:</strong> ${tempPassword}</p>
              </div>
              <p style="color:#e74c3c">يُرجى تغيير كلمة المرور بعد أول تسجيل دخول.</p>
            </div>
          `
        });
      } catch (_) { /* email not configured — credentials shown in response instead */ }
    }

    await supabase.from('notifications').insert({
      to_role: 'student',
      to_id: id,
      type: 'registration_approved',
      title: 'تم قبول طلبك',
      message: 'تم قبول طلب تسجيلك. يمكنك الآن تسجيل الدخول.'
    });

    await logAudit(req, 'approve_student', 'student', id, { student_name: `${student.first_name} ${student.last_name}` });
    res.json({ success: true, credentials: { username, password: tempPassword } });
  } catch (err) {
    next(err);
  }
};

exports.changeStudentCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_course_id } = req.body;

    const { data: student } = await supabase.from('students').select('course_id').eq('id', id).single();
    if (!student) return res.status(404).json({ error: 'التلميذ غير موجود' });

    const { data: newCourse } = await supabase.from('courses').select('teacher_id, enrolled_count, capacity, status').eq('id', new_course_id).single();
    if (!newCourse) return res.status(404).json({ error: 'الدورة غير موجودة' });
    if (newCourse.status === 'full') return res.status(400).json({ error: 'الدورة ممتلئة' });

    if (student.course_id) {
      await supabase.rpc('decrement_enrolled', { cid: student.course_id });
    }
    await supabase.rpc('increment_enrolled', { cid: new_course_id });

    const { error } = await supabase
      .from('students')
      .update({ course_id: new_course_id, teacher_id: newCourse.teacher_id, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    await logAudit(req, 'change_course', 'student', id, { old_course: student.course_id, new_course: new_course_id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── Teachers CRUD ──────────────────────────────────
exports.getTeachers = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ teachers: data || [] });
  } catch (err) {
    next(err);
  }
};

exports.getTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [teacherRes, coursesRes, scheduleRes] = await Promise.all([
      supabase.from('teachers').select('*').eq('id', id).single(),
      supabase.from('courses').select('*, students(id)').eq('teacher_id', id),
      supabase.from('sessions').select('*').eq('teacher_id', id)
    ]);

    if (teacherRes.error) return res.status(404).json({ error: 'الأستاذ غير موجود' });

    const courses = coursesRes.data || [];
    const studentsCount = courses.reduce((sum, c) => sum + (c.students ? c.students.length : 0), 0);

    res.json({
      teacher: teacherRes.data,
      courses: courses.map(c => { const { students, ...rest } = c; return rest; }),
      students_count: studentsCount,
      schedule: scheduleRes.data || []
    });
  } catch (err) {
    next(err);
  }
};

exports.createTeacher = async (req, res, next) => {
  try {
    const body = sanitizeObject(req.body);
    const reqErr = validateRequired(['full_name', 'email', 'username', 'password'], body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const emailErr = validateEmail(body.email);
    if (emailErr) return res.status(400).json({ error: emailErr });

    const hashedPw = await hashPassword(body.password);

    const { data, error } = await supabase
      .from('teachers')
      .insert({
        username: body.username,
        password_hash: hashedPw,
        full_name: body.full_name,
        email: body.email,
        phone: body.phone || null,
        subject: body.subject || null,
        notes: body.notes || null
      })
      .select()
      .single();

    if (error) throw error;
    await logAudit(req, 'create_teacher', 'teacher', data.id, { teacher_name: body.full_name });
    res.status(201).json({ teacher: data });
  } catch (err) {
    next(err);
  }
};

exports.updateTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = sanitizeObject(req.body);
    if (body.password) {
      body.password = await hashPassword(body.password);
    }
    body.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('teachers').update(body).eq('id', id).select().single();
    if (error) throw error;
    await logAudit(req, 'update_teacher', 'teacher', id, {});
    res.json({ teacher: data });
  } catch (err) {
    next(err);
  }
};

exports.deleteTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (error) throw error;
    await logAudit(req, 'delete_teacher', 'teacher', id, {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.impersonateTeacher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: teacher, error } = await supabase.from('teachers').select('*').eq('id', id).single();
    if (error || !teacher) return res.status(404).json({ error: 'الأستاذ غير موجود' });

    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { id: teacher.id, role: 'teacher', full_name: teacher.full_name, email: teacher.email, impersonated_by: req.user.id, jti },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    const decoded = jwt.decode(token);
    await supabase.from('auth_tokens').insert({
      user_id: teacher.id,
      user_role: 'teacher',
      token_hash: hashToken(token),
      jti,
      expires_at: new Date(decoded.exp * 1000).toISOString()
    });

    await logAudit(req, 'impersonate_teacher', 'teacher', id, { admin_id: req.user.id });
    res.json({ impersonation_token: token });
  } catch (err) {
    next(err);
  }
};

// ── Courses CRUD ───────────────────────────────────
exports.getCourses = async (req, res, next) => {
  try {
    const { level, status, teacher_id } = req.query;
    let query = supabase.from('courses').select('*, teachers(full_name)').order('created_at', { ascending: false });

    if (level) query = query.eq('level', level);
    if (status) query = query.eq('status', status);
    if (teacher_id) query = query.eq('teacher_id', teacher_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ courses: data || [] });
  } catch (err) {
    next(err);
  }
};

exports.getCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [courseRes, sessionsRes, studentsRes] = await Promise.all([
      supabase.from('courses').select('*, teachers(*)').eq('id', id).single(),
      supabase.from('sessions').select('*').eq('course_id', id),
      supabase.from('students').select('*').eq('course_id', id)
    ]);

    if (courseRes.error) return res.status(404).json({ error: 'الدورة غير موجودة' });

    res.json({
      course: courseRes.data,
      sessions: sessionsRes.data || [],
      students: studentsRes.data || [],
      teacher: courseRes.data.teachers
    });
  } catch (err) {
    next(err);
  }
};

exports.createCourse = async (req, res, next) => {
  try {
    const body = sanitizeObject(req.body);
    const reqErr = validateRequired(['name', 'subject', 'level', 'price', 'capacity'], body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const { data, error } = await supabase
      .from('courses')
      .insert({
        name: body.name,
        subject: body.subject,
        level: body.level,
        price: body.price,
        capacity: body.capacity,
        teacher_id: body.teacher_id || null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        description: body.description || null
      })
      .select()
      .single();

    if (error) throw error;
    await logAudit(req, 'create_course', 'course', data.id, { course_name: body.name });
    res.status(201).json({ course: data });
  } catch (err) {
    next(err);
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = sanitizeObject(req.body);
    body.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('courses').update(body).eq('id', id).select().single();
    if (error) throw error;
    await logAudit(req, 'update_course', 'course', id, {});
    res.json({ course: data });
  } catch (err) {
    next(err);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
    await logAudit(req, 'delete_course', 'course', id, {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.addSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = sanitizeObject(req.body);
    const reqErr = validateRequired(['day_of_week', 'start_time', 'end_time'], body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', id).single();
    if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });

    // Check teacher schedule conflict
    if (course.teacher_id) {
      const { data: conflicts } = await supabase
        .from('sessions')
        .select('*')
        .eq('teacher_id', course.teacher_id)
        .eq('day_of_week', body.day_of_week);

      const hasConflict = (conflicts || []).some(s =>
        (body.start_time < s.end_time && body.end_time > s.start_time)
      );
      if (hasConflict) {
        return res.status(409).json({ error: 'يوجد تعارض في جدول الأستاذ' });
      }
    }

    // Check room conflict
    if (body.room) {
      const { data: roomConflicts } = await supabase
        .from('sessions')
        .select('*')
        .eq('room', body.room)
        .eq('day_of_week', body.day_of_week);

      const hasRoomConflict = (roomConflicts || []).some(s =>
        (body.start_time < s.end_time && body.end_time > s.start_time)
      );
      if (hasRoomConflict) {
        return res.status(409).json({ error: 'القاعة محجوزة في هذا الوقت' });
      }
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        course_id: id,
        teacher_id: course.teacher_id,
        day_of_week: body.day_of_week,
        start_time: body.start_time,
        end_time: body.end_time,
        room: body.room || null
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ session: data });
  } catch (err) {
    next(err);
  }
};

exports.deleteSession = async (req, res, next) => {
  try {
    const { session_id } = req.params;
    const { error } = await supabase.from('sessions').delete().eq('id', session_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── Payments ───────────────────────────────────────
exports.getPayments = async (req, res, next) => {
  try {
    const { month = getCurrentMonth(), course_id, status, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('payments')
      .select('*, students(first_name, last_name, phone), courses(name, price)', { count: 'exact' })
      .eq('month', month);

    if (course_id) query = query.eq('course_id', course_id);
    if (status) query = query.eq('status', status);

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const payments = data || [];
    const totalExpected = payments.reduce((s, p) => s + p.amount, 0);
    const collected = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

    res.json({
      payments,
      summary: { total_expected: totalExpected, collected, remaining: totalExpected - collected },
      total: count || 0,
      page: Number(page),
      pages: Math.ceil((count || 0) / limit)
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['paid', 'unpaid'].includes(status)) {
      return res.status(400).json({ error: 'حالة دفع غير صالحة' });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        status,
        verified_by: req.user.id,
        verified_at: status === 'paid' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, students(first_name, email), courses(name)')
      .single();

    if (error) throw error;

    if (status === 'paid' && data.students && data.students.email) {
      await emailService.sendPaymentConfirmation(data.students, data.courses, data.month);
    }

    await logAudit(req, 'verify_payment', 'payment', id, { status });
    res.json({ payment: data });
  } catch (err) {
    next(err);
  }
};

exports.sendPaymentReminders = async (req, res, next) => {
  try {
    const { student_ids } = req.body;
    const month = getCurrentMonth();

    let query = supabase
      .from('payments')
      .select('*, students(first_name, last_name, email), courses(name, price)')
      .eq('month', month)
      .eq('status', 'unpaid');

    if (student_ids && student_ids.length > 0) {
      query = query.in('student_id', student_ids);
    }

    const { data } = await query;
    let sentCount = 0;

    for (const payment of (data || [])) {
      if (payment.students && payment.students.email) {
        try {
          await emailService.sendPaymentReminder(payment.students, payment.courses, month);
          sentCount++;
        } catch (_) { /* skip failed sends */ }
      }
    }

    res.json({ sent_count: sentCount });
  } catch (err) {
    next(err);
  }
};

// ── Requests ───────────────────────────────────────
exports.getRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('requests')
      .select('*, students:target_student_id(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ requests: data || [] });
  } catch (err) {
    next(err);
  }
};

exports.resolveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, response } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'إجراء غير صالح' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data: request, error } = await supabase
      .from('requests')
      .update({
        status: newStatus,
        response: response || null,
        resolved_by: req.user.id,
        resolved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (request.from_role === 'teacher') {
      const { data: teacher } = await supabase.from('teachers').select('email').eq('id', request.from_id).single();
      if (teacher) {
        await emailService.sendRequestResult(request, teacher, newStatus);
      }
    }

    if (newStatus === 'approved' && request.type === 'expel_request' && request.target_student_id) {
      await supabase
        .from('students')
        .update({ status: 'expelled', updated_at: new Date().toISOString() })
        .eq('id', request.target_student_id);
    }

    await logAudit(req, `${action}_request`, 'request', id, { response });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── Emails ─────────────────────────────────────────
exports.sendEmails = async (req, res, next) => {
  try {
    const { target, subject, message, teacher_ids, student_ids } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'الموضوع والرسالة مطلوبان' });

    let recipients = [];

    if (target === 'all' || target === 'students') {
      const { data } = await supabase.from('students').select('first_name, last_name, email').eq('status', 'active').not('email', 'is', null);
      recipients.push(...(data || []).map(s => ({ email: s.email, name: `${s.first_name} ${s.last_name}` })));
    }
    if (target === 'all' || target === 'teachers') {
      const { data } = await supabase.from('teachers').select('full_name, email').eq('is_active', true);
      recipients.push(...(data || []).map(t => ({ email: t.email, name: t.full_name })));
    }
    if (target === 'specific_students' && student_ids && student_ids.length > 0) {
      const { data } = await supabase.from('students').select('first_name, last_name, email').in('id', student_ids).not('email', 'is', null);
      recipients.push(...(data || []).map(s => ({ email: s.email, name: `${s.first_name} ${s.last_name}` })));
    }
    if (target === 'specific_teachers' && teacher_ids && teacher_ids.length > 0) {
      const { data } = await supabase.from('teachers').select('full_name, email').in('id', teacher_ids);
      recipients.push(...(data || []).map(t => ({ email: t.email, name: t.full_name })));
    }
    if (target === 'course' && req.body.course_id) {
      const { data } = await supabase.from('students').select('first_name, last_name, email').eq('course_id', req.body.course_id).eq('status', 'active').not('email', 'is', null);
      recipients.push(...(data || []).map(s => ({ email: s.email, name: `${s.first_name} ${s.last_name}` })));
    }

    if (recipients.length === 0) return res.status(400).json({ error: 'لا يوجد مستلمين' });

    const results = await emailService.sendBulkEmail({ recipients, subject, message });
    const sentCount = results.filter(r => r.success).length;

    await logAudit(req, 'send_emails', 'email', null, { target, sent_count: sentCount });
    res.json({ sent_count: sentCount, total_recipients: recipients.length });
  } catch (err) {
    next(err);
  }
};

// ── Sessions Schedule ─────────────────────────────
exports.getAllSessions = async (req, res, next) => {
  try {
    const { teacher_id, course_id } = req.query;
    const selectFields = '*, courses(name, level, subject, sessions_per_week), teachers(full_name)';
    const selectFallback = '*, courses(name, level, subject), teachers(full_name)';

    let query = supabase.from('sessions').select(selectFields).order('day_of_week').order('start_time');
    if (teacher_id) query = query.eq('teacher_id', teacher_id);
    if (course_id) query = query.eq('course_id', course_id);

    let { data, error } = await query;

    if (error && error.message && error.message.includes('sessions_per_week')) {
      let q2 = supabase.from('sessions').select(selectFallback).order('day_of_week').order('start_time');
      if (teacher_id) q2 = q2.eq('teacher_id', teacher_id);
      if (course_id) q2 = q2.eq('course_id', course_id);
      ({ data, error } = await q2);
    }

    if (error) throw error;
    res.json({ sessions: data || [] });
  } catch (err) {
    next(err);
  }
};

exports.updateSessionsPerWeek = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sessions_per_week } = req.body;
    if (!sessions_per_week || sessions_per_week < 1 || sessions_per_week > 7) {
      return res.status(400).json({ error: 'عدد الحصص يجب أن يكون بين 1 و 7' });
    }
    const { data, error } = await supabase
      .from('courses')
      .update({ sessions_per_week, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await logAudit(req, 'update_sessions_per_week', 'course', id, { sessions_per_week });
    res.json({ course: data });
  } catch (err) {
    next(err);
  }
};

// ── Admin Accounts ─────────────────────────────────
exports.getAdminAccounts = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('admins').select('id, username, full_name, email, role, permissions, is_active, created_at').order('created_at');
    if (error) throw error;
    res.json({ admins: data || [] });
  } catch (err) {
    next(err);
  }
};

exports.createAdminAccount = async (req, res, next) => {
  try {
    const body = sanitizeObject(req.body);
    const reqErr = validateRequired(['username', 'password', 'full_name', 'email'], body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const hashedPw = await hashPassword(body.password);
    const { data, error } = await supabase
      .from('admins')
      .insert({
        username: body.username,
        password_hash: hashedPw,
        full_name: body.full_name,
        email: body.email,
        role: 'admin',
        permissions: body.permissions || {}
      })
      .select()
      .single();

    if (error) throw error;
    await logAudit(req, 'create_admin', 'admin', data.id, { admin_name: body.full_name });
    res.status(201).json({ admin: data });
  } catch (err) {
    next(err);
  }
};

exports.updateAdminAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = sanitizeObject(req.body);
    if (body.password) { body.password_hash = await hashPassword(body.password); delete body.password; }
    body.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('admins').update(body).eq('id', id).select().single();
    if (error) throw error;
    await logAudit(req, 'update_admin', 'admin', id, {});
    res.json({ admin: data });
  } catch (err) {
    next(err);
  }
};

exports.deleteAdminAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'لا يمكنك حذف حسابك' });
    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (error) throw error;
    await logAudit(req, 'delete_admin', 'admin', id, {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── Audit Log ──────────────────────────────────────
exports.getAuditLog = async (req, res, next) => {
  try {
    const { actor_id, action, target_type, from, to, page = 1 } = req.query;
    const limit = 30;
    const offset = (page - 1) * limit;

    let query = supabase.from('audit_log').select('*', { count: 'exact' }).order('timestamp', { ascending: false });

    if (actor_id) query = query.eq('actor_id', actor_id);
    if (action) query = query.eq('action', action);
    if (target_type) query = query.eq('target_type', target_type);
    if (from) query = query.gte('timestamp', from);
    if (to) query = query.lte('timestamp', to);

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    res.json({ logs: data || [], total: count || 0 });
  } catch (err) {
    next(err);
  }
};

// ── Notifications ──────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('to_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    const unread = (data || []).filter(n => !n.is_read).length;
    res.json({ notifications: data || [], unread_count: unread });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('to_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── Attendance Reports (Admin) ─────────────────────
exports.getAttendanceReports = async (req, res, next) => {
  try {
    const { course_id, from, to, page = 1 } = req.query;
    const limit = 30;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('attendance')
      .select('*, students(first_name, last_name), courses(name)', { count: 'exact' })
      .order('session_date', { ascending: false });

    if (course_id) query = query.eq('course_id', course_id);
    if (from) query = query.gte('session_date', from);
    if (to) query = query.lte('session_date', to);

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    res.json({ attendance: data || [], total: count || 0 });
  } catch (err) {
    next(err);
  }
};

// ── Helper: Audit Log ──────────────────────────────
async function logAudit(req, action, targetType, targetId, details) {
  try {
    await supabase.from('audit_log').insert({
      actor_role: req.user.role,
      actor_id: req.user.id,
      actor_name: req.user.full_name,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: req.ip
    });
  } catch (_) { /* don't fail the main request */ }
}
