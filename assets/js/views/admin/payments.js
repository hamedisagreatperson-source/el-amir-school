const AdminPayments = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20">
        <h2 style="font-size:1.1rem">متابعة الدفع</h2>
        <button class="btn btn-warning btn-sm" onclick="AdminPayments.remindAll()">&#128276; تذكير الجميع</button>
      </div>
      <div class="filters-bar">
        <input type="month" class="form-input" style="width:auto" value="${Utils.getCurrentMonth()}" onchange="AdminPayments.filterMonth(this.value)">
        <select class="form-select" onchange="AdminPayments.filterStatus(this.value)">
          <option value="">كل الحالات</option>
          <option value="paid">مدفوع</option>
          <option value="unpaid">غير مدفوع</option>
          <option value="pending_verification">في انتظار التأكيد</option>
        </select>
      </div>
      <div id="payment-summary" class="grid grid-4 mb-20"></div>
      <div id="payments-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
    `;
    await loadPayments();
  }

  let currentFilters = { month: Utils.getCurrentMonth() };

  async function loadPayments() {
    const container = document.getElementById('payments-container');
    const summaryEl = document.getElementById('payment-summary');
    try {
      const params = new URLSearchParams(currentFilters);
      const data = await API.get(`/admin/payments?${params}`);
      const payments = data.payments || [];
      const s = data.summary;

      summaryEl.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">&#128100;</div><div><div class="stat-value">${data.total}</div><div class="stat-label">إجمالي التلاميذ</div></div></div>
        <div class="stat-card"><div class="stat-icon green">&#128176;</div><div><div class="stat-value">${Utils.formatCurrency(s.collected)}</div><div class="stat-label">المحصّل</div></div></div>
        <div class="stat-card"><div class="stat-icon red">&#128176;</div><div><div class="stat-value">${Utils.formatCurrency(s.remaining)}</div><div class="stat-label">المتبقي</div></div></div>
        <div class="stat-card"><div class="stat-icon gold">&#128176;</div><div><div class="stat-value">${Utils.formatCurrency(s.total_expected)}</div><div class="stat-label">الإجمالي المتوقع</div></div></div>
      `;

      if (payments.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#128176;</div><div class="title">لا توجد دفعات</div></div>';
        return;
      }

      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>التلميذ</th><th>الدورة</th><th>المبلغ</th><th>الشهر</th><th>الحالة</th><th>الإثبات</th><th>الإجراءات</th></tr></thead>
            <tbody>
              ${payments.map(p => `
                <tr>
                  <td>${p.students ? `${p.students.first_name} ${p.students.last_name}` : '—'}</td>
                  <td>${p.courses ? p.courses.name : '—'}</td>
                  <td class="mono">${Utils.formatCurrency(p.amount)}</td>
                  <td class="mono">${p.month}</td>
                  <td>${Utils.getStatusBadge(p.status)}</td>
                  <td>${p.proof_url ? `<a href="${p.proof_url}" target="_blank" class="btn btn-ghost btn-sm">&#128065; عرض</a>` : '—'}</td>
                  <td>
                    <div style="display:flex;gap:4px">
                      ${p.status !== 'paid' ? `<button class="btn btn-success btn-sm" onclick="AdminPayments.verify('${p.id}','paid')">&#10003; تأكيد</button>` : ''}
                      ${p.status === 'paid' ? `<button class="btn btn-outline btn-sm" onclick="AdminPayments.verify('${p.id}','unpaid')">إلغاء</button>` : ''}
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

  function filterMonth(v) { currentFilters.month = v; loadPayments(); }
  function filterStatus(v) { currentFilters.status = v || undefined; loadPayments(); }

  async function verify(id, status) {
    try {
      await API.patch(`/admin/payments/${id}/verify`, { status });
      Toast.success(status === 'paid' ? 'تم تأكيد الدفع' : 'تم إلغاء التأكيد');
      loadPayments();
    } catch (err) { Toast.error(err.message); }
  }

  async function remindAll() {
    try {
      const data = await API.post('/admin/payments/remind', {});
      Toast.success(`تم إرسال ${data.sent_count} تذكير`);
    } catch (err) { Toast.error(err.message); }
  }

  return { render, filterMonth, filterStatus, verify, remindAll };
})();
