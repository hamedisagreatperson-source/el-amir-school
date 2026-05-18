const TeacherAttendance = (() => {
  let students = [];
  let records = {};
  let courseSessions = [];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">تسجيل الحضور</h2>
      <div class="card mb-20">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">الدورة</label>
            <select class="form-select" id="att-course" onchange="TeacherAttendance.onCourseChange()">
              <option value="">اختر الدورة</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">الحصة</label>
            <select class="form-select" id="att-session" onchange="TeacherAttendance.onSessionChange()">
              <option value="">اختر الحصة</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">التاريخ</label>
            <input type="date" class="form-input" id="att-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div id="att-session-info" style="display:none;padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="TeacherAttendance.markAllPresent()">&#9989; كلهم حاضرون</button>
          <button class="btn btn-outline btn-sm" onclick="TeacherAttendance.markAllAbsent()">&#10060; كلهم غائبون</button>
        </div>
      </div>
      <div id="attendance-stats" style="display:none" class="mb-20"></div>
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
        opt.textContent = `${c.name} (${c.level}) - ${c.sessions_per_week || 2} حصص/أسبوع`;
        select.appendChild(opt);
      });
    } catch (_) {}
  }

  async function onCourseChange() {
    const courseId = document.getElementById('att-course').value;
    const sessionSelect = document.getElementById('att-session');
    sessionSelect.innerHTML = '<option value="">اختر الحصة</option>';
    courseSessions = [];

    if (!courseId) {
      document.getElementById('attendance-form-container').innerHTML = '';
      document.getElementById('att-session-info').style.display = 'none';
      return;
    }

    try {
      const data = await API.get('/teacher/schedule');
      courseSessions = (data.schedule || []).filter(s => s.course_id === courseId);
      courseSessions.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${Utils.getArabicDay(s.day_of_week)} ${s.start_time}-${s.end_time} ${s.room ? '(' + s.room + ')' : ''}`;
        sessionSelect.appendChild(opt);
      });
    } catch (_) {}

    await loadStudents();
  }

  function onSessionChange() {
    const sessionId = document.getElementById('att-session').value;
    const infoDiv = document.getElementById('att-session-info');
    if (!sessionId) {
      infoDiv.style.display = 'none';
      return;
    }
    const session = courseSessions.find(s => s.id === sessionId);
    if (session) {
      infoDiv.style.display = 'block';
      infoDiv.innerHTML = `
        <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:0.85rem">
          <span><strong>اليوم:</strong> ${Utils.getArabicDay(session.day_of_week)}</span>
          <span><strong>الوقت:</strong> ${session.start_time} - ${session.end_time}</span>
          ${session.room ? `<span><strong>القاعة:</strong> ${session.room}</span>` : ''}
        </div>
      `;
      // Auto-fill time from session
      const timeInput = document.getElementById('att-date');
      if (timeInput) timeInput.value = timeInput.value || new Date().toISOString().split('T')[0];
    }
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

      updateStats();

      container.innerHTML = `
        <div class="attendance-form card">
          ${students.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-muted)">لا يوجد تلاميذ في هذه الدورة</div>' : ''}
          ${students.map((s, idx) => `
            <div class="student-row" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="width:30px;text-align:center;color:var(--text-muted);font-size:0.8rem">${idx + 1}</span>
              <span class="student-name" style="min-width:140px;font-weight:500">${s.first_name} ${s.last_name}</span>
              <div class="status-buttons" style="display:flex;gap:4px;flex-wrap:wrap">
                <button class="status-btn present selected" data-id="${s.id}" data-status="present" onclick="TeacherAttendance.setStatus('${s.id}','present',this)">حاضر</button>
                <button class="status-btn absent" data-id="${s.id}" data-status="absent" onclick="TeacherAttendance.setStatus('${s.id}','absent',this)">غائب</button>
                <button class="status-btn late" data-id="${s.id}" data-status="late" onclick="TeacherAttendance.setStatus('${s.id}','late',this)">متأخر</button>
                <button class="status-btn excused" data-id="${s.id}" data-status="excused" onclick="TeacherAttendance.setStatus('${s.id}','excused',this)">معذور</button>
              </div>
              <input type="text" class="form-input note-input" placeholder="ملاحظة" style="max-width:180px" oninput="TeacherAttendance.setNote('${s.id}',this.value)">
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function updateStats() {
    const statsDiv = document.getElementById('attendance-stats');
    if (!statsDiv || Object.keys(records).length === 0) { if (statsDiv) statsDiv.style.display = 'none'; return; }

    const total = Object.keys(records).length;
    const present = Object.values(records).filter(r => r.status === 'present').length;
    const absent = Object.values(records).filter(r => r.status === 'absent').length;
    const late = Object.values(records).filter(r => r.status === 'late').length;
    const excused = Object.values(records).filter(r => r.status === 'excused').length;

    statsDiv.style.display = 'block';
    statsDiv.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div class="card" style="flex:1;min-width:100px;text-align:center;padding:12px">
          <div style="font-size:1.5rem;font-weight:700">${total}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">إجمالي</div>
        </div>
        <div class="card" style="flex:1;min-width:100px;text-align:center;padding:12px;border-top:3px solid #10b981">
          <div style="font-size:1.5rem;font-weight:700;color:#10b981">${present}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">حاضر</div>
        </div>
        <div class="card" style="flex:1;min-width:100px;text-align:center;padding:12px;border-top:3px solid #ef4444">
          <div style="font-size:1.5rem;font-weight:700;color:#ef4444">${absent}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">غائب</div>
        </div>
        <div class="card" style="flex:1;min-width:100px;text-align:center;padding:12px;border-top:3px solid #f59e0b">
          <div style="font-size:1.5rem;font-weight:700;color:#f59e0b">${late}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">متأخر</div>
        </div>
        <div class="card" style="flex:1;min-width:100px;text-align:center;padding:12px;border-top:3px solid #3b82f6">
          <div style="font-size:1.5rem;font-weight:700;color:#3b82f6">${excused}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">معذور</div>
        </div>
      </div>
    `;
  }

  function setStatus(id, status, btn) {
    records[id].status = status;
    const row = btn.closest('.student-row');
    row.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    updateStats();
  }

  function setNote(id, note) {
    if (records[id]) records[id].note = note;
  }

  function markAllPresent() {
    Object.keys(records).forEach(id => { records[id].status = 'present'; });
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.status-btn.present').forEach(b => b.classList.add('selected'));
    updateStats();
    Toast.info('تم تحديد الجميع كحاضرين');
  }

  function markAllAbsent() {
    Object.keys(records).forEach(id => { records[id].status = 'absent'; });
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.status-btn.absent').forEach(b => b.classList.add('selected'));
    updateStats();
    Toast.info('تم تحديد الجميع كغائبين');
  }

  async function save() {
    const courseId = document.getElementById('att-course').value;
    const date = document.getElementById('att-date').value;
    const sessionId = document.getElementById('att-session').value;
    const session = courseSessions.find(s => s.id === sessionId);
    const sessionTime = session ? session.start_time : null;

    if (!courseId) { Toast.warning('اختر الدورة'); return; }
    if (!date) { Toast.warning('اختر التاريخ'); return; }
    if (Object.keys(records).length === 0) { Toast.warning('لا يوجد تلاميذ'); return; }

    try {
      const result = await API.post('/teacher/attendance', {
        course_id: courseId,
        session_date: date,
        session_time: sessionTime,
        records: Object.values(records)
      });
      const count = result.count || Object.keys(records).length;
      Toast.success(`تم حفظ حضور ${count} تلميذ بنجاح`);
    } catch (err) { Toast.error(err.message); }
  }

  return { render, onCourseChange, onSessionChange, loadStudents, setStatus, setNote, markAllPresent, markAllAbsent, save };
})();
