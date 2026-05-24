const AdminEmails = (() => {
  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">إرسال الإيميلات</h2>
      <div class="card">
        <form onsubmit="AdminEmails.send(event)">
          <div class="form-group">
            <label class="form-label">إرسال إلى</label>
            <select class="form-select" name="target" id="email-target">
              <option value="all">الجميع</option>
              <option value="students">كل التلاميذ</option>
              <option value="teachers">كل الأساتذة</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">الموضوع *</label>
            <input type="text" class="form-input" name="subject" required>
          </div>
          <div class="form-group">
            <label class="form-label">الرسالة *</label>
            <textarea class="form-textarea" name="message" rows="6" required placeholder="يمكنك استخدام {name} لاسم المرسل إليه"></textarea>
          </div>
          <button type="submit" class="btn btn-accent">&#9993; إرسال</button>
        </form>
      </div>
    `;
  }

  async function send(e) {
    e.preventDefault();
    const form = e.target;
    const body = {
      target: form.target.value,
      subject: form.subject.value,
      message: form.message.value
    };
    try {
      const data = await API.post('/admin/emails/send', body);
      Toast.success(`تم إرسال ${data.sent_count} إيميل`);
      form.reset();
    } catch (err) { Toast.error(err.message); }
  }

  return { render, send };
})();
