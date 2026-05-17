const AdminAuditLog = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">سجل العمليات</h2>
      <div id="audit-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
    `;
    await load();
  }

  async function load() {
    const container = document.getElementById('audit-container');
    try {
      const data = await API.get('/admin/audit-log');
      const logs = data.logs || [];
      if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#128221;</div><div class="title">لا توجد عمليات مسجلة</div></div>';
        return;
      }
      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>الوقت</th><th>المستخدم</th><th>الدور</th><th>العملية</th><th>الهدف</th></tr></thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td class="mono" style="font-size:0.78rem">${new Date(l.timestamp).toLocaleString('ar-DZ')}</td>
                  <td>${l.actor_name || '—'}</td>
                  <td><span class="badge badge-info">${l.actor_role}</span></td>
                  <td>${l.action}</td>
                  <td>${l.target_type || ''} ${l.target_id ? l.target_id.slice(0,8) : ''}</td>
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
