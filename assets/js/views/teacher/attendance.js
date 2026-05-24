const TeacherAttendance = (() => {
  let students = [];
  let records = {};
  let currentTab = 'record';
  let historyFilters = {};

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20 attendance-page-header">
        <h2 style="font-size:1.1rem">&#9989; الحضور و الغياب</h2>
      </div>

      <div class="tabs mb-20">
        <button class="tab-btn ${currentTab === 'record' ? 'active' : ''}" onclick="TeacherAttendance.switchTab('record')">&#128221; تسجيل الحضور</button>
        <button class="tab-btn ${currentTab === 'history' ? 'active' : ''}" onclick="TeacherAttendance.switchTab('history')">&#128197; سجل الحضور</button>
        <button class="tab-btn ${currentTab === 'stats' ? 'active' : ''}" onclick="TeacherAttendance.switchTab('stats')">&#128202; الإحصائيات</button>
      </div>

      <div id="attendance-tab-content"></div>
    `;

    await renderCurrentTab();
  }

  async function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tabs .tab-btn:nth-child(${tab === 'record' ? 1 : tab === 'history' ? 2 : 3})`).classList.add('active');
    await renderCurrentTab();
  }

  async function renderCurrentTab() {
    const container = document.getElementById('attendance-tab-content');
    if (currentTab === 'record') await renderRecordTab(container);
    else if (currentTab === 'history') await renderHistoryTab(container);
    else if (currentTab === 'stats') await renderStatsTab(container);
  }

  async function renderRecordTab(container) {
    container.innerHTML = `
      <div class="card mb-20">
        <div class="card-header">
          <span class="card-title">&#128221; معلومات الحصة</span>
        </div>
        <div class="form-row attendance-form-row">
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
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="TeacherAttendance.markAllPresent()">&#9989; كلهم حاضرون</button>
          <button class="btn btn-outline btn-sm" style="border-color:var(--danger);color:var(--danger)" onclick="TeacherAttendance.markAllAbsent()">&#10060; كلهم غائبون</button>
        </div>
      </div>

      <div id="attendance-form-container"></div>

      <div style="margin-top:16px" id="attendance-save-container" style="display:none">
        <button class="btn btn-accent btn-lg attendance-save-btn" onclick="TeacherAttendance.save()">&#128190; حفظ الحضور</button>
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

  async function renderHistoryTab(container) {
    container.innerHTML = `
      <div class="card mb-20">
        <div class="card-header">
          <span class="card-title">&#128197; فلترة السجل</span>
        </div>
        <div class="form-row attendance-form-row">
          <div class="form-group">
            <label class="form-label">الدورة</label>
            <select class="form-select" id="hist-course" onchange="TeacherAttendance.loadHistory()">
              <option value="">كل الدورات</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">من تاريخ</label>
            <input type="date" class="form-input" id="hist-from" onchange="TeacherAttendance.loadHistory()">
          </div>
          <div class="form-group">
            <label class="form-label">إلى تاريخ</label>
            <input type="date" class="form-input" id="hist-to" onchange="TeacherAttendance.loadHistory()">
          </div>
        </div>
      </div>
      <div id="history-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
    `;

    try {
      const data = await API.get('/teacher/dashboard');
      const select = document.getElementById('hist-course');
      (data.my_courses || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.level})`;
        select.appendChild(opt);
      });
    } catch (_) {}

    await loadHistory();
  }

  async function renderStatsTab(container) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">جاري تحميل الإحصائيات...</div>';

    try {
      const data = await API.get('/teacher/dashboard');
      const courses = data.my_courses || [];

      let allAtt = [];
      for (const c of courses) {
        try {
          const attData = await API.get(`/teacher/attendance?course_id=${c.id}`);
          allAtt = allAtt.concat((attData.attendance || []).map(a => ({ ...a, courseName: c.name })));
        } catch (_) {}
      }

      const total = allAtt.length;
      const present = allAtt.filter(a => a.status === 'present').length;
      const absent = allAtt.filter(a => a.status === 'absent').length;
      const late = allAtt.filter(a => a.status === 'late').length;
      const excused = allAtt.filter(a => a.status === 'excused').length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

      const courseStats = {};
      allAtt.forEach(a => {
        if (!courseStats[a.course_id]) courseStats[a.course_id] = { name: a.courseName, total: 0, present: 0, absent: 0, late: 0, excused: 0 };
        courseStats[a.course_id].total++;
        courseStats[a.course_id][a.status]++;
      });

      container.innerHTML = `
        <div class="grid grid-4 mb-20">
          <div class="stat-card">
            <div class="stat-icon green">&#9989;</div>
            <div>
              <div class="stat-value">${present}</div>
              <div class="stat-label">حاضر</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red">&#10060;</div>
            <div>
              <div class="stat-value">${absent}</div>
              <div class="stat-label">غائب</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange">&#9203;</div>
            <div>
              <div class="stat-value">${late}</div>
              <div class="stat-label">متأخر</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon blue">&#128712;</div>
            <div>
              <div class="stat-value">${excused}</div>
              <div class="stat-label">معذور</div>
            </div>
          </div>
        </div>

        <div class="card mb-20">
          <div class="card-header">
            <span class="card-title">&#128202; نسبة الحضور الإجمالية</span>
            <span class="mono" style="font-weight:700;font-size:1.2rem;color:${rate >= 70 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)'}">${rate}%</span>
          </div>
          <div class="progress-bar" style="height:12px;border-radius:6px">
            <div class="fill ${rate >= 70 ? 'green' : rate >= 50 ? 'gold' : 'red'}" style="width:${rate}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.8rem;color:var(--text-muted)">
            <span>إجمالي السجلات: ${total}</span>
            <span>الحاضرين: ${present} من ${total}</span>
          </div>
        </div>

        ${Object.keys(courseStats).length > 0 ? `
          <div class="card">
            <div class="card-header">
              <span class="card-title">&#128218; إحصائيات حسب الدورة</span>
            </div>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>الدورة</th>
                    <th>إجمالي</th>
                    <th>حاضر</th>
                    <th>غائب</th>
                    <th>متأخر</th>
                    <th>معذور</th>
                    <th>النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.values(courseStats).map(cs => {
                    const cRate = cs.total > 0 ? Math.round((cs.present / cs.total) * 100) : 0;
                    return `
                      <tr>
                        <td style="font-weight:600">${cs.name}</td>
                        <td class="mono">${cs.total}</td>
                        <td><span class="badge badge-success">${cs.present}</span></td>
                        <td><span class="badge badge-danger">${cs.absent}</span></td>
                        <td><span class="badge badge-warning">${cs.late}</span></td>
                        <td><span class="badge badge-info">${cs.excused}</span></td>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px">
                            <div class="progress-bar" style="flex:1;height:6px">
                              <div class="fill ${cRate >= 70 ? 'green' : cRate >= 50 ? 'gold' : 'red'}" style="width:${cRate}%"></div>
                            </div>
                            <span class="mono" style="font-size:0.8rem;font-weight:600">${cRate}%</span>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      `;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="icon">&#9888;</div><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  async function loadHistory() {
    const container = document.getElementById('history-container');
    const courseId = document.getElementById('hist-course')?.value;
    const from = document.getElementById('hist-from')?.value;
    const to = document.getElementById('hist-to')?.value;

    try {
      const params = new URLSearchParams();
      if (courseId) params.set('course_id', courseId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const data = await API.get(`/teacher/attendance?${params}`);
      const attendance = data.attendance || [];

      if (attendance.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#128197;</div><div class="title">لا توجد سجلات</div><div class="description">لم يتم العثور على سجلات حضور مطابقة</div></div>';
        return;
      }

      const grouped = {};
      attendance.forEach(a => {
        const key = `${a.session_date}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(a);
      });

      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>التلميذ</th>
                <th>الحالة</th>
                <th>الوقت</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              ${attendance.map(a => `
                <tr>
                  <td class="mono" style="font-size:0.82rem">${Utils.formatDate(a.session_date)}</td>
                  <td style="font-weight:500">${a.students ? `${a.students.first_name} ${a.students.last_name}` : '—'}</td>
                  <td>${Utils.getStatusBadge(a.status)}</td>
                  <td class="mono" style="font-size:0.82rem">${a.session_time ? Utils.formatTime(a.session_time) : '—'}</td>
                  <td style="font-size:0.85rem;color:var(--text-muted)">${a.note || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
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

      if (students.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#128100;</div><div class="title">لا يوجد تلاميذ</div><div class="description">هذه الدورة ليس بها تلاميذ مسجلين</div></div>';
        return;
      }

      container.innerHTML = `
        <div class="card mb-16">
          <div class="card-header">
            <span class="card-title">&#128100; قائمة التلاميذ (${students.length})</span>
          </div>
          <div class="attendance-form">
            ${students.map((s, i) => `
              <div class="student-row ${i % 2 === 0 ? '' : 'alt-row'}">
                <div class="student-info-cell">
                  <span class="student-number">${i + 1}</span>
                  <span class="student-name">${s.first_name} ${s.last_name}</span>
                </div>
                <div class="status-buttons">
                  <button class="status-btn present selected" data-id="${s.id}" data-status="present" onclick="TeacherAttendance.setStatus('${s.id}','present',this)">&#9989; حاضر</button>
                  <button class="status-btn absent" data-id="${s.id}" data-status="absent" onclick="TeacherAttendance.setStatus('${s.id}','absent',this)">&#10060; غائب</button>
                  <button class="status-btn late" data-id="${s.id}" data-status="late" onclick="TeacherAttendance.setStatus('${s.id}','late',this)">&#9203; متأخر</button>
                  <button class="status-btn excused" data-id="${s.id}" data-status="excused" onclick="TeacherAttendance.setStatus('${s.id}','excused',this)">&#128712; معذور</button>
                </div>
                <input type="text" class="form-input note-input" placeholder="ملاحظة..." oninput="TeacherAttendance.setNote('${s.id}',this.value)">
              </div>
            `).join('')}
          </div>
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
    Toast.info('&#9989; تم تحديد الجميع كحاضرين');
  }

  function markAllAbsent() {
    Object.keys(records).forEach(id => { records[id].status = 'absent'; });
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.status-btn.absent').forEach(b => b.classList.add('selected'));
    Toast.info('&#10060; تم تحديد الجميع كغائبين');
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
      Toast.success('&#9989; تم حفظ الحضور بنجاح');
    } catch (err) { Toast.error(err.message); }
  }

  return { render, switchTab, loadStudents, loadHistory, setStatus, setNote, markAllPresent, markAllAbsent, save };
})();
