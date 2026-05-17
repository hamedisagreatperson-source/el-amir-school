const RegisterView = (() => {
  let courses = [];

  async function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:var(--bg-dark)">
        <div style="width:100%;max-width:560px;animation:fadeIn 0.4s ease">
          <div style="text-align:center;margin-bottom:32px">
            <div class="float-animation" style="width:80px;height:80px;margin:0 auto 16px;border-radius:20px;background:linear-gradient(135deg,var(--accent),var(--accent-dark));display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;color:var(--primary-dark)">م</div>
            <h1 style="font-size:1.5rem;margin-bottom:4px">تسجيل تلميذ جديد</h1>
            <p style="color:var(--text-muted);font-size:0.9rem">سجّل بياناتك وسيقوم المدير بمراجعة طلبك</p>
          </div>

          <form id="register-form" onsubmit="RegisterView.handleRegister(event)">
            <div class="card" style="padding:24px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div class="form-group">
                  <label class="form-label">الاسم الأول *</label>
                  <input type="text" class="form-input" id="reg-first-name" placeholder="الاسم الأول" required minlength="2">
                </div>
                <div class="form-group">
                  <label class="form-label">اللقب *</label>
                  <input type="text" class="form-input" id="reg-last-name" placeholder="اللقب" required minlength="2">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">رقم الهاتف *</label>
                <input type="tel" class="form-input" id="reg-phone" placeholder="0xxxxxxxxx" required>
              </div>

              <div class="form-group">
                <label class="form-label">رقم هاتف الولي</label>
                <input type="tel" class="form-input" id="reg-parent-phone" placeholder="رقم هاتف الولي (اختياري)">
              </div>

              <div class="form-group">
                <label class="form-label">البريد الإلكتروني</label>
                <input type="email" class="form-input" id="reg-email" placeholder="البريد الإلكتروني (اختياري)">
              </div>

              <div class="form-group">
                <label class="form-label">المستوى الدراسي *</label>
                <select class="form-select" id="reg-level" required>
                  <option value="">اختر المستوى</option>
                  <option value="1AM">1AM - السنة الأولى متوسط</option>
                  <option value="2AM">2AM - السنة الثانية متوسط</option>
                  <option value="3AM">3AM - السنة الثالثة متوسط</option>
                  <option value="4AM">4AM - السنة الرابعة متوسط</option>
                  <option value="1AS">1AS - السنة الأولى ثانوي</option>
                  <option value="2AS">2AS - السنة الثانية ثانوي</option>
                  <option value="3AS">3AS - السنة الثالثة ثانوي</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">الدورة المطلوبة *</label>
                <select class="form-select" id="reg-course" required>
                  <option value="">جاري تحميل الدورات...</option>
                </select>
              </div>

              <div id="register-error" style="display:none;color:var(--danger);font-size:0.85rem;margin-bottom:12px;padding:10px;background:rgba(231,76,60,0.1);border-radius:8px"></div>
              <div id="register-success" style="display:none;color:var(--success);font-size:0.85rem;margin-bottom:12px;padding:10px;background:rgba(39,174,96,0.1);border-radius:8px"></div>

              <button type="submit" class="btn btn-accent btn-lg" style="width:100%" id="register-btn">
                إرسال طلب التسجيل
              </button>

              <div style="text-align:center;margin-top:16px">
                <a href="#/login" style="font-size:0.85rem;color:var(--text-muted)">لديك حساب؟ سجّل دخولك</a>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    loadCourses();
  }

  async function loadCourses() {
    const select = document.getElementById('reg-course');
    try {
      const data = await API.get('/public/courses');
      courses = data.courses || [];
      if (courses.length === 0) {
        select.innerHTML = '<option value="">لا توجد دورات متاحة حالياً</option>';
        return;
      }
      select.innerHTML = '<option value="">اختر الدورة</option>' +
        courses.map(c => `<option value="${c.id}">${c.name} - ${c.subject} (${c.level}) | ${c.available_seats} مقعد متاح</option>`).join('');
    } catch (err) {
      select.innerHTML = '<option value="">خطأ في تحميل الدورات</option>';
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const errorEl = document.getElementById('register-error');
    const successEl = document.getElementById('register-success');
    const btn = document.getElementById('register-btn');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جاري الإرسال...';

    const body = {
      first_name: document.getElementById('reg-first-name').value.trim(),
      last_name: document.getElementById('reg-last-name').value.trim(),
      phone: document.getElementById('reg-phone').value.trim(),
      parent_phone: document.getElementById('reg-parent-phone').value.trim() || undefined,
      email: document.getElementById('reg-email').value.trim() || undefined,
      level: document.getElementById('reg-level').value,
      course_id: document.getElementById('reg-course').value
    };

    try {
      const data = await API.post('/public/register', body);
      successEl.textContent = data.message || 'تم إرسال طلب التسجيل بنجاح! سيتواصل معك المدير قريباً.';
      successEl.style.display = 'block';
      document.getElementById('register-form').reset();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'إرسال طلب التسجيل';
    }
  }

  return { render, handleRegister };
})();
