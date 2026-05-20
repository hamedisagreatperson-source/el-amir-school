const AdminStudents = (() => {
  let currentPage = 1;
  let filters = {};

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20">
        <h2 style="font-size:1.1rem">قائمة التلاميذ</h2>
        <button class="btn btn-accent" onclick="AdminStudents.showAddModal()">&#43; إضافة تلميذ</button>
      </div>
      <div class="filters-bar">
        <input type="text" class="form-input search-input" placeholder="بحث بالاسم أو الهاتف..." oninput="AdminStudents.onSearch(this.value)">
        <select class="form-select" onchange="AdminStudents.filterLevel(this.value)">
          <option value="">كل المستويات</option>
          ${Utils.getLevelOptions().map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
        <select class="form-select" onchange="AdminStudents.filterStatus(this.value)">
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="suspended">موقوف</option>
          <option value="expelled">مطرود</option>
          <option value="pending">معلّق</option>
        </select>
        <div style="margin-right:auto;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="AdminStudents.exportExcel()">&#128196; Excel</button>
          <button class="btn btn-outline btn-sm" onclick="AdminStudents.exportPDF()">&#128196; PDF</button>
          <button class="btn btn-outline btn-sm" onclick="AdminStudents.exportCSV()">&#128196; CSV</button>
          <button class="btn btn-outline btn-sm" onclick="AdminStudents.exportWord()">&#128196; Word</button>
        </div>
      </div>
      <div id="students-table-container">
        <div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div>
      </div>
    `;
    await loadStudents();
  }

  async function loadStudents() {
    const container = document.getElementById('students-table-container');
    try {
      const params = new URLSearchParams({ page: currentPage, limit: 20, ...filters });
      const data = await API.get(`/admin/students?${params}`);
      const students = data.students || [];

      if (students.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#128100;</div><div class="title">لا يوجد تلاميذ</div></div>';
        return;
      }

      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>الاسم الكامل</th>
                <th>الهاتف</th>
                <th>المستوى</th>
                <th>الدورة</th>
                <th>الأستاذ</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => `
                <tr>
                  <td style="font-weight:600">${Utils.escapeHtml(s.first_name)} ${Utils.escapeHtml(s.last_name)}</td>
                  <td class="mono">${s.phone || ''}</td>
                  <td><span class="badge badge-info">${s.level}</span></td>
                  <td>${s.courses ? s.courses.name : '—'}</td>
                  <td>${s.teachers ? s.teachers.full_name : '—'}</td>
                  <td>${Utils.getStatusBadge(s.status)}</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      ${s.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="AdminStudents.approveStudent('${s.id}')" title="قبول">&#10003; قبول</button>` : ''}
                      <button class="btn btn-ghost btn-sm" onclick="AdminStudents.viewStudent('${s.id}')" title="عرض">&#128065;</button>
                      <button class="btn btn-ghost btn-sm" onclick="AdminStudents.editStudent('${s.id}')" title="تعديل">&#9998;</button>
                      <button class="btn btn-ghost btn-sm" onclick="AdminStudents.deleteStudent('${s.id}')" title="حذف" style="color:var(--danger)">&#128465;</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${Utils.generatePagination(data.page, data.pages)}
      `;

      container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentPage = parseInt(btn.dataset.page);
          loadStudents();
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  const onSearch = Utils.debounce((value) => {
    filters.search = value || undefined;
    currentPage = 1;
    loadStudents();
  });

  function filterLevel(value) { filters.level = value || undefined; currentPage = 1; loadStudents(); }
  function filterStatus(value) { filters.status = value || undefined; currentPage = 1; loadStudents(); }

  async function showAddModal() {
    let courses = [];
    try { const d = await API.get('/admin/courses'); courses = d.courses || []; } catch (_) {}

    const content = `
      <form id="add-student-form" onsubmit="AdminStudents.submitAddStudent(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">الاسم الأول *</label>
            <input type="text" class="form-input" name="first_name" required>
          </div>
          <div class="form-group">
            <label class="form-label">اللقب *</label>
            <input type="text" class="form-input" name="last_name" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">رقم الهاتف *</label>
            <input type="tel" class="form-input" name="phone" required>
          </div>
          <div class="form-group">
            <label class="form-label">هاتف ولي الأمر</label>
            <input type="tel" class="form-input" name="parent_phone">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">البريد الإلكتروني</label>
            <input type="email" class="form-input" name="email">
          </div>
          <div class="form-group">
            <label class="form-label">المستوى الدراسي *</label>
            <select class="form-select" name="level" required>
              <option value="">اختر المستوى</option>
              ${Utils.getLevelOptions().map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">الدورة</label>
          <select class="form-select" name="course_id">
            <option value="">بدون دورة</option>
            ${courses.map(c => `<option value="${c.id}">${c.name} (${c.level}) — ${c.enrolled_count}/${c.capacity}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="btn btn-accent" style="width:100%;margin-top:8px">تسجيل التلميذ</button>
      </form>
    `;
    Modal.open({ title: 'إضافة تلميذ جديد', content, size: 'lg' });
  }

  async function submitAddStudent(e) {
    e.preventDefault();
    const form = e.target;
    const body = Object.fromEntries(new FormData(form));
    if (!body.course_id) delete body.course_id;

    try {
      const data = await API.post('/admin/students', body);
      Modal.close();
      Toast.success(`تم تسجيل ${body.first_name} بنجاح — username: ${data.credentials.username}`);
      loadStudents();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async function viewStudent(id) {
    try {
      const data = await API.get(`/admin/students/${id}`);
      const s = data.student;
      const att = data.attendance_summary;

      const content = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div>
            <h4 style="margin-bottom:12px;color:var(--accent)">البيانات الشخصية</h4>
            <div style="font-size:0.88rem;line-height:2">
              <div><strong>الاسم:</strong> ${s.first_name} ${s.last_name}</div>
              <div><strong>الهاتف:</strong> ${s.phone}</div>
              <div><strong>ولي الأمر:</strong> ${s.parent_phone || '—'}</div>
              <div><strong>البريد:</strong> ${s.email || '—'}</div>
              <div><strong>المستوى:</strong> ${s.level}</div>
              <div><strong>الحالة:</strong> ${Utils.getStatusBadge(s.status)}</div>
              <div><strong>تاريخ التسجيل:</strong> ${Utils.formatDate(s.enrollment_date)}</div>
            </div>
          </div>
          <div>
            <h4 style="margin-bottom:12px;color:var(--accent)">الحضور</h4>
            <div style="font-size:0.88rem;line-height:2">
              <div><strong>المجموع:</strong> ${att.total} حصة</div>
              <div><strong>حاضر:</strong> <span style="color:var(--success)">${att.present}</span></div>
              <div><strong>غائب:</strong> <span style="color:var(--danger)">${att.absent}</span></div>
              <div><strong>النسبة:</strong> ${att.rate}%</div>
            </div>
            <div class="progress-bar mt-12"><div class="fill green" style="width:${att.rate}%"></div></div>
          </div>
        </div>
        <h4 style="margin-top:20px;margin-bottom:12px;color:var(--accent)">الدفعات</h4>
        ${data.payments.length > 0 ? `
          <div class="table-container">
            <table class="data-table">
              <thead><tr><th>الشهر</th><th>المبلغ</th><th>الحالة</th></tr></thead>
              <tbody>
                ${data.payments.map(p => `<tr><td class="mono">${p.month}</td><td class="mono">${Utils.formatCurrency(p.amount)}</td><td>${Utils.getStatusBadge(p.status)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p style="color:var(--text-muted)">لا توجد دفعات</p>'}
      `;
      Modal.open({ title: `${s.first_name} ${s.last_name}`, content, size: 'lg' });
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async function editStudent(id) {
    try {
      const data = await API.get(`/admin/students/${id}`);
      const s = data.student;
      let courses = [];
      try { const d = await API.get('/admin/courses'); courses = d.courses || []; } catch (_) {}

      const content = `
        <form id="edit-student-form" onsubmit="AdminStudents.submitEditStudent(event, '${id}')">
          <div class="form-row">
            <div class="form-group"><label class="form-label">الاسم الأول</label><input type="text" class="form-input" name="first_name" value="${s.first_name}" required></div>
            <div class="form-group"><label class="form-label">اللقب</label><input type="text" class="form-input" name="last_name" value="${s.last_name}" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">الهاتف</label><input type="tel" class="form-input" name="phone" value="${s.phone}"></div>
            <div class="form-group"><label class="form-label">هاتف ولي الأمر</label><input type="tel" class="form-input" name="parent_phone" value="${s.parent_phone || ''}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">البريد</label><input type="email" class="form-input" name="email" value="${s.email || ''}"></div>
            <div class="form-group">
              <label class="form-label">المستوى</label>
              <select class="form-select" name="level">${Utils.getLevelOptions().map(l => `<option value="${l}" ${s.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">الدورة</label>
            <select class="form-select" name="course_id">
              <option value="">بدون دورة</option>
              ${courses.map(c => `<option value="${c.id}" ${s.course_id === c.id ? 'selected' : ''}>${c.name} (${c.level})</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">حفظ التعديلات</button>
        </form>
      `;
      Modal.open({ title: `تعديل ${s.first_name} ${s.last_name}`, content, size: 'lg' });
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async function submitEditStudent(e, id) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    if (!body.course_id) delete body.course_id;
    try {
      await API.put(`/admin/students/${id}`, body);
      Modal.close();
      Toast.success('تم تحديث بيانات التلميذ');
      loadStudents();
    } catch (err) { Toast.error(err.message); }
  }

  async function approveStudent(id) {
    const confirmed = await Modal.confirm({
      title: 'قبول التلميذ',
      message: 'هل تريد قبول هذا التلميذ؟ سيتم إنشاء حساب له وإرسال بيانات الدخول عبر البريد الإلكتروني.',
      confirmText: 'قبول',
      type: 'primary'
    });
    if (!confirmed) return;
    try {
      const data = await API.patch(`/admin/students/${id}/approve`);
      if (data.credentials) {
        Toast.success(`تم القبول — اسم المستخدم: ${data.credentials.username} / كلمة المرور: ${data.credentials.password}`);
      } else {
        Toast.success('تم قبول التلميذ بنجاح');
      }
      loadStudents();
    } catch (err) { Toast.error(err.message); }
  }

  async function deleteStudent(id) {
    const confirmed = await Modal.confirm({
      title: 'حذف التلميذ',
      message: 'هل أنت متأكد من حذف هذا التلميذ؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'حذف',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      await API.delete(`/admin/students/${id}`, { reason: 'حذف من قبل المدير' });
      Toast.success('تم حذف التلميذ');
      loadStudents();
    } catch (err) { Toast.error(err.message); }
  }

  async function exportExcel() {
    try {
      const data = await API.get('/admin/students?limit=1000');
      const rows = (data.students || []).map(s => ({
        'الاسم': `${s.first_name} ${s.last_name}`,
        'الهاتف': s.phone,
        'المستوى': s.level,
        'الدورة': s.courses ? s.courses.name : '',
        'الحالة': s.status
      }));
      await Export.toExcel(rows, `students-${new Date().toISOString().slice(0,10)}`);
    } catch (err) { Toast.error(err.message); }
  }

  async function exportPDF() {
    try {
      const data = await API.get('/admin/students?limit=1000');
      const cols = [
        { header: 'الاسم', key: 'name' },
        { header: 'الهاتف', key: 'phone' },
        { header: 'المستوى', key: 'level' },
        { header: 'الدورة', key: 'course' },
        { header: 'الحالة', key: 'status' }
      ];
      const rows = (data.students || []).map(s => ({
        name: `${s.first_name} ${s.last_name}`,
        phone: s.phone,
        level: s.level,
        course: s.courses ? s.courses.name : '',
        status: s.status
      }));
      await Export.toPDF(rows, cols, 'قائمة التلاميذ', `students-${new Date().toISOString().slice(0,10)}`);
    } catch (err) { Toast.error(err.message); }
  }

  async function exportCSV() {
    try {
      const data = await API.get('/admin/students?limit=1000');
      const rows = (data.students || []).map(s => ({
        'الاسم': `${s.first_name} ${s.last_name}`,
        'الهاتف': s.phone,
        'المستوى': s.level,
        'الدورة': s.courses ? s.courses.name : '',
        'الحالة': s.status
      }));
      Export.toCSV(rows, `students-${new Date().toISOString().slice(0,10)}`);
    } catch (err) { Toast.error(err.message); }
  }

  async function exportWord() {
    try {
      const data = await API.get('/admin/students?limit=1000');
      const cols = [
        { header: 'الاسم', key: 'name' },
        { header: 'الهاتف', key: 'phone' },
        { header: 'المستوى', key: 'level' },
        { header: 'الدورة', key: 'course' },
        { header: 'الحالة', key: 'status' }
      ];
      const rows = (data.students || []).map(s => ({
        name: `${s.first_name} ${s.last_name}`,
        phone: s.phone,
        level: s.level,
        course: s.courses ? s.courses.name : '',
        status: s.status
      }));
      Export.toWord(rows, cols, 'قائمة التلاميذ - منصة الأمير', `students-${new Date().toISOString().slice(0,10)}`);
    } catch (err) { Toast.error(err.message); }
  }

  return { render, showAddModal, submitAddStudent, viewStudent, editStudent, submitEditStudent, approveStudent, deleteStudent, onSearch, filterLevel, filterStatus, exportExcel, exportPDF, exportCSV, exportWord };
})();
