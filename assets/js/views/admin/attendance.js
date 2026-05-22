const AdminAttendance = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">تقارير الحضور</h2>
      <div class="filters-bar">
        <input type="date" class="form-input" style="width:auto" id="att-from" onchange="AdminAttendance.load()">
        <input type="date" class="form-input" style="width:auto" id="att-to" onchange="AdminAttendance.load()">
      </div>
      <div id="attendance-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
    `;
    await load();
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
      const records = data.attendance || [];
      if (records.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#9989;</div><div class="title">لا توجد سجلات حضور</div></div>';
        return;
      }
      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>التلميذ</th><th>الدورة</th><th>التاريخ</th><th>الحالة</th><th>ملاحظة</th></tr></thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td>${r.students ? `${r.students.first_name} ${r.students.last_name}` : '—'}</td>
                  <td>${r.courses ? r.courses.name : '—'}</td>
                  <td class="mono">${r.session_date}</td>
                  <td>${Utils.getStatusBadge(r.status)}</td>
                  <td style="color:var(--text-muted);font-size:0.82rem">${r.note || ''}</td>
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

  return { render, load };
})();
