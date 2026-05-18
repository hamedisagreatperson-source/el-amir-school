const AdminSchedule = (() => {
  const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

  async function render() {
    const page = document.getElementById('page-content');
    page.innerHTML = `
      <h2 style="font-size:1.1rem" class="mb-20">التوقيت الأسبوعي</h2>
      <div class="filters-bar mb-20" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <select class="form-select" id="schedule-teacher-filter" onchange="AdminSchedule.load()" style="max-width:250px">
          <option value="">كل الأساتذة</option>
        </select>
        <select class="form-select" id="schedule-view-mode" onchange="AdminSchedule.load()" style="max-width:180px">
          <option value="grid">عرض شبكة</option>
          <option value="list">عرض قائمة</option>
        </select>
      </div>
      <div id="schedule-container"><div style="padding:40px;text-align:center;color:var(--text-muted)">جاري التحميل...</div></div>
      <div id="sessions-config" class="mt-20"></div>
    `;
    try {
      const data = await API.get('/admin/teachers');
      const select = document.getElementById('schedule-teacher-filter');
      (data.teachers || []).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.full_name;
        select.appendChild(opt);
      });
    } catch (_) {}
    await load();
  }

  async function load() {
    const container = document.getElementById('schedule-container');
    const configContainer = document.getElementById('sessions-config');
    const teacherId = document.getElementById('schedule-teacher-filter')?.value;
    const viewMode = document.getElementById('schedule-view-mode')?.value || 'grid';

    try {
      const params = teacherId ? `?teacher_id=${teacherId}` : '';
      const data = await API.get(`/admin/sessions${params}`);
      const allSessions = data.sessions || [];

      if (allSessions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">&#128197;</div><div class="title">لا توجد حصص مجدولة</div><div class="description">أضف حصص من صفحة إدارة الدورات</div></div>';
        if (configContainer) configContainer.innerHTML = '';
        return;
      }

      // Build color map per course
      const courseIds = [...new Set(allSessions.map(s => s.course_id))];
      const colorMap = {};
      courseIds.forEach((id, i) => { colorMap[id] = COLORS[i % COLORS.length]; });

      if (viewMode === 'grid') {
        renderGrid(container, allSessions, colorMap);
      } else {
        renderList(container, allSessions, colorMap);
      }

      // Sessions per week config
      if (configContainer) {
        const coursesMap = {};
        allSessions.forEach(s => {
          if (s.courses && !coursesMap[s.course_id]) {
            coursesMap[s.course_id] = { name: s.courses.name, level: s.courses.level, sessions_per_week: s.courses.sessions_per_week || 2 };
          }
        });
        const courseEntries = Object.entries(coursesMap);
        if (courseEntries.length > 0) {
          configContainer.innerHTML = `
            <h3 style="font-size:1rem" class="mb-10">عدد الحصص في الأسبوع</h3>
            <div class="card">
              <table class="data-table">
                <thead><tr><th>الدورة</th><th>المستوى</th><th>الحصص / أسبوع</th><th></th></tr></thead>
                <tbody>
                  ${courseEntries.map(([id, c]) => `
                    <tr>
                      <td>${c.name}</td>
                      <td>${c.level}</td>
                      <td><input type="number" class="form-input" style="width:80px" min="1" max="7" value="${c.sessions_per_week}" id="spw-${id}"></td>
                      <td><button class="btn btn-sm btn-outline" onclick="AdminSchedule.updateSPW('${id}')">حفظ</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  function renderGrid(container, sessions, colorMap) {
    const days = ['sunday','monday','tuesday','wednesday','thursday'];
    const timeSlots = [];
    for (let h = 8; h <= 17; h++) timeSlots.push(`${String(h).padStart(2,'0')}:00`);

    let html = '<div class="schedule-grid" style="display:grid;grid-template-columns:80px repeat(5,1fr);gap:2px;background:var(--border);border-radius:var(--radius);overflow:hidden">';
    html += '<div style="padding:12px;background:var(--bg-card);font-weight:700;text-align:center;font-size:0.8rem"></div>';
    days.forEach(d => {
      html += `<div style="padding:12px;background:var(--bg-card);font-weight:700;text-align:center;font-size:0.85rem">${Utils.getArabicDay(d)}</div>`;
    });

    timeSlots.forEach(hour => {
      html += `<div style="padding:10px 6px;background:var(--bg-card);font-size:0.78rem;text-align:center;color:var(--text-muted);font-weight:600">${hour}</div>`;
      days.forEach(day => {
        const hourNum = hour.split(':')[0];
        const daysSessions = sessions.filter(s => s.day_of_week === day && s.start_time && s.start_time.startsWith(hourNum));
        if (daysSessions.length > 0) {
          const s = daysSessions[0];
          const color = colorMap[s.course_id] || '#666';
          const courseName = s.courses ? s.courses.name : '';
          const teacherName = s.teachers ? s.teachers.full_name : '';
          html += `<div style="padding:8px;background:${color}15;border-right:3px solid ${color};min-height:60px">
            <div style="font-size:0.82rem;font-weight:600;color:${color}">${courseName}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${teacherName}</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">${s.room || ''} | ${s.start_time}-${s.end_time}</div>
          </div>`;
        } else {
          html += '<div style="padding:8px;background:var(--bg-card);min-height:60px"></div>';
        }
      });
    });
    html += '</div>';

    // Legend
    const courseIds = [...new Set(sessions.map(s => s.course_id))];
    html += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;padding:12px">';
    courseIds.forEach(id => {
      const s = sessions.find(x => x.course_id === id);
      const color = colorMap[id];
      const name = s?.courses?.name || '';
      html += `<div style="display:flex;align-items:center;gap:6px;font-size:0.8rem"><div style="width:12px;height:12px;border-radius:3px;background:${color}"></div>${name}</div>`;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function renderList(container, sessions, colorMap) {
    const days = ['sunday','monday','tuesday','wednesday','thursday'];
    let html = '';
    days.forEach(day => {
      const daySessions = sessions.filter(s => s.day_of_week === day).sort((a,b) => (a.start_time||'').localeCompare(b.start_time||''));
      if (daySessions.length === 0) return;
      html += `<div class="card mb-10"><h3 style="font-size:0.95rem;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">${Utils.getArabicDay(day)}</h3>`;
      daySessions.forEach(s => {
        const color = colorMap[s.course_id] || '#666';
        html += `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="width:4px;height:40px;border-radius:2px;background:${color}"></div>
          <div style="min-width:100px;font-size:0.85rem;font-weight:600;color:${color}">${s.start_time} - ${s.end_time}</div>
          <div style="flex:1">
            <div style="font-size:0.88rem;font-weight:600">${s.courses?.name || ''}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${s.teachers?.full_name || ''} ${s.room ? '| ' + s.room : ''}</div>
          </div>
        </div>`;
      });
      html += '</div>';
    });
    container.innerHTML = html;
  }

  async function updateSPW(courseId) {
    const input = document.getElementById(`spw-${courseId}`);
    if (!input) return;
    const val = parseInt(input.value);
    if (!val || val < 1 || val > 7) { Toast.warning('عدد الحصص يجب أن يكون بين 1 و 7'); return; }
    try {
      await API.patch(`/admin/courses/${courseId}/sessions-per-week`, { sessions_per_week: val });
      Toast.success('تم تحديث عدد الحصص');
    } catch (err) { Toast.error(err.message); }
  }

  return { render, load, updateSPW };
})();
