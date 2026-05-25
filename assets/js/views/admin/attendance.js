const AdminAttendance = (() => {
  let allRecords = [];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">${Icons.attendance} تقارير الحضور</h2>
      <div class="filters-bar mb-20">
        <input type="text" class="form-input search-input" placeholder="بحث بالاسم..." oninput="AdminAttendance.onSearch(this.value)">
        <input type="date" class="form-input" style="width:auto" id="att-from" onchange="AdminAttendance.load()">
        <input type="date" class="form-input" style="width:auto" id="att-to" onchange="AdminAttendance.load()">
        <select class="form-select" id="att-status-filter" onchange="AdminAttendance.filterByStatus(this.value)">
          <option value="">كل الحالات</option>
          <option value="present">حاضر</option>
          <option value="absent">غائب</option>
          <option value="late">متأخر</option>
          <option value="excused">معذور</option>
        </select>
      </div>
      <div id="attendance-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
    `;
    await load();
  }

  let searchQ = '';
  let statusFilter = '';

  const onSearch = Utils.debounce((v) => { searchQ = v; applyFilters(); }, 300);
  function filterByStatus(v) { statusFilter = v; applyFilters(); }

  function applyFilters() {
    let filtered = [...allRecords];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      filtered = filtered.filter(r => {
        const name = r.students ? `${r.students.first_name} ${r.students.last_name}`.toLowerCase() : '';
        return name.includes(q);
      });
    }
    if (statusFilter) filtered = filtered.filter(r => r.status === statusFilter);
    renderGrid(filtered);
  }

  async function load() {
    const container = document.getElementById('attendance-container');
    const from = document.getElementById('att-from')?.value;
    const to = document.getElementById('att-to')?.value;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
      const data = await API.get(`/admin/attendance?${params}`);
      allRecords = data.attendance || [];
      applyFilters();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="icon">${Icons.warning}</div><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function renderGrid(records) {
    const container = document.getElementById('attendance-container');
    if (records.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">${Icons.attendance}</div><div class="title">لا توجد سجلات حضور</div></div>`;
      return;
    }

    // Group by student for grid view
    const byStudent = {};
    records.forEach(r => {
      const sid = r.student_id || 'unknown';
      if (!byStudent[sid]) {
        byStudent[sid] = {
          name: r.students ? `${r.students.first_name} ${r.students.last_name}` : '—',
          records: []
        };
      }
      byStudent[sid].records.push(r);
    });

    let html = '<div class="att-grid">';
    Object.keys(byStudent).forEach(sid => {
      const st = byStudent[sid];
      html += `<div class="att-student-card card">
        <div class="asc-header">
          <div class="asc-name">${st.name}</div>
          <span class="mono" style="font-size:0.78rem;color:var(--text-muted)">${st.records.length} سجل</span>
        </div>
        <div class="asc-squares">`;
      st.records.forEach(r => {
        const statusIcon = r.status === 'present' ? Icons.check : r.status === 'absent' ? Icons.cross : r.status === 'late' ? Icons.clock : Icons.info;
        const statusLabel = Utils.getAttendanceStatus ? Utils.getAttendanceStatus(r.status) : r.status;
        html += `<div class="att-square ${r.status}" title="${r.session_date} - ${statusLabel}">
          <div class="att-square-icon">${statusIcon}</div>
          <div class="att-square-date">${Utils.formatDate(r.session_date)}</div>
        </div>`;
      });
      html += `</div></div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  return { render, load, onSearch, filterByStatus };
})();
