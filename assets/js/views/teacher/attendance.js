const TeacherAttendance = (() => {
  let students = [];
  let records = {};

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">تسجيل الحضور</h2>
      <div class="card mb-20">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">الدورة</label>
            <select class="form-select" id="att-course" onchange="TeacherAttendance.loadStudents()">
              <option value="">اختر الدورة</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">التاريخ</label>
            <input type="date" class="form-input" id="att-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">الوقت</label>
            <input type="time" class="form-input" id="att-time">
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="TeacherAttendance.markAllPresent()">&#9989; كلهم حاضرون</button>
      </div>
      <div id="attendance-form-container"></div>
      <div style="margin-top:16px">
        <button class="btn btn-accent btn-lg" onclick="TeacherAttendance.save()" style="width:100%">&#128190; حفظ الحضور</button>
      </div>
    `;

    try {
      const data = await API.get('/teacher/dashboard');
      const select = document.getElementById('att-course');
      (data.my_courses || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.level})`;
        select.appendChild(opt);
      });
    } catch (_) {}
  }

  async function loadStudents() {
    const courseId = document.getElementById('att-course').value;
    const container = document.getElementById('attendance-form-container');
    if (!courseId) { container.innerHTML = ''; return; }

    try {
      const data = await API.get(`/teacher/students?course_id=${courseId}`);
      students = data.students || [];
      records = {};
      students.forEach(s => { records[s.id] = { student_id: s.id, status: 'present', note: '' }; });

      container.innerHTML = `
        <div class="attendance-form card">
          ${students.map(s => `
            <div class="student-row">
              <span class="student-name">${s.first_name} ${s.last_name}</span>
              <div class="status-buttons">
                <button class="status-btn present selected" data-id="${s.id}" data-status="present" onclick="TeacherAttendance.setStatus('${s.id}','present',this)">حاضر</button>
                <button class="status-btn absent" data-id="${s.id}" data-status="absent" onclick="TeacherAttendance.setStatus('${s.id}','absent',this)">غائب</button>
                <button class="status-btn late" data-id="${s.id}" data-status="late" onclick="TeacherAttendance.setStatus('${s.id}','late',this)">متأخر</button>
                <button class="status-btn excused" data-id="${s.id}" data-status="excused" onclick="TeacherAttendance.setStatus('${s.id}','excused',this)">معذور</button>
              </div>
              <input type="text" class="form-input note-input" placeholder="ملاحظة" oninput="TeacherAttendance.setNote('${s.id}',this.value)">
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function setStatus(id, status, btn) {
    records[id].status = status;
    const row = btn.closest('.student-row');
    row.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }

  function setNote(id, note) {
    if (records[id]) records[id].note = note;
  }

  function markAllPresent() {
    Object.keys(records).forEach(id => { records[id].status = 'present'; });
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.status-btn.present').forEach(b => b.classList.add('selected'));
    Toast.info('تم تحديد الجميع كحاضرين');
  }

  async function save() {
    const courseId = document.getElementById('att-course').value;
    const date = document.getElementById('att-date').value;
    const time = document.getElementById('att-time').value;

    if (!courseId) { Toast.warning('اختر الدورة'); return; }
    if (!date) { Toast.warning('اختر التاريخ'); return; }
    if (Object.keys(records).length === 0) { Toast.warning('لا يوجد تلاميذ'); return; }

    try {
      await API.post('/teacher/attendance', {
        course_id: courseId,
        session_date: date,
        session_time: time || null,
        records: Object.values(records)
      });
      Toast.success('تم حفظ الحضور بنجاح');
    } catch (err) { Toast.error(err.message); }
  }

  return { render, loadStudents, setStatus, setNote, markAllPresent, save };
})();
