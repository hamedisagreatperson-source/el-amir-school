const LoginView = (() => {
  let selectedRole = null;

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,var(--bg-dark) 0%,#1a0e30 50%,var(--bg-dark) 100%);background-size:200% 200%;animation:bgGradient 8s ease infinite;position:relative;overflow:hidden">
        <div style="position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle at 30% 50%,rgba(124,58,237,0.08) 0%,transparent 50%),radial-gradient(circle at 70% 50%,rgba(232,184,75,0.05) 0%,transparent 50%);pointer-events:none"></div>
        <div style="width:100%;max-width:480px;animation:fadeIn 0.6s ease;position:relative;z-index:1">
          <div style="text-align:center;margin-bottom:32px">
            <div class="float-animation glow-pulse" style="width:90px;height:90px;margin:0 auto 16px;border-radius:50%;background:linear-gradient(135deg,var(--primary-light),var(--primary));display:flex;align-items:center;justify-content:center;border:3px solid var(--accent);position:relative;overflow:hidden">
              <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                <path d="M25 5L30 15H20L25 5Z" fill="var(--accent)" opacity="0.9"/>
                <rect x="15" y="16" width="20" height="18" rx="3" stroke="var(--accent)" stroke-width="2" fill="none"/>
                <line x1="20" y1="22" x2="30" y2="22" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="20" y1="26" x2="28" y2="26" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="20" y1="30" x2="25" y2="30" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M10 38C10 38 15 42 25 42C35 42 40 38 40 38" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" fill="none"/>
                <circle cx="25" cy="45" r="2" fill="var(--accent)" opacity="0.6"/>
              </svg>
            </div>
            <h1 style="font-size:1.5rem;margin-bottom:4px;background:linear-gradient(135deg,var(--text-main),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">منصة إدارة المدرسة</h1>
            <p style="color:var(--text-muted);font-size:0.9rem">سجّل دخولك للمتابعة</p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px" id="role-selector">
            <div class="role-card card" style="text-align:center;padding:16px;cursor:pointer" data-role="admin" onclick="LoginView.selectRole('admin')">
              <div style="font-size:1.5rem;margin-bottom:8px">${Icons.crown}</div>
              <div style="font-weight:600;font-size:0.85rem">مدير</div>
            </div>
            <div class="role-card card" style="text-align:center;padding:16px;cursor:pointer" data-role="teacher" onclick="LoginView.selectRole('teacher')">
              <div style="font-size:1.5rem;margin-bottom:8px">${Icons.teachers}</div>
              <div style="font-weight:600;font-size:0.85rem">أستاذ</div>
            </div>
            <div class="role-card card" style="text-align:center;padding:16px;cursor:pointer" data-role="student" onclick="LoginView.selectRole('student')">
              <div style="font-size:1.5rem;margin-bottom:8px">${Icons.graduationCap}</div>
              <div style="font-weight:600;font-size:0.85rem">تلميذ</div>
            </div>
          </div>

          <form id="login-form" onsubmit="LoginView.handleLogin(event)" style="display:none">
            <div class="card" style="padding:24px">
              <div class="form-group">
                <label class="form-label">اسم المستخدم</label>
                <input type="text" class="form-input" id="login-username" placeholder="أدخل اسم المستخدم" autocomplete="username" required minlength="3" maxlength="30">
              </div>
              <div class="form-group">
                <label class="form-label">كلمة المرور</label>
                <div style="position:relative">
                  <input type="password" class="form-input" id="login-password" placeholder="أدخل كلمة المرور" autocomplete="current-password" required minlength="6" style="padding-left:40px">
                  <button type="button" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem" onclick="LoginView.togglePassword()">${Icons.eyeToggle}</button>
                </div>
              </div>
              <div id="login-error" style="display:none;color:var(--danger);font-size:0.85rem;margin-bottom:12px;padding:10px;background:rgba(231,76,60,0.1);border-radius:8px"></div>
              <button type="submit" class="btn btn-accent btn-lg" style="width:100%" id="login-btn">
                دخول
              </button>
              <div style="text-align:center;margin-top:12px">
                <a href="#" onclick="LoginView.forgotPassword()" style="font-size:0.82rem;color:var(--text-muted)">نسيت كلمة المرور؟</a>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function selectRole(role) {
    selectedRole = role;
    document.querySelectorAll('.role-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.role === role);
    });
    const form = document.getElementById('login-form');
    form.style.display = 'block';
    form.style.animation = 'slideDown 0.3s ease';
    document.getElementById('login-username').focus();
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!selectedRole) { Toast.warning('اختر دورك أولاً'); return; }

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جاري الدخول...';

    try {
      await Auth.login(username, password, selectedRole);
      window.location.hash = Auth.getDefaultRoute();
    } catch (err) {
      const msg = err.message === 'Failed to fetch'
        ? 'تعذّر الاتصال بالخادم. تأكد أن الخادم يعمل (cd school-backend && npm start) أو تحقق من رابط API_URL في index.html'
        : err.message;
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'دخول';
    }
  }

  function togglePassword() {
    const input = document.getElementById('login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  async function forgotPassword() {
    const content = `
      <div class="form-group">
        <label class="form-label">البريد الإلكتروني</label>
        <input type="email" class="form-input" id="forgot-email" placeholder="أدخل بريدك الإلكتروني" required>
      </div>
      <div class="form-group">
        <label class="form-label">الدور</label>
        <select class="form-select" id="forgot-role">
          <option value="admin">مدير</option>
          <option value="teacher">أستاذ</option>
          <option value="student">تلميذ</option>
        </select>
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="LoginView.submitForgotPassword()">إرسال</button>
    `;
    Modal.open({ title: 'استعادة كلمة المرور', content, size: 'sm' });
  }

  async function submitForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    const role = document.getElementById('forgot-role').value;
    if (!email) { Toast.warning('أدخل البريد الإلكتروني'); return; }

    try {
      await API.post('/auth/forgot-password', { email, role });
      Modal.close();
      Toast.success('تم إرسال طلب استعادة كلمة المرور للمدير');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  return { render, selectRole, handleLogin, togglePassword, forgotPassword, submitForgotPassword };
})();
