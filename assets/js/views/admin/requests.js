const AdminRequests = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">الطلبات الواردة</h2>
      <div class="tabs">
        <button class="tab-btn active" onclick="AdminRequests.filter('pending',this)">المعلقة</button>
        <button class="tab-btn" onclick="AdminRequests.filter('all',this)">الكل</button>
      </div>
      <div id="requests-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
    `;
    await load('pending');
  }

  async function load(status) {
    const container = document.getElementById('requests-container');
    try {
      const data = await API.get(`/admin/requests?status=${status}`);
      const requests = data.requests || [];
      if (requests.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#128233;</div><div class="title">لا توجد طلبات</div></div>';
        return;
      }
      container.innerHTML = requests.map(r => `
        <div class="card mb-16" style="animation:fadeIn 0.3s ease">
          <div class="flex items-center justify-between mb-16">
            <div>
              <span class="badge badge-info">${translateType(r.type)}</span>
              ${Utils.getStatusBadge(r.status)}
            </div>
            <span style="font-size:0.78rem;color:var(--text-muted)" class="mono">${Utils.formatDate(r.created_at)}</span>
          </div>
          <p style="margin-bottom:8px"><strong>السبب:</strong> ${Utils.escapeHtml(r.reason)}</p>
          ${r.students ? `<p style="margin-bottom:8px"><strong>التلميذ:</strong> ${r.students.first_name} ${r.students.last_name}</p>` : ''}
          ${r.response ? `<p style="margin-bottom:8px"><strong>الرد:</strong> ${Utils.escapeHtml(r.response)}</p>` : ''}
          ${r.status === 'pending' ? `
            <div class="flex gap-8 mt-12">
              <button class="btn btn-success btn-sm" onclick="AdminRequests.resolve('${r.id}','approve')">&#10003; قبول</button>
              <button class="btn btn-danger btn-sm" onclick="AdminRequests.resolve('${r.id}','reject')">&#10007; رفض</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function filter(status, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    load(status);
  }

  async function resolve(id, action) {
    const response = action === 'reject' ? prompt('سبب الرفض:') : (prompt('رد (اختياري):') || '');
    if (action === 'reject' && !response) { Toast.warning('سبب الرفض مطلوب'); return; }
    try {
      await API.patch(`/admin/requests/${id}/resolve`, { action, response });
      Toast.success(action === 'approve' ? 'تم القبول' : 'تم الرفض');
      load('pending');
    } catch (err) { Toast.error(err.message); }
  }

  function translateType(type) {
    const map = { expel_request: 'طلب طرد', add_student: 'طلب إضافة', schedule_change: 'تغيير جدول', note_approval: 'ملاحظة', other: 'أخرى' };
    return map[type] || type;
  }

  return { render, filter, resolve };
})();
