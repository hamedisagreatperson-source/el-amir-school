const AdminEmails = (() => {
  let teachers = [];
  let students = [];
  let courses = [];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">إرسال الإيميلات</h2>
      <div class="card">
        <form onsubmit="AdminEmails.send(event)">
          <div class="form-group">
            <label class="form-label">إرسال إلى</label>
            <select class="form-select" name="target" id="email-target" onchange="AdminEmails.onTargetChange()">
              <option value="all">الجميع (تلاميذ + أساتذة)</option>
              <option value="students">كل التلاميذ</option>
              <option value="teachers">كل الأساتذة</option>
              <option value="course">تلاميذ دورة محددة</option>
              <option value="specific_students">تلميذ محدد</option>
              <option value="specific_teachers">أستاذ محدد</option>
            </select>
          </div>
          <div class="form-group" id="course-select-group" style="display:none">
            <label class="form-label">الدورة</label>
            <select class="form-select" id="email-course"></select>
          </div>
          <div class="form-group" id="student-select-group" style="display:none">
            <label class="form-label">اختر التلاميذ</label>
            <input type="text" class="form-input mb-10" id="student-search" placeholder="بحث عن تلميذ..." oninput="AdminEmails.filterStudents()">
            <div id="student-checkboxes" class="checkbox-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:8px"></div>
          </div>
          <div class="form-group" id="teacher-select-group" style="display:none">
            <label class="form-label">اختر الأساتذة</label>
            <div id="teacher-checkboxes" class="checkbox-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:8px"></div>
          </div>
          <div class="form-group">
            <label class="form-label">الموضوع *</label>
            <input type="text" class="form-input" name="subject" required>
          </div>
          <div class="form-group">
            <label class="form-label">الرسالة *</label>
            <textarea class="form-textarea" name="message" rows="6" required placeholder="يمكنك استخدام {name} لاسم المرسل إليه"></textarea>
          </div>
          <button type="submit" class="btn btn-accent" id="send-btn">&#9993; إرسال</button>
        </form>
      </div>
    `;

    try {
      const [tData, sData, cData] = await Promise.all([
        API.get('/admin/teachers'),
        API.get('/admin/students?limit=500'),
        API.get('/admin/courses')
      ]);
      teachers = tData.teachers || [];
      students = sData.students || [];
      courses = cData.courses || [];

      const courseSelect = document.getElementById('email-course');
      courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.level})`;
        courseSelect.appendChild(opt);
      });
      renderTeacherCheckboxes();
      renderStudentCheckboxes();
    } catch (_) {}
  }

  function renderTeacherCheckboxes() {
    const container = document.getElementById('teacher-checkboxes');
    if (!container) return;
    container.innerHTML = teachers.map(t => `
      <label style="display:block;padding:6px 4px;cursor:pointer">
        <input type="checkbox" value="${t.id}" name="teacher_check" style="margin-left:8px">
        ${t.full_name} (${t.email})
      </label>
    `).join('');
  }

  function renderStudentCheckboxes(filter) {
    const container = document.getElementById('student-checkboxes');
    if (!container) return;
    let filtered = students.filter(s => s.email && s.status === 'active');
    if (filter) {
      const q = filter.toLowerCase();
      filtered = filtered.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || (s.email && s.email.toLowerCase().includes(q)));
    }
    container.innerHTML = filtered.slice(0, 50).map(s => `
      <label style="display:block;padding:6px 4px;cursor:pointer">
        <input type="checkbox" value="${s.id}" name="student_check" style="margin-left:8px">
        ${s.first_name} ${s.last_name} (${s.email})
      </label>
    `).join('') + (filtered.length > 50 ? '<div style="color:var(--text-muted);padding:8px;font-size:0.8rem">... عرض أول 50 نتيجة فقط، استخدم البحث لتصفية</div>' : '');
  }

  function filterStudents() {
    const q = document.getElementById('student-search')?.value || '';
    renderStudentCheckboxes(q);
  }

  function onTargetChange() {
    const target = document.getElementById('email-target').value;
    document.getElementById('course-select-group').style.display = target === 'course' ? '' : 'none';
    document.getElementById('student-select-group').style.display = target === 'specific_students' ? '' : 'none';
    document.getElementById('teacher-select-group').style.display = target === 'specific_teachers' ? '' : 'none';
  }

  async function send(e) {
    e.preventDefault();
    const form = e.target;
    const target = form.target.value;
    const body = { target, subject: form.subject.value, message: form.message.value };

    if (target === 'course') body.course_id = document.getElementById('email-course').value;
    if (target === 'specific_students') {
      body.student_ids = Array.from(document.querySelectorAll('input[name="student_check"]:checked')).map(cb => cb.value);
      if (body.student_ids.length === 0) { Toast.warning('اختر تلميذ واحد على الأقل'); return; }
    }
    if (target === 'specific_teachers') {
      body.teacher_ids = Array.from(document.querySelectorAll('input[name="teacher_check"]:checked')).map(cb => cb.value);
      if (body.teacher_ids.length === 0) { Toast.warning('اختر أستاذ واحد على الأقل'); return; }
    }

    const btn = document.getElementById('send-btn');
    btn.disabled = true; btn.textContent = 'جاري الإرسال...';
    try {
      const data = await API.post('/admin/emails/send', body);
      Toast.success(`تم إرسال ${data.sent_count} إيميل من أصل ${data.total_recipients}`);
      form.reset();
      onTargetChange();
    } catch (err) { Toast.error(err.message); }
    btn.disabled = false; btn.innerHTML = '&#9993; إرسال';
  }

  return { render, send, onTargetChange, filterStudents };
})();
