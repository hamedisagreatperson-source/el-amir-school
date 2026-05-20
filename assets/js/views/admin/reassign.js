const AdminReassign = (() => {
  let students = [];
  let teachers = [];
  let courses = [];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">إعادة توزيع التلاميذ والأساتذة</h2>
      <div class="card mb-20">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">فلترة حسب الدورة</label>
            <select class="form-select" id="reassign-course-filter" onchange="AdminReassign.filterByCourse()">
              <option value="">كل الدورات</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">بحث</label>
            <input type="text" class="form-input" placeholder="بحث بالاسم..." oninput="AdminReassign.onSearch(this.value)">
          </div>
        </div>
      </div>
      <div id="reassign-container">
        <div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div>
      </div>
    `;
    await loadData();
  }

  let searchTerm = '';
  let courseFilter = '';

  async function loadData() {
    try {
      const [studentsRes, teachersRes, coursesRes] = await Promise.all([
        API.get('/admin/students?limit=1000'),
        API.get('/admin/teachers'),
        API.get('/admin/courses')
      ]);
      students = studentsRes.students || [];
      teachers = teachersRes.teachers || [];
      courses = coursesRes.courses || [];

      const select = document.getElementById('reassign-course-filter');
      courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.level})`;
        select.appendChild(opt);
      });

      renderTable();
    } catch (err) {
      document.getElementById('reassign-container').innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function renderTable() {
    const container = document.getElementById('reassign-container');
    const filter = searchTerm.toLowerCase();

    let filtered = students;
    if (courseFilter) filtered = filtered.filter(s => s.course_id === courseFilter);
    if (filter) filtered = filtered.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(filter));

    container.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>التلميذ</th>
              <th>الدورة الحالية</th>
              <th>الأستاذ الحالي</th>
              <th>نقل إلى دورة</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(s => `
              <tr>
                <td style="font-weight:600">${Utils.escapeHtml(s.first_name)} ${Utils.escapeHtml(s.last_name)}</td>
                <td>${s.courses ? s.courses.name : '—'}</td>
                <td>${s.teachers ? s.teachers.full_name : '—'}</td>
                <td>
                  <select class="form-select" id="new-course-${s.id}" style="min-width:160px">
                    <option value="">اختر دورة</option>
                    ${courses.filter(c => c.id !== s.course_id).map(c => `<option value="${c.id}">${c.name} (${c.level})</option>`).join('')}
                  </select>
                </td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="AdminReassign.reassign('${s.id}')">&#128260; نقل</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">لا يوجد تلاميذ</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  async function reassign(studentId) {
    const select = document.getElementById(`new-course-${studentId}`);
    const newCourseId = select ? select.value : '';
    if (!newCourseId) { Toast.warning('اختر الدورة الجديدة'); return; }

    try {
      await API.patch(`/admin/students/${studentId}/course`, { new_course_id: newCourseId });
      Toast.success('تم نقل التلميذ بنجاح');
      await loadData();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  function filterByCourse() {
    courseFilter = document.getElementById('reassign-course-filter').value;
    renderTable();
  }

  const onSearch = Utils.debounce((value) => {
    searchTerm = value || '';
    renderTable();
  });

  return { render, reassign, filterByCourse, onSearch };
})();
