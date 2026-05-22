const TeacherLessons = (() => {
  let courses = [];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <div class="flex items-center justify-between mb-20">
        <h2 style="font-size:1.1rem">الدروس والملفات</h2>
        <button class="btn btn-accent" onclick="TeacherLessons.showSendModal()">&#128228; إرسال درس</button>
      </div>
      <div id="lessons-list">
        <div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div>
      </div>
    `;
    await loadData();
  }

  async function loadData() {
    try {
      const data = await API.get('/teacher/dashboard');
      courses = data.my_courses || [];
      renderLessons();
    } catch (err) {
      document.getElementById('lessons-list').innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function renderLessons() {
    const container = document.getElementById('lessons-list');
    if (courses.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">&#128218;</div><div class="title">لا توجد دورات</div></div>';
      return;
    }

    container.innerHTML = `
      <div class="grid grid-2" style="gap:16px">
        ${courses.map(c => `
          <div class="card" style="padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <h3 style="font-size:0.95rem">${c.name} (${c.level})</h3>
              <span class="badge badge-info">${c.sessions_per_week || 4} حصص/أسبوع</span>
            </div>
            <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px">${c.subject || 'مادة غير محددة'}</p>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" onclick="TeacherLessons.sendLesson('${c.id}','${Utils.escapeHtml(c.name)}')">&#128228; إرسال درس للتلاميذ</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function showSendModal() {
    if (courses.length === 0) { Toast.warning('لا توجد دورات'); return; }

    const content = `
      <form id="send-lesson-form" onsubmit="TeacherLessons.submitLesson(event)">
        <div class="form-group">
          <label class="form-label">الدورة *</label>
          <select class="form-select" name="course_id" required>
            <option value="">اختر الدورة</option>
            ${courses.map(c => `<option value="${c.id}">${c.name} (${c.level})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">عنوان الدرس *</label>
          <input type="text" class="form-input" name="subject" placeholder="مثال: الدرس الثالث - النحو" required>
        </div>
        <div class="form-group">
          <label class="form-label">محتوى الدرس / الرسالة *</label>
          <textarea class="form-input" name="message" rows="6" placeholder="اكتب محتوى الدرس أو الشرح هنا..." required></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">رابط ملف (اختياري)</label>
          <input type="url" class="form-input" name="file_url" placeholder="https://drive.google.com/...">
          <small style="color:var(--text-muted);font-size:0.78rem">يمكنك إضافة رابط Google Drive أو أي رابط ملف</small>
        </div>
        <button type="submit" class="btn btn-accent" style="width:100%;margin-top:8px">&#128228; إرسال الدرس</button>
      </form>
    `;
    Modal.open({ title: 'إرسال درس للتلاميذ', content, size: 'lg' });
  }

  async function sendLesson(courseId, courseName) {
    const content = `
      <form id="send-lesson-form" onsubmit="TeacherLessons.submitLesson(event)">
        <input type="hidden" name="course_id" value="${courseId}">
        <div class="form-group">
          <label class="form-label">الدورة</label>
          <input type="text" class="form-input" value="${courseName}" disabled>
        </div>
        <div class="form-group">
          <label class="form-label">عنوان الدرس *</label>
          <input type="text" class="form-input" name="subject" placeholder="مثال: الدرس الثالث - النحو" required>
        </div>
        <div class="form-group">
          <label class="form-label">محتوى الدرس / الرسالة *</label>
          <textarea class="form-input" name="message" rows="6" placeholder="اكتب محتوى الدرس أو الشرح هنا..." required></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">رابط ملف (اختياري)</label>
          <input type="url" class="form-input" name="file_url" placeholder="https://drive.google.com/...">
        </div>
        <button type="submit" class="btn btn-accent" style="width:100%;margin-top:8px">&#128228; إرسال الدرس</button>
      </form>
    `;
    Modal.open({ title: `إرسال درس - ${courseName}`, content, size: 'lg' });
  }

  async function submitLesson(e) {
    e.preventDefault();
    const form = e.target;
    const body = Object.fromEntries(new FormData(form));

    if (!body.course_id || !body.subject || !body.message) {
      Toast.warning('املأ جميع الحقول المطلوبة');
      return;
    }

    const fullMessage = body.file_url
      ? `${body.message}\n\n📎 رابط الملف: ${body.file_url}`
      : body.message;

    try {
      await API.post('/teacher/emails/send', {
        subject: `📚 ${body.subject}`,
        message: fullMessage
      });
      Modal.close();
      Toast.success('تم إرسال الدرس للتلاميذ بنجاح');
    } catch (err) {
      Toast.error(err.message);
    }
  }

  return { render, showSendModal, sendLesson, submitLesson };
})();
