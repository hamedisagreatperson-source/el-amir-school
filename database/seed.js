/**
 * Seed Script: Populates the database with demo data
 * - 10 Teachers
 * - 10 Courses (with sessions)
 * - 100 Students (distributed across courses)
 * 
 * Usage: cd school-backend && node ../database/seed.js
 * Requires .env file with SUPABASE_URL and SUPABASE_SERVICE_KEY
 */

const path = require('path');
const nmDir = path.join(__dirname, '..', 'school-backend', 'node_modules');
require(path.join(nmDir, 'dotenv')).config({ path: path.join(__dirname, '..', 'school-backend', '.env') });
const { createClient } = require(path.join(nmDir, '@supabase/supabase-js'));
const bcrypt = require(path.join(nmDir, 'bcryptjs'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ── Arabic Names Pool ──────────────────────────────
const maleFirst = ['أحمد','محمد','يوسف','عمر','إبراهيم','خالد','عبد الله','علي','حسن','مصطفى','أمين','رضا','كريم','سعيد','طارق','فيصل','ياسين','بلال','عادل','نبيل','جمال','وليد','رامي','سمير','هشام','منير','نور الدين','عبد الرحمن','عبد القادر','زكريا'];
const femaleFirst = ['فاطمة','عائشة','مريم','خديجة','سارة','نور','أمينة','إيمان','هاجر','ريم','سلمى','دنيا','إكرام','وفاء','حنان','سناء','نادية','ليلى','زينب','رقية'];
const lastNames = ['بن عمر','بن علي','بوزيد','حدادي','مزياني','بلقاسم','شريف','بن يوسف','خليفي','عمراني','بن حميدة','سعيدي','رحماني','بوعلام','بن مصطفى','طالبي','بن خليل','مرابط','جلولي','بركاني','حمداني','عيساوي','ميلود','قادري','زيتوني','بوعبد الله','معمري','بن ناصر','دراجي','خوجة'];

const subjects = ['الرياضيات','الفيزياء','العلوم الطبيعية','اللغة العربية','اللغة الفرنسية','اللغة الإنجليزية','التاريخ والجغرافيا','التربية الإسلامية','الإعلام الآلي','الفلسفة'];
const levels = ['1AM','2AM','3AM','4AM','1AS','2AS','3AS'];
const days = ['sunday','monday','tuesday','wednesday','thursday'];
const rooms = ['قاعة 1','قاعة 2','قاعة 3','قاعة 4','قاعة 5','قاعة 6','مخبر 1','مخبر 2'];
const timeSlots = [
  { start: '08:00', end: '09:30' },
  { start: '09:30', end: '11:00' },
  { start: '11:00', end: '12:30' },
  { start: '13:00', end: '14:30' },
  { start: '14:30', end: '16:00' },
  { start: '16:00', end: '17:30' },
];

function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomPhone() { return '05' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0'); }

async function seed() {
  console.log('🌱 Starting seed...\n');

  // ── 1. Create 10 Teachers ────────────────────────
  console.log('👨‍🏫 Creating 10 teachers...');
  const teacherData = [];
  const usedTeacherUsernames = new Set();
  
  for (let i = 0; i < 10; i++) {
    const fullName = `${randomPick(maleFirst)} ${randomPick(lastNames)}`;
    let username = `teacher${i + 1}`;
    const password = 'teacher123';
    const hashedPw = await bcrypt.hash(password, 12);
    
    teacherData.push({
      username,
      password_hash: hashedPw,
      full_name: fullName,
      email: `teacher${i + 1}@school.dz`,
      phone: randomPhone(),
      subject: subjects[i],
      is_active: true
    });
  }

  const { data: teachers, error: tErr } = await supabase
    .from('teachers')
    .upsert(teacherData, { onConflict: 'username' })
    .select();
  
  if (tErr) { console.error('Error creating teachers:', tErr.message); return; }
  console.log(`  ✓ Created ${teachers.length} teachers`);

  // ── 2. Create 10 Courses ─────────────────────────
  console.log('📚 Creating 10 courses...');
  const courseNames = [
    'دورة الرياضيات المتقدمة',
    'دورة الفيزياء التطبيقية',
    'دورة العلوم الطبيعية',
    'دورة اللغة العربية والأدب',
    'دورة اللغة الفرنسية',
    'دورة اللغة الإنجليزية',
    'دورة التاريخ والجغرافيا',
    'دورة التربية الإسلامية',
    'دورة الإعلام الآلي',
    'دورة الفلسفة والمنطق'
  ];

  const courseData = courseNames.map((name, i) => ({
    name,
    subject: subjects[i],
    level: levels[i % levels.length],
    teacher_id: teachers[i].id,
    capacity: 15,
    enrolled_count: 0,
    price: 3000 + (i * 500),
    status: 'open',
    description: `${name} - ${levels[i % levels.length]}`
  }));

  // Try with sessions_per_week first, fall back without it
  let courses, cErr;
  const courseDataWithSPW = courseData.map((c, i) => ({ ...c, sessions_per_week: 2 + (i % 3) }));
  ({ data: courses, error: cErr } = await supabase.from('courses').insert(courseDataWithSPW).select());
  
  if (cErr && cErr.message.includes('sessions_per_week')) {
    console.log('  ℹ sessions_per_week column not found, inserting without it');
    ({ data: courses, error: cErr } = await supabase.from('courses').insert(courseData).select());
  }

  if (cErr) { console.error('Error creating courses:', cErr.message); return; }
  console.log(`  ✓ Created ${courses.length} courses`);

  // ── 3. Create Sessions (Timetable) ───────────────
  console.log('📅 Creating sessions (timetable)...');
  const sessionInserts = [];
  const usedSlots = {}; // track teacher+day+time conflicts

  for (const course of courses) {
    const sessionsPerWeek = course.sessions_per_week || 2;
    const usedDays = new Set();
    
    for (let s = 0; s < sessionsPerWeek; s++) {
      let attempts = 0;
      let placed = false;
      
      while (!placed && attempts < 50) {
        const day = days[Math.floor(Math.random() * days.length)];
        const slot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
        const room = rooms[Math.floor(Math.random() * rooms.length)];
        const key = `${course.teacher_id}-${day}-${slot.start}`;
        const roomKey = `${room}-${day}-${slot.start}`;
        
        if (!usedSlots[key] && !usedSlots[roomKey] && !usedDays.has(`${day}-${slot.start}`)) {
          usedSlots[key] = true;
          usedSlots[roomKey] = true;
          usedDays.add(`${day}-${slot.start}`);
          
          sessionInserts.push({
            course_id: course.id,
            teacher_id: course.teacher_id,
            day_of_week: day,
            start_time: slot.start,
            end_time: slot.end,
            room
          });
          placed = true;
        }
        attempts++;
      }
    }
  }

  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .insert(sessionInserts)
    .select();

  if (sErr) { console.error('Error creating sessions:', sErr.message); return; }
  console.log(`  ✓ Created ${sessions.length} sessions`);

  // ── 4. Create 100 Students ───────────────────────
  console.log('🎓 Creating 100 students...');
  const allFirstNames = [...maleFirst, ...femaleFirst];
  const studentData = [];
  const usedUsernames = new Set();

  for (let i = 0; i < 100; i++) {
    const firstName = allFirstNames[i % allFirstNames.length];
    const lastName = lastNames[i % lastNames.length];
    let username = `${firstName}.${lastName}`.replace(/\s/g, '_').toLowerCase();
    
    // Ensure unique username
    let suffix = 0;
    let finalUsername = username;
    while (usedUsernames.has(finalUsername)) {
      suffix++;
      finalUsername = `${username}${suffix}`;
    }
    usedUsernames.add(finalUsername);

    const courseIndex = i % courses.length;
    const hashedPw = await bcrypt.hash('student123', 12);

    studentData.push({
      username: finalUsername,
      password_hash: hashedPw,
      first_name: firstName,
      last_name: lastName,
      phone: randomPhone(),
      parent_phone: randomPhone(),
      email: `student${i + 1}@school.dz`,
      level: courses[courseIndex].level,
      course_id: courses[courseIndex].id,
      teacher_id: courses[courseIndex].teacher_id,
      status: 'active',
      enrollment_date: '2025-09-01'
    });
  }

  // Insert in batches of 25 to avoid timeout
  let totalStudents = 0;
  for (let b = 0; b < studentData.length; b += 25) {
    const batch = studentData.slice(b, b + 25);
    const { data: inserted, error: bErr } = await supabase
      .from('students')
      .insert(batch)
      .select();
    
    if (bErr) { console.error(`Error in student batch ${b / 25 + 1}:`, bErr.message); continue; }
    totalStudents += inserted.length;
    process.stdout.write(`  ✓ ${totalStudents}/100 students\r`);
  }
  console.log(`  ✓ Created ${totalStudents} students          `);

  // ── 5. Update enrolled counts ────────────────────
  console.log('📊 Updating course enrollment counts...');
  for (const course of courses) {
    const { count } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', course.id)
      .eq('status', 'active');
    
    await supabase
      .from('courses')
      .update({ enrolled_count: count || 0 })
      .eq('id', course.id);
  }
  console.log('  ✓ Enrollment counts updated');

  // ── 6. Create sample attendance records ──────────
  console.log('📋 Creating sample attendance records...');
  const { data: allStudents } = await supabase.from('students').select('id, course_id, teacher_id').eq('status', 'active');
  
  const attendanceRecords = [];
  const today = new Date();
  
  // Create attendance for last 5 days
  for (let d = 1; d <= 5; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    if (date.getDay() === 5 || date.getDay() === 6) continue; // skip fri/sat
    
    const dateStr = date.toISOString().split('T')[0];
    
    for (const student of (allStudents || []).slice(0, 50)) { // first 50 students
      const statuses = ['present','present','present','present','absent','late','excused'];
      attendanceRecords.push({
        student_id: student.id,
        course_id: student.course_id,
        teacher_id: student.teacher_id,
        session_date: dateStr,
        status: randomPick(statuses),
        recorded_by: student.teacher_id
      });
    }
  }

  // Insert attendance in batches
  let totalAtt = 0;
  for (let b = 0; b < attendanceRecords.length; b += 50) {
    const batch = attendanceRecords.slice(b, b + 50);
    const { error: aErr } = await supabase.from('attendance').insert(batch);
    if (aErr) { /* skip duplicates */ }
    totalAtt += batch.length;
  }
  console.log(`  ✓ Created ~${totalAtt} attendance records`);

  // ── Summary ──────────────────────────────────────
  console.log('\n✅ Seed complete!');
  console.log('───────────────────────────────');
  console.log(`Teachers:  10  (password: teacher123)`);
  console.log(`Courses:   ${courses.length}`);
  console.log(`Sessions:  ${sessions.length}`);
  console.log(`Students:  ${totalStudents}  (password: student123)`);
  console.log(`Attendance: ~${totalAtt} records`);
  console.log('───────────────────────────────');
  console.log('Teacher logins: teacher1..teacher10 / teacher123');
  console.log('Student logins: check the students table for usernames / student123');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
