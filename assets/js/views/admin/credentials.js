const AdminCredentials = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20">
        <h2 style="font-size:1.1rem">بيانات الدخول لجميع المستخدمين</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="AdminCredentials.exportCSV()">&#128196; CSV</button>
          <button class="btn btn-outline btn-sm" onclick="AdminCredentials.exportPDF()">&#128196; PDF</button>
        </div>
      </div>
      <div class="card mb-20">
        <input type="text" class="form-input" placeholder="بحث بالاسم أو اسم المستخدم..." oninput="AdminCredentials.onSearch(this.value)" style="max-width:400px">
      </div>
      <div id="credentials-container">
        <div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div>
      </div>
    `;
    await loadCredentials();
  }

  let allData = { students: [], teachers: [], admins: [] };
  let searchTerm = '';

  async function loadCredentials() {
    const container = document.getElementById('credentials-container');
    try {
      const [studentsRes, teachersRes] = await Promise.all([
        API.get('/admin/students?limit=1000'),
        API.get('/admin/teachers')
      ]);
      let adminsData = [];
      try {
        const adminsRes = await API.get('/admin/accounts');
        adminsData = adminsRes.accounts || adminsRes.admins || [];
      } catch (_) {}

      allData.students = studentsRes.students || [];
      allData.teachers = teachersRes.teachers || [];
      allData.admins = adminsData;

      renderTable();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function renderTable() {
    const container = document.getElementById('credentials-container');
    const filter = searchTerm.toLowerCase();

    const students = allData.students.filter(s =>
      !filter || `${s.first_name} ${s.last_name}`.toLowerCase().includes(filter) || (s.username || '').toLowerCase().includes(filter)
    );
    const teachers = allData.teachers.filter(t =>
      !filter || (t.full_name || '').toLowerCase().includes(filter) || (t.username || '').toLowerCase().includes(filter)
    );

    container.innerHTML = `
      <h3 style="font-size:0.95rem;margin-bottom:12px;color:var(--accent)">الأساتذة (${teachers.length})</h3>
      <div class="table-container mb-20">
        <table class="data-table">
          <thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>البريد</th><th>الهاتف</th></tr></thead>
          <tbody>
            ${teachers.map(t => `
              <tr>
                <td style="font-weight:600">${Utils.escapeHtml(t.full_name || '')}</td>
                <td class="mono">${Utils.escapeHtml(t.username || '')}</td>
                <td class="mono">${t.email || '—'}</td>
                <td class="mono">${t.phone || '—'}</td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">لا يوجد</td></tr>'}
          </tbody>
        </table>
      </div>

      <h3 style="font-size:0.95rem;margin-bottom:12px;color:var(--accent)">التلاميذ (${students.length})</h3>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>البريد</th><th>الهاتف</th><th>المستوى</th></tr></thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td style="font-weight:600">${Utils.escapeHtml(s.first_name)} ${Utils.escapeHtml(s.last_name)}</td>
                <td class="mono">${Utils.escapeHtml(s.username || '')}</td>
                <td class="mono">${s.email || '—'}</td>
                <td class="mono">${s.phone || '—'}</td>
                <td><span class="badge badge-info">${s.level || ''}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا يوجد</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  const onSearch = Utils.debounce((value) => {
    searchTerm = value || '';
    renderTable();
  });

  async function exportCSV() {
    const rows = [];
    allData.teachers.forEach(t => {
      rows.push({ 'الدور': 'أستاذ', 'الاسم': t.full_name, 'اسم المستخدم': t.username, 'البريد': t.email || '', 'الهاتف': t.phone || '' });
    });
    allData.students.forEach(s => {
      rows.push({ 'الدور': 'تلميذ', 'الاسم': `${s.first_name} ${s.last_name}`, 'اسم المستخدم': s.username, 'البريد': s.email || '', 'الهاتف': s.phone || '' });
    });
    await Export.toExcel(rows, `credentials-${new Date().toISOString().slice(0, 10)}`);
  }

  async function exportPDF() {
    const cols = [
      { header: 'الدور', key: 'role' },
      { header: 'الاسم', key: 'name' },
      { header: 'اسم المستخدم', key: 'username' },
      { header: 'البريد', key: 'email' },
      { header: 'الهاتف', key: 'phone' }
    ];
    const rows = [];
    allData.teachers.forEach(t => {
      rows.push({ role: 'أستاذ', name: t.full_name, username: t.username, email: t.email || '', phone: t.phone || '' });
    });
    allData.students.forEach(s => {
      rows.push({ role: 'تلميذ', name: `${s.first_name} ${s.last_name}`, username: s.username, email: s.email || '', phone: s.phone || '' });
    });
    await Export.toPDF(rows, cols, 'بيانات الدخول - منصة الأمير', `credentials-${new Date().toISOString().slice(0, 10)}`);
  }

  return { render, onSearch, exportCSV, exportPDF };
})();
