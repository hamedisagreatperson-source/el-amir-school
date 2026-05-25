const StudentAttendanceView = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    try {
      const data = await API.get('/student/attendance');
      const s = data.summary;
      const records = data.attendance || [];

      page.innerHTML = `
        <div class="grid grid-4 mb-24 stagger">
          <div class="stat-card"><div class="stat-icon blue">${Icons.courses}</div><div><div class="stat-value">${s.total}</div><div class="stat-label">إجمالي الحصص</div></div></div>
          <div class="stat-card"><div class="stat-icon green">${Icons.check}</div><div><div class="stat-value">${s.present}</div><div class="stat-label">حاضر</div></div></div>
          <div class="stat-card"><div class="stat-icon red">${Icons.cross}</div><div><div class="stat-value">${s.absent}</div><div class="stat-label">غائب</div></div></div>
          <div class="stat-card"><div class="stat-icon gold">${Icons.stats}</div><div><div class="stat-value">${s.rate}%</div><div class="stat-label">النسبة</div></div></div>
        </div>

        <div class="progress-bar mb-24" style="height:12px">
          <div class="fill green" style="width:${s.rate}%"></div>
        </div>

        ${records.length > 0 ? `
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>التاريخ</th><th>الوقت</th><th>الحالة</th><th>ملاحظة</th></tr></thead>
              <tbody>
                ${records.map(r => `
                  <tr>
                    <td class="mono">${r.session_date}</td>
                    <td class="mono">${r.session_time ? Utils.formatTime(r.session_time) : '—'}</td>
                    <td>${Utils.getStatusBadge(r.status)}</td>
                    <td style="color:var(--text-muted);font-size:0.82rem">${r.note || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div class="empty-state"><div class="title">لا توجد سجلات حضور</div></div>'}
      `;
    } catch (err) {
      page.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  return { render };
})();
