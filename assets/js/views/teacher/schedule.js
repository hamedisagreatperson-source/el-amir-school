const TeacherSchedule = (() => {
  const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

  async function render() {
    const page = document.getElementById('page-content');
    try {
      const data = await API.get('/teacher/schedule');
      const sessions = data.schedule || [];

      if (sessions.length === 0) {
        page.innerHTML = '<div class="empty-state"><div class="icon">&#128197;</div><div class="title">لا توجد حصص في جدولك</div></div>';
        return;
      }

      const courseIds = [...new Set(sessions.map(s => s.course_id))];
      const colorMap = {};
      courseIds.forEach((id, i) => { colorMap[id] = COLORS[i % COLORS.length]; });

      const days = ['sunday','monday','tuesday','wednesday','thursday'];
      const timeSlots = [];
      for (let h = 8; h <= 17; h++) timeSlots.push(`${String(h).padStart(2,'0')}:00`);

      let html = '<div style="display:grid;grid-template-columns:80px repeat(5,1fr);gap:2px;background:var(--border);border-radius:var(--radius);overflow:hidden">';
      html += '<div style="padding:12px;background:var(--bg-card);font-weight:700;text-align:center;font-size:0.8rem"></div>';
      days.forEach(d => {
        html += `<div style="padding:12px;background:var(--bg-card);font-weight:700;text-align:center;font-size:0.85rem">${Utils.getArabicDay(d)}</div>`;
      });

      timeSlots.forEach(hour => {
        html += `<div style="padding:10px 6px;background:var(--bg-card);font-size:0.78rem;text-align:center;color:var(--text-muted);font-weight:600">${hour}</div>`;
        days.forEach(day => {
          const hourNum = hour.split(':')[0];
          const session = sessions.find(s => s.day_of_week === day && s.start_time && s.start_time.startsWith(hourNum));
          if (session) {
            const color = colorMap[session.course_id] || '#666';
            html += `<div style="padding:8px;background:${color}15;border-right:3px solid ${color};min-height:60px">
              <div style="font-size:0.82rem;font-weight:600;color:${color}">${session.courses ? session.courses.name : ''}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${session.courses ? session.courses.level : ''}</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">${session.room || ''} | ${session.start_time}-${session.end_time}</div>
            </div>`;
          } else {
            html += '<div style="padding:8px;background:var(--bg-card);min-height:60px"></div>';
          }
        });
      });
      html += '</div>';

      // Legend
      html += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;padding:12px">';
      courseIds.forEach(id => {
        const s = sessions.find(x => x.course_id === id);
        const color = colorMap[id];
        const name = s?.courses?.name || '';
        html += `<div style="display:flex;align-items:center;gap:6px;font-size:0.8rem"><div style="width:12px;height:12px;border-radius:3px;background:${color}"></div>${name}</div>`;
      });
      html += '</div>';

      // Sessions per week config
      const coursesMap = {};
      sessions.forEach(s => {
        if (s.courses && !coursesMap[s.course_id]) {
          coursesMap[s.course_id] = { name: s.courses.name, level: s.courses.level, sessions_per_week: s.courses.sessions_per_week || 2 };
        }
      });
      const courseEntries = Object.entries(coursesMap);
      if (courseEntries.length > 0) {
        html += `
          <h3 style="font-size:1rem;margin-top:20px" class="mb-10">عدد الحصص في الأسبوع</h3>
          <div class="card">
            <table class="data-table">
              <thead><tr><th>الدورة</th><th>المستوى</th><th>الحصص / أسبوع</th><th></th></tr></thead>
              <tbody>
                ${courseEntries.map(([id, c]) => `
                  <tr>
                    <td>${c.name}</td>
                    <td>${c.level}</td>
                    <td><input type="number" class="form-input" style="width:80px" min="1" max="7" value="${c.sessions_per_week}" id="tspw-${id}"></td>
                    <td><button class="btn btn-sm btn-accent" onclick="TeacherSchedule.requestSPW('${id}','${Utils.escapeHtml(c.name)}')">&#128233; طلب تغيير</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p style="margin-top:8px;font-size:0.78rem;color:var(--text-muted)">سيتم إرسال طلب للمدير للموافقة على التغيير</p>
          </div>
        `;
      }

      page.innerHTML = html;
    } catch (err) {
      page.innerHTML = `<div class="empty-state"><div class="title">خطأ: ${err.message}</div></div>`;
    }
  }

  async function requestSPW(courseId, courseName) {
    const input = document.getElementById(`tspw-${courseId}`);
    if (!input) return;
    const val = parseInt(input.value);
    if (!val || val < 1 || val > 7) { Toast.warning('عدد الحصص يجب أن يكون بين 1 و 7'); return; }
    try {
      await API.post('/teacher/requests', {
        type: 'schedule_change',
        reason: `طلب تغيير عدد الحصص للدورة "${courseName}" إلى ${val} حصص في الأسبوع`
      });
      Toast.success('تم إرسال طلب التغيير للمدير');
    } catch (err) { Toast.error(err.message); }
  }

  return { render, requestSPW };
})();
