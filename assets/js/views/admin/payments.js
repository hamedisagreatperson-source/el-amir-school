const AdminPayments = (() => {
  let currentFilters = { month: Utils.getCurrentMonth() };
  let currentPage = 1;
  let allCourses = [];
  let allPayments = [];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20 payments-header">
        <h2 style="font-size:1.1rem">${Icons.payments} متابعة الدفع</h2>
        <div class="payments-actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-accent btn-sm" onclick="AdminPayments.showGenerateModal()">${Icons.generate} توليد دفعات الشهر</button>
          <button class="btn btn-primary btn-sm" onclick="AdminPayments.showAddPaymentModal()">${Icons.add} إضافة دفع يدوي</button>
          <button class="btn btn-warning btn-sm" onclick="AdminPayments.remindAll()">${Icons.remind} تذكير الجميع</button>
          <button class="btn btn-outline btn-sm" onclick="AdminPayments.exportPayments()">${Icons.export} تصدير</button>
        </div>
      </div>

      <div id="payment-summary" class="grid grid-4 mb-20"></div>

      <div class="card mb-20">
        <div class="filters-bar payments-filters">
          <input type="month" class="form-input" style="width:auto" id="payment-month-filter" value="${Utils.getCurrentMonth()}" onchange="AdminPayments.filterMonth(this.value)">
          <select class="form-select" id="payment-status-filter" onchange="AdminPayments.filterStatus(this.value)">
            <option value="">كل الحالات</option>
            <option value="paid">مدفوع</option>
            <option value="unpaid">غير مدفوع</option>
            <option value="pending_verification">في انتظار التأكيد</option>
          </select>
          <select class="form-select" id="payment-course-filter" onchange="AdminPayments.filterCourse(this.value)">
            <option value="">كل الدورات</option>
          </select>
          <div class="search-input-wrapper" style="position:relative;flex:1;min-width:180px;max-width:300px">
            <input type="text" class="form-input search-input" placeholder="بحث بالاسم..." oninput="AdminPayments.searchStudents(this.value)" id="payment-search">
          </div>
        </div>
      </div>

      <div id="payments-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
      <div id="payments-pagination"></div>
    `;
    await loadCourses();
    await loadPayments();
  }

  async function loadCourses() {
    try {
      const data = await API.get('/admin/courses');
      allCourses = data.courses || [];
      const select = document.getElementById('payment-course-filter');
      if (select) {
        allCourses.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `${c.name} (${c.level})`;
          select.appendChild(opt);
        });
      }
    } catch (_) {}
  }

  async function loadPayments() {
    const container = document.getElementById('payments-container');
    const summaryEl = document.getElementById('payment-summary');
    const paginationEl = document.getElementById('payments-pagination');
    try {
      const params = new URLSearchParams({ ...currentFilters, page: currentPage, limit: 200 });
      const data = await API.get(`/admin/payments?${params}`);
      allPayments = data.payments || [];
      const s = data.summary;
      const paidCount = allPayments.filter(p => p.status === 'paid').length;
      const unpaidCount = allPayments.filter(p => p.status === 'unpaid').length;
      const pendingCount = allPayments.filter(p => p.status === 'pending_verification').length;

      summaryEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon blue">${Icons.students}</div>
          <div>
            <div class="stat-value">${data.total}</div>
            <div class="stat-label">إجمالي السجلات</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">${Icons.check}</div>
          <div>
            <div class="stat-value">${Utils.formatCurrency(s.collected)}</div>
            <div class="stat-label">المحصّل (${paidCount} دفعة)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">${Icons.cross}</div>
          <div>
            <div class="stat-value">${Utils.formatCurrency(s.remaining)}</div>
            <div class="stat-label">المتبقي (${unpaidCount} غير مدفوع)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon gold">${Icons.money}</div>
          <div>
            <div class="stat-value">${Utils.formatCurrency(s.total_expected)}</div>
            <div class="stat-label">الإجمالي المتوقع</div>
            <div class="progress-bar mt-12" style="height:6px">
              <div class="fill green" style="width:${s.total_expected > 0 ? Math.round((s.collected / s.total_expected) * 100) : 0}%"></div>
            </div>
          </div>
        </div>
      `;

      if (allPayments.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">${Icons.payments}</div><div class="title">لا توجد دفعات</div><div class="description">لا توجد سجلات دفع تطابق الفلاتر المحددة</div></div>`;
        if (paginationEl) paginationEl.innerHTML = '';
        return;
      }

      // Group payments by student
      const byStudent = {};
      allPayments.forEach(p => {
        const sid = p.student_id;
        if (!byStudent[sid]) {
          byStudent[sid] = {
            name: p.students ? `${p.students.first_name} ${p.students.last_name}` : '—',
            phone: p.students && p.students.phone ? p.students.phone : '',
            payments: []
          };
        }
        byStudent[sid].payments.push(p);
      });

      // Build the grid cards
      let html = '<div class="payment-grid">';
      Object.keys(byStudent).forEach(sid => {
        const st = byStudent[sid];
        html += `<div class="payment-student-card card">
          <div class="psc-header">
            <div class="psc-info">
              <div class="psc-name">${st.name}</div>
              ${st.phone ? `<div class="psc-phone mono">${st.phone}</div>` : ''}
            </div>
          </div>
          <div class="psc-squares">`;
        st.payments.forEach(p => {
          const courseName = p.courses ? p.courses.name : '—';
          const teacherName = p.courses && p.courses.teachers ? p.courses.teachers.full_name : '—';
          const isPaid = p.status === 'paid';
          const isPending = p.status === 'pending_verification';
          const cls = isPaid ? 'paid' : isPending ? 'pending' : 'unpaid';
          html += `
            <div class="pay-square ${cls}" title="${courseName} - ${p.month}" onclick="AdminPayments.togglePay('${p.id}','${p.status}')">
              <div class="pay-square-check">${isPaid ? Icons.check : isPending ? Icons.clock : ''}</div>
              <div class="pay-square-course">${courseName}</div>
              <div class="pay-square-teacher">${teacherName}</div>
              <div class="pay-square-amount">${Utils.formatCurrency(p.amount)}</div>
            </div>`;
        });
        html += `</div></div>`;
      });
      html += '</div>';
      container.innerHTML = html;

      if (paginationEl && data.pages > 1) {
        paginationEl.innerHTML = Utils.generatePagination(data.page, data.pages);
        paginationEl.querySelectorAll('.page-btn').forEach(btn => {
          btn.addEventListener('click', () => { currentPage = Number(btn.dataset.page); loadPayments(); });
        });
      } else if (paginationEl) {
        paginationEl.innerHTML = '';
      }
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="icon">${Icons.warning}</div><div class="title">خطأ في تحميل البيانات</div><div class="description">${err.message}</div></div>`;
    }
  }

  async function togglePay(id, currentStatus) {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await API.patch(`/admin/payments/${id}/verify`, { status: newStatus });
      Toast.success(newStatus === 'paid' ? 'تم تأكيد الدفع' : 'تم إلغاء التأكيد');
      loadPayments();
    } catch (err) { Toast.error(err.message); }
  }

  function filterMonth(v) { currentFilters.month = v; currentPage = 1; loadPayments(); }
  function filterStatus(v) { if (v) currentFilters.status = v; else delete currentFilters.status; currentPage = 1; loadPayments(); }
  function filterCourse(v) { if (v) currentFilters.course_id = v; else delete currentFilters.course_id; currentPage = 1; loadPayments(); }

  const searchStudents = Utils.debounce(function(v) {
    if (v) currentFilters.search = v; else delete currentFilters.search;
    currentPage = 1;
    loadPayments();
  }, 400);

  async function verify(id, status) {
    try {
      await API.patch(`/admin/payments/${id}/verify`, { status });
      Toast.success(status === 'paid' ? 'تم تأكيد الدفع بنجاح' : 'تم إلغاء التأكيد');
      loadPayments();
    } catch (err) { Toast.error(err.message); }
  }

  async function remindAll() {
    if (!confirm('هل تريد إرسال تذكير لكل الطلاب الذين لم يدفعوا؟')) return;
    try {
      const data = await API.post('/admin/payments/remind', {});
      Toast.success(`تم إرسال ${data.sent_count} تذكير بنجاح`);
    } catch (err) { Toast.error(err.message); }
  }

  async function remindOne(studentId) {
    try {
      const data = await API.post('/admin/payments/remind', { student_ids: [studentId] });
      Toast.success('تم إرسال التذكير');
    } catch (err) { Toast.error(err.message); }
  }

  function showAddPaymentModal() {
    const coursesOptions = allCourses.map(c => `<option value="${c.id}" data-price="${c.price}">${c.name} (${c.level})</option>`).join('');
    Modal.show({
      title: `${Icons.add} إضافة دفع يدوي`,
      body: `
        <div class="form-group">
          <label class="form-label">الدورة</label>
          <select class="form-select" id="add-pay-course" onchange="AdminPayments.onCourseSelect()">
            <option value="">اختر الدورة</option>
            ${coursesOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">التلميذ</label>
          <select class="form-select" id="add-pay-student">
            <option value="">اختر الدورة أولاً</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">الشهر</label>
            <input type="month" class="form-input" id="add-pay-month" value="${Utils.getCurrentMonth()}">
          </div>
          <div class="form-group">
            <label class="form-label">المبلغ (دج)</label>
            <input type="number" class="form-input" id="add-pay-amount" placeholder="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">الحالة</label>
          <select class="form-select" id="add-pay-status">
            <option value="unpaid">غير مدفوع</option>
            <option value="paid">مدفوع</option>
            <option value="pending_verification">في انتظار التأكيد</option>
          </select>
        </div>
      `,
      confirmText: 'حفظ',
      onConfirm: addPayment
    });
  }

  async function onCourseSelect() {
    const courseId = document.getElementById('add-pay-course').value;
    const studentSelect = document.getElementById('add-pay-student');
    const amountInput = document.getElementById('add-pay-amount');
    if (!courseId) { studentSelect.innerHTML = '<option value="">اختر الدورة أولاً</option>'; return; }

    const course = allCourses.find(c => c.id === courseId);
    if (course && amountInput) amountInput.value = course.price || 0;

    try {
      const data = await API.get(`/admin/students?course_id=${courseId}&limit=200`);
      const students = data.students || [];
      studentSelect.innerHTML = '<option value="">اختر التلميذ</option>' +
        students.map(s => `<option value="${s.id}">${s.first_name} ${s.last_name}</option>`).join('');
    } catch (_) {
      studentSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
    }
  }

  async function addPayment() {
    const courseId = document.getElementById('add-pay-course').value;
    const studentId = document.getElementById('add-pay-student').value;
    const month = document.getElementById('add-pay-month').value;
    const amount = document.getElementById('add-pay-amount').value;
    const status = document.getElementById('add-pay-status').value;

    if (!courseId || !studentId || !month || !amount) { Toast.warning('يرجى ملء جميع الحقول'); return; }

    try {
      await API.post('/admin/payments', { student_id: studentId, course_id: courseId, month, amount: Number(amount), status });
      Toast.success('تم إضافة سجل الدفع بنجاح');
      Modal.close();
      loadPayments();
    } catch (err) { Toast.error(err.message); }
  }

  function showGenerateModal() {
    Modal.show({
      title: `${Icons.generate} توليد دفعات الشهر`,
      body: `
        <p style="color:var(--text-muted);margin-bottom:16px;font-size:0.9rem">سيتم إنشاء سجلات دفع "غير مدفوع" لكل التلاميذ النشطين المسجلين في دورات. السجلات الموجودة مسبقاً لن تتأثر.</p>
        <div class="form-group">
          <label class="form-label">الشهر</label>
          <input type="month" class="form-input" id="gen-pay-month" value="${Utils.getCurrentMonth()}">
        </div>
      `,
      confirmText: 'توليد',
      onConfirm: generatePayments
    });
  }

  async function generatePayments() {
    const month = document.getElementById('gen-pay-month').value;
    if (!month) { Toast.warning('اختر الشهر'); return; }
    try {
      const data = await API.post('/admin/payments/generate', { month });
      Toast.success(`تم توليد ${data.count} سجل دفع`);
      Modal.close();
      loadPayments();
    } catch (err) { Toast.error(err.message); }
  }

  function exportPayments() {
    if (allPayments.length === 0) { Toast.warning('لا توجد بيانات للتصدير'); return; }
    try {
      const data = allPayments.map(p => ({
        'التلميذ': p.students ? `${p.students.first_name} ${p.students.last_name}` : '',
        'الهاتف': p.students && p.students.phone ? p.students.phone : '',
        'الدورة': p.courses ? p.courses.name : '',
        'المبلغ': p.amount || 0,
        'الشهر': p.month,
        'الحالة': p.status === 'paid' ? 'مدفوع' : p.status === 'unpaid' ? 'غير مدفوع' : 'في انتظار التأكيد'
      }));
      Export.toExcel(data, `payments-${currentFilters.month || 'all'}`);
    } catch (err) { Toast.error('خطأ في التصدير: ' + err.message); }
  }

  return {
    render, filterMonth, filterStatus, filterCourse, searchStudents,
    verify, remindAll, remindOne, showAddPaymentModal, onCourseSelect,
    showGenerateModal, exportPayments, togglePay
  };
})();
