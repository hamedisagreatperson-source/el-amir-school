const AdminAccounts = (() => {
  let allAccounts = [];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20">
        <h2 style="font-size:1.1rem">${Icons.accounts} حسابات المدراء</h2>
        <button class="btn btn-accent" onclick="AdminAccounts.showAddModal()">${Icons.add} إضافة مدير</button>
      </div>
      <div class="filters-bar mb-20">
        <input type="text" class="form-input search-input" placeholder="بحث بالاسم أو البريد..." oninput="AdminAccounts.onSearch(this.value)">
        <select class="form-select" onchange="AdminAccounts.filterRole(this.value)">
          <option value="">كل الأدوار</option>
          <option value="super_admin">مدير رئيسي</option>
          <option value="admin">مدير</option>
        </select>
        <select class="form-select" onchange="AdminAccounts.filterStatus(this.value)">
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">معطّل</option>
        </select>
      </div>
      <div id="accounts-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
    `;
    await loadAccounts();
  }

  let filters = {};

  const onSearch = Utils.debounce((v) => {
    filters.search = v || undefined;
    applyFilters();
  });

  function filterRole(v) { filters.role = v || undefined; applyFilters(); }
  function filterStatus(v) { filters.status = v || undefined; applyFilters(); }

  function applyFilters() {
    let filtered = [...allAccounts];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(a => a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.username && a.username.toLowerCase().includes(q)));
    }
    if (filters.role) filtered = filtered.filter(a => a.role === filters.role);
    if (filters.status) filtered = filtered.filter(a => filters.status === 'active' ? a.is_active : !a.is_active);
    renderAccounts(filtered);
  }

  async function loadAccounts() {
    const container = document.getElementById('accounts-container');
    try {
      const data = await API.get('/admin/accounts');
      allAccounts = data.admins || [];
      renderAccounts(allAccounts);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="icon">${Icons.warning}</div><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function renderAccounts(accounts) {
    const container = document.getElementById('accounts-container');
    if (accounts.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">${Icons.accounts}</div><div class="title">لا يوجد حسابات</div></div>`;
      return;
    }

    container.innerHTML = `
      <div class="grid grid-2">
        ${accounts.map(a => {
          const roleLabel = a.role === 'super_admin' ? 'مدير رئيسي' : 'مدير';
          const roleBadge = a.role === 'super_admin' ? 'badge-accent' : 'badge-info';
          return `
            <div class="card account-card" style="position:relative">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:12px">
                  <div class="user-avatar-lg" style="width:48px;height:48px;border-radius:50%;background:var(--primary-light);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem">${a.full_name.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                  <div>
                    <div style="font-weight:700;font-size:1rem">${a.full_name}</div>
                    <div style="font-size:0.82rem;color:var(--text-muted)">@${a.username}</div>
                  </div>
                </div>
                <span class="badge ${roleBadge}">${roleLabel}</span>
              </div>
              <div style="font-size:0.85rem;line-height:2;color:var(--text-muted)">
                <div>${Icons.emails} <strong>البريد:</strong> ${a.email}</div>
                <div>${Icons.shield} <strong>الحالة:</strong> ${a.is_active ? '<span style="color:var(--success)">نشط</span>' : '<span style="color:var(--danger)">معطّل</span>'}</div>
                <div>${Icons.clock} <strong>تاريخ الإنشاء:</strong> ${a.created_at ? Utils.formatDate(a.created_at) : '—'}</div>
                <div>${Icons.history} <strong>آخر دخول:</strong> ${a.last_login ? Utils.formatDate(a.last_login) : '—'}</div>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
                <button class="btn btn-ghost btn-sm" onclick="AdminAccounts.editAccount('${a.id}')">${Icons.edit} تعديل</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminAccounts.toggleStatus('${a.id}',${a.is_active})" style="color:${a.is_active ? 'var(--warning)' : 'var(--success)'}">${a.is_active ? Icons.cross + ' تعطيل' : Icons.check + ' تفعيل'}</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminAccounts.resetPassword('${a.id}')" style="color:var(--info)">${Icons.forgot} إعادة كلمة المرور</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function showAddModal() {
    const content = `
      <form onsubmit="AdminAccounts.submitAdd(event)">
        <div class="form-row">
          <div class="form-group"><label class="form-label">الاسم الكامل *</label><input type="text" class="form-input" name="full_name" required></div>
          <div class="form-group"><label class="form-label">اسم المستخدم *</label><input type="text" class="form-input" name="username" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">البريد *</label><input type="email" class="form-input" name="email" required></div>
          <div class="form-group"><label class="form-label">كلمة المرور *</label><input type="password" class="form-input" name="password" required minlength="6"></div>
        </div>
        <div class="form-group">
          <label class="form-label">الدور</label>
          <select class="form-select" name="role">
            <option value="admin">مدير</option>
            <option value="super_admin">مدير رئيسي</option>
          </select>
        </div>
        <button type="submit" class="btn btn-accent" style="width:100%">${Icons.add} إضافة</button>
      </form>
    `;
    Modal.open({ title: 'إضافة حساب مدير', content, size: 'md' });
  }

  async function submitAdd(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      await API.post('/admin/accounts', body);
      Modal.close();
      Toast.success('تم إضافة الحساب');
      loadAccounts();
    } catch (err) { Toast.error(err.message); }
  }

  async function editAccount(id) {
    const a = allAccounts.find(x => x.id === id);
    if (!a) return;
    const content = `
      <form onsubmit="AdminAccounts.submitEdit(event,'${id}')">
        <div class="form-row">
          <div class="form-group"><label class="form-label">الاسم</label><input type="text" class="form-input" name="full_name" value="${a.full_name}" required></div>
          <div class="form-group"><label class="form-label">البريد</label><input type="email" class="form-input" name="email" value="${a.email}" required></div>
        </div>
        <div class="form-group">
          <label class="form-label">الدور</label>
          <select class="form-select" name="role">
            <option value="admin" ${a.role === 'admin' ? 'selected' : ''}>مدير</option>
            <option value="super_admin" ${a.role === 'super_admin' ? 'selected' : ''}>مدير رئيسي</option>
          </select>
        </div>
        <button type="submit" class="btn btn-accent" style="width:100%">${Icons.save} حفظ</button>
      </form>
    `;
    Modal.open({ title: 'تعديل الحساب', content, size: 'md' });
  }

  async function submitEdit(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try { await API.patch(`/admin/accounts/${id}`, body); Modal.close(); Toast.success('تم التعديل'); loadAccounts(); }
    catch (err) { Toast.error(err.message); }
  }

  async function toggleStatus(id, isActive) {
    try {
      await API.patch(`/admin/accounts/${id}`, { is_active: !isActive });
      Toast.success(isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب');
      loadAccounts();
    } catch (err) { Toast.error(err.message); }
  }

  async function resetPassword(id) {
    const content = `
      <form onsubmit="AdminAccounts.submitResetPassword(event,'${id}')">
        <div class="form-group">
          <label class="form-label">كلمة المرور الجديدة</label>
          <input type="password" class="form-input" name="password" required minlength="6">
        </div>
        <button type="submit" class="btn btn-accent" style="width:100%">${Icons.save} حفظ</button>
      </form>
    `;
    Modal.open({ title: 'إعادة تعيين كلمة المرور', content, size: 'sm' });
  }

  async function submitResetPassword(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try { await API.patch(`/admin/accounts/${id}`, body); Modal.close(); Toast.success('تم تغيير كلمة المرور'); }
    catch (err) { Toast.error(err.message); }
  }

  return { render, onSearch, filterRole, filterStatus, showAddModal, submitAdd, editAccount, submitEdit, toggleStatus, resetPassword, submitResetPassword };
})();
