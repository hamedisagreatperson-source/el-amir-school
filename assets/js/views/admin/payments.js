const AdminPayments = (() => {
  let currentFilters = { month: Utils.getCurrentMonth() };
  let currentPage = 1;
  let allCourses = [];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20 payments-header">
        <h2 style="font-size:1.1rem">&#128176; متابعة الدفع</h2>
        <div class="payments-actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-accent btn-sm" onclick="AdminPayments.showGenerateModal()">&#128260; توليد دفعات الشهر</button>
          <button class="btn btn-primary btn-sm" onclick="AdminPayments.showAddPaymentModal()">&#10010; إضافة دفع يدوي</button>
          <button class="btn btn-warning btn-sm" onclick="AdminPayments.remindAll()">&#128276; تذكير الجميع</button>
          <button class="btn btn-outline btn-sm" onclick="AdminPayments.exportPayments()">&#128229; تصدير</button>
        </div>
      </div>

      <div id="payment-summary" class="grid grid-4 mb-20"></div>

      <div class="card mb-20">
        <div class="filters-bar payments-filters">
          <input type="month" class="form-input" style="width:auto" id="payment-month-filter" value="${Utils.getCurrentMonth()}" onchange="AdminPayments.filterMonth(this.value)">
          <select class="form-select" id="payment-status-filter" onchange="AdminPayments.filterStatus(this.value)">
            <option value="">كل الحالات</option>
            <option value="paid">&#9989; مدفوع</option>
            <option value="unpaid">&#10060; غير مدفوع</option>
            <option value="pending_verification">&#9203; في انتظار التأكيد</option>
          </select>
          <select class="form-select" id="payment-course-filter" onchange="AdminPayments.filterCourse(this.value)">
            <option value="">كل الدورات</option>
          </select>
          <div class="search-input-wrapper" style="position:relative;flex:1;min-width:180px;max-width:300px">
            <input type="text" class="form-input search-input" placeholder="&#128269; بحث بالاسم..." oninput="AdminPayments.searchStudents(this.value)" id="payment-search">
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
      const params = new URLSearchParams({ ...currentFilters, page: currentPage });
      const data = await API.get(`/admin/payments?${params}`);
      const payments = data.payments || [];
      const s = data.summary;
      const paidCount = payments.filter(p => p.status === 'paid').length;
      const unpaidCount = payments.filter(p => p.status === 'unpaid').length;
      const pendingCount = payments.filter(p => p.status === 'pending_verification').length;

      summaryEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon blue">&#128100;</div>
          <div>
            <div class="stat-value">${data.total}</div>
            <div class="stat-label">إجمالي السجلات</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">&#9989;</div>
          <div>
            <div class="stat-value">${Utils.formatCurrency(s.collected)}</div>
            <div class="stat-label">المحصّل (${paidCount} دفعة)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">&#10060;</div>
          <div>
            <div class="stat-value">${Utils.formatCurrency(s.remaining)}</div>
            <div class="stat-label">المتبقي (${unpaidCount} غير مدفوع)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon gold">&#128176;</div>
          <div>
            <div class="stat-value">${Utils.formatCurrency(s.total_expected)}</div>
            <div class="stat-label">الإجمالي المتوقع</div>
            <div class="progress-bar mt-12" style="height:6px">
              <div class="fill green" style="width:${s.total_expected > 0 ? Math.round((s.collected / s.total_expected) * 100) : 0}%"></div>
            </div>
          </div>
        </div>
      `;

      if (payments.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#128176;</div><div class="title">لا توجد دفعات</div><div class="description">لا توجد سجلات دفع تطابق الفلاتر المحددة</div></div>';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
      }

      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>التلميذ</th>
                <th>الهاتف</th>
                <th>الدورة</th>
                <th>المبلغ</th>
                <th>الشهر</th>
                <th>الحالة</th>
                <th>الإثبات</th>
                <th>تاريخ التأكيد</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => `
                <tr class="payment-row ${p.status}">
                  <td>
                    <div style="font-weight:600">${p.students ? `${p.students.first_name} ${p.students.last_name}` : '—'}</div>
                  </td>
                  <td class="mono" style="font-size:0.82rem">${p.students && p.students.phone ? p.students.phone : '—'}</td>
                  <td>${p.courses ? p.courses.name : '—'}</td>
                  <td class="mono" style="font-weight:600">${Utils.formatCurrency(p.amount)}</td>
                  <td class="mono">${p.month}</td>
                  <td>${Utils.getStatusBadge(p.status)}</td>
                  <td>${p.proof_url ? `<a href="${p.proof_url}" target="_blank" class="btn btn-ghost btn-sm">&#128065; عرض</a>` : '<span style="color:var(--text-muted);font-size:0.8rem">لا يوجد</span>'}</td>
                  <td class="mono" style="font-size:0.78rem">${p.verified_at ? Utils.formatDate(p.verified_at) : '—'}</td>
                  <td>
                    <div class="payment-actions-cell">
                      ${p.status !== 'paid' ? `<button class="btn btn-success btn-sm" onclick="AdminPayments.verify('${p.id}','paid')" title="تأكيد الدفع">&#10003; تأكيد</button>` : ''}
                      ${p.status === 'paid' ? `<button class="btn btn-outline btn-sm" onclick="AdminPayments.verify('${p.id}','unpaid')" title="إلغاء التأكيد">&#10007; إلغاء</button>` : ''}
                      ${p.status === 'unpaid' ? `<button class="btn btn-warning btn-sm" onclick="AdminPayments.remindOne('${p.student_id}')" title="إرسال تذكير">&#128276;</button>` : ''}
                      <button class="btn btn-ghost btn-sm" onclick="AdminPayments.showPaymentDetails('${p.id}')" title="التفاصيل">&#128196;</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      if (paginationEl && data.pages > 1) {
        paginationEl.innerHTML = Utils.generatePagination(data.page, data.pages);
        paginationEl.querySelectorAll('.page-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            currentPage = Number(btn.dataset.page);
            loadPayments();
          });
        });
      } else if (paginationEl) {
        paginationEl.innerHTML = '';
      }
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="icon">&#9888;</div><div class="title">خطأ في تحميل البيانات</div><div class="description">${err.message}</div></div>`;
    }
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
      Toast.success(status === 'paid' ? '&#9989; تم تأكيد الدفع بنجاح' : 'تم إلغاء التأكيد');
      loadPayments();
    } catch (err) { Toast.error(err.message); }
  }

  async function remindAll() {
    if (!confirm('هل تريد إرسال تذكير لكل الطلاب الذين لم يدفعوا؟')) return;
    try {
      const data = await API.post('/admin/payments/remind', {});
      Toast.success(`&#128276; تم إرسال ${data.sent_count} تذكير بنجاح`);
    } catch (err) { Toast.error(err.message); }
  }

  async function remindOne(studentId) {
    try {
      const data = await API.post('/admin/payments/remind', { student_ids: [studentId] });
      Toast.success('&#128276; تم إرسال التذكير');
    } catch (err) { Toast.error(err.message); }
  }

  function showAddPaymentModal() {
    const coursesOptions = allCourses.map(c => `<option value="${c.id}" data-price="${c.price}">${c.name} (${c.level})</option>`).join('');
    Modal.show({
      title: '&#10010; إضافة دفع يدوي',
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
    if (!courseId) {
      studentSelect.innerHTML = '<option value="">اختر الدورة أولاً</option>';
      return;
    }

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

    if (!courseId || !studentId || !month || !amount) {
      Toast.warning('يرجى ملء جميع الحقول');
      return;
    }

    try {
      await API.post('/admin/payments', {
        student_id: studentId,
        course_id: courseId,
        month,
        amount: Number(amount),
        status
      });
      Toast.success('&#9989; تم إضافة سجل الدفع بنجاح');
      Modal.close();
      loadPayments();
    } catch (err) { Toast.error(err.message); }
  }

  function showGenerateModal() {
    Modal.show({
      title: '&#128260; توليد دفعات الشهر',
      body: `
        <p style="color:var(--text-muted);margin-bottom:16px;font-size:0.9rem">سيتم إنشاء سجلات دفع "غير مدفوع" لكل التلاميذ النشطين المسجلين في دورات. السجلات الموجودة مسبقاً لن تتأثر.</p>
        <div class="form-group">
          <label class="form-label">الشهر</label>
          <input type="month" class="form-input" id="gen-pay-month" value="${Utils.getCurrentMonth()}">
        </div>
      `,
      confirmText: '&#128260; توليد',
      onConfirm: generatePayments
    });
  }

  async function generatePayments() {
    const month = document.getElementById('gen-pay-month').value;
    if (!month) { Toast.warning('اختر الشهر'); return; }

    try {
      const data = await API.post('/admin/payments/generate', { month });
      Toast.success(`&#9989; تم توليد ${data.count} سجل دفع`);
      Modal.close();
      loadPayments();
    } catch (err) { Toast.error(err.message); }
  }

  function showPaymentDetails(paymentId) {
    const container = document.getElementById('payments-container');
    const rows = container.querySelectorAll('.payment-row');
    let payment = null;
    rows.forEach(row => {
      const verifyBtn = row.querySelector('[onclick*="' + paymentId + '"]');
      if (verifyBtn) {
        const cells = row.querySelectorAll('td');
        payment = {
          student: cells[0] ? cells[0].textContent.trim() : '—',
          phone: cells[1] ? cells[1].textContent.trim() : '—',
          course: cells[2] ? cells[2].textContent.trim() : '—',
          amount: cells[3] ? cells[3].textContent.trim() : '—',
          month: cells[4] ? cells[4].textContent.trim() : '—',
          status: cells[5] ? cells[5].textContent.trim() : '—',
          verified: cells[7] ? cells[7].textContent.trim() : '—'
        };
      }
    });

    if (!payment) { Toast.error('لم يتم العثور على بيانات الدفعة'); return; }

    Modal.show({
      title: '&#128196; تفاصيل الدفعة',
      body: `
        <div class="payment-details-grid">
          <div class="detail-row"><span class="detail-label">التلميذ</span><span class="detail-value">${payment.student}</span></div>
          <div class="detail-row"><span class="detail-label">الهاتف</span><span class="detail-value mono">${payment.phone}</span></div>
          <div class="detail-row"><span class="detail-label">الدورة</span><span class="detail-value">${payment.course}</span></div>
          <div class="detail-row"><span class="detail-label">المبلغ</span><span class="detail-value mono" style="font-weight:700;color:var(--accent)">${payment.amount}</span></div>
          <div class="detail-row"><span class="detail-label">الشهر</span><span class="detail-value mono">${payment.month}</span></div>
          <div class="detail-row"><span class="detail-label">الحالة</span><span class="detail-value">${payment.status}</span></div>
          <div class="detail-row"><span class="detail-label">تاريخ التأكيد</span><span class="detail-value mono">${payment.verified}</span></div>
        </div>
      `,
      confirmText: 'إغلاق',
      onConfirm: () => Modal.close()
    });
  }

  function exportPayments() {
    const table = document.querySelector('#payments-container .data-table');
    if (!table) { Toast.warning('لا توجد بيانات للتصدير'); return; }

    try {
      const rows = table.querySelectorAll('tbody tr');
      const data = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        data.push({
          'التلميذ': cells[0] ? cells[0].textContent.trim() : '',
          'الهاتف': cells[1] ? cells[1].textContent.trim() : '',
          'الدورة': cells[2] ? cells[2].textContent.trim() : '',
          'المبلغ': cells[3] ? cells[3].textContent.trim() : '',
          'الشهر': cells[4] ? cells[4].textContent.trim() : '',
          'الحالة': cells[5] ? cells[5].textContent.trim() : '',
          'تاريخ التأكيد': cells[7] ? cells[7].textContent.trim() : ''
        });
      });

      if (data.length === 0) { Toast.warning('لا توجد بيانات'); return; }
      Export.toExcel(data, `payments-${currentFilters.month || 'all'}`);
    } catch (err) { Toast.error('خطأ في التصدير: ' + err.message); }
  }

  return {
    render, filterMonth, filterStatus, filterCourse, searchStudents,
    verify, remindAll, remindOne, showAddPaymentModal, onCourseSelect,
    showGenerateModal, showPaymentDetails, exportPayments
  };
})();
