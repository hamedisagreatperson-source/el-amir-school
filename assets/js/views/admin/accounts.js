const AdminAccounts = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20">
        <h2 style="font-size:1.1rem">حسابات المدراء</h2>
        <button class="btn btn-accent" onclick="AdminAccounts.showAdd()">&#43; إضافة مدير</button>
      </div>
      <div id="accounts-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
    `;
    await load();
  }

  async function load() {
    const container = document.getElementById('accounts-container');
    try {
      const data = await API.get('/admin/accounts');
      const admins = data.admins || [];
      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>الاسم</th><th>المستخدم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
            <tbody>
              ${admins.map(a => `
                <tr>
                  <td style="font-weight:600">${a.full_name}</td>
                  <td class="mono">${a.username}</td>
                  <td>${a.email}</td>
                  <td><span class="badge ${a.role==='super_admin'?'badge-warning':'badge-info'}">${a.role==='super_admin'?'رئيسي':'مدير'}</span></td>
                  <td>${a.is_active ? '<span class="badge badge-success">نشط</span>' : '<span class="badge badge-muted">معطّل</span>'}</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-ghost btn-sm" onclick="AdminAccounts.edit('${a.id}')">&#9998;</button>
                      <button class="btn btn-ghost btn-sm" onclick="AdminAccounts.remove('${a.id}')" style="color:var(--danger)">&#128465;</button>
                    </div>
                  </td>
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

  function showAdd() {
    const content = `
      <form onsubmit="AdminAccounts.submitAdd(event)">
        <div class="form-row">
          <div class="form-group"><label class="form-label">الاسم الكامل *</label><input type="text" class="form-input" name="full_name" required></div>
          <div class="form-group"><label class="form-label">البريد *</label><input type="email" class="form-input" name="email" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">اسم المستخدم *</label><input type="text" class="form-input" name="username" required></div>
          <div class="form-group"><label class="form-label">كلمة المرور *</label><input type="password" class="form-input" name="password" required minlength="6"></div>
        </div>
        <h4 style="margin:12px 0 8px">الصلاحيات</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${['manage_students','manage_teachers','manage_courses','manage_payments','send_emails'].map(p =>
            `<label class="checkbox-label"><input type="checkbox" name="perm_${p}"> ${translatePerm(p)}</label>`
          ).join('')}
        </div>
        <button type="submit" class="btn btn-accent mt-20" style="width:100%">إنشاء الحساب</button>
      </form>
    `;
    Modal.open({ title: 'إضافة مدير جديد', content, size: 'md' });
  }

  async function submitAdd(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const permissions = {};
    ['manage_students','manage_teachers','manage_courses','manage_payments','send_emails'].forEach(p => {
      permissions[p] = fd.get(`perm_${p}`) === 'on';
    });
    const body = { full_name: fd.get('full_name'), email: fd.get('email'), username: fd.get('username'), password: fd.get('password'), permissions };
    try { await API.post('/admin/accounts', body); Modal.close(); Toast.success('تم إنشاء الحساب'); load(); }
    catch (err) { Toast.error(err.message); }
  }

  async function edit(id) {
    Toast.info('قريباً — تعديل صلاحيات المدير');
  }

  async function remove(id) {
    const ok = await Modal.confirm({ title: 'حذف المدير', message: 'هل أنت متأكد؟', confirmText: 'حذف' });
    if (!ok) return;
    try { await API.delete(`/admin/accounts/${id}`); Toast.success('تم الحذف'); load(); }
    catch (err) { Toast.error(err.message); }
  }

  function translatePerm(p) {
    const map = { manage_students: 'إدارة التلاميذ', manage_teachers: 'إدارة الأساتذة', manage_courses: 'إدارة الدورات', manage_payments: 'إدارة الدفع', send_emails: 'إرسال إيميلات' };
    return map[p] || p;
  }

  return { render, showAdd, submitAdd, edit, remove };
})();
