const StudentPayments = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    try {
      const data = await API.get('/student/payments');
      const payments = data.payments || [];

      if (payments.length === 0) {
        page.innerHTML = '<div class="empty-state"><div class="icon">&#128176;</div><div class="title">لا توجد دفعات</div></div>';
        return;
      }

      page.innerHTML = `
        ${payments.map(p => `
          <div class="payment-card">
            <div>
              <div class="month">${p.month}</div>
              <div style="font-size:0.82rem;color:var(--text-muted)">${p.courses ? p.courses.name : ''}</div>
            </div>
            <div class="amount">${Utils.formatCurrency(p.amount)}</div>
            <div>${Utils.getStatusBadge(p.status)}</div>
            <div>
              ${p.status === 'unpaid' ? `
                <div class="upload-zone" onclick="document.getElementById('proof-${p.id}').click()" style="padding:12px;cursor:pointer">
                  <div style="font-size:0.85rem;color:var(--text-muted)">&#128228; رفع إثبات</div>
                  <input type="file" id="proof-${p.id}" accept="image/*,.pdf" style="display:none" onchange="StudentPayments.uploadProof('${p.id}', this)">
                </div>
              ` : p.status === 'pending_verification' ? '<span style="font-size:0.82rem;color:var(--warning)">في انتظار التأكيد</span>' : ''}
              ${p.proof_url ? `<a href="${p.proof_url}" target="_blank" class="btn btn-ghost btn-sm">&#128065; عرض الإثبات</a>` : ''}
            </div>
          </div>
        `).join('')}
      `;
    } catch (err) {
      page.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  async function uploadProof(paymentId, input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('proof', file);

    try {
      await API.upload(`/student/payments/${paymentId}/proof`, formData);
      Toast.success('تم رفع الإثبات بنجاح');
      render();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  return { render, uploadProof };
})();
