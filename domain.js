export const categories = {
  tennis: { name: '网球', icon: '◉', color: 'green' },
  dance: { name: '跳舞', icon: '♫', color: 'pink' },
  fitness: { name: '运动', icon: '↗', color: 'orange' },
  social: { name: '聚会', icon: '☕', color: 'purple' },
  other: { name: '其他', icon: '✦', color: 'blue' }
};
export const visibilityNames = { private: '仅自己', selected: '指定好友', public: '所有登录用户' };
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(value, n) { const d = new Date(value + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); }
export function weekStart(value) { const d = new Date(value + 'T12:00:00'); return addDays(value, -((d.getDay() + 6) % 7)); }
export function localInput(value) {
  const d = new Date(value);
  return `${localDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function visibleEvents(events, userId) { return events.filter(e => e.owner_id === userId || e.visibility === 'public' || (e.visibility === 'selected' && e.viewers?.includes(userId))); }
export function validateEvent(event, viewers = []) {
  if (!event.title?.trim() || event.title.trim().length > 80) throw new Error('请填写 1–80 字的活动名称');
  if (!categories[event.category]) throw new Error('请选择活动类型');
  const start = new Date(event.starts_at), end = new Date(event.ends_at);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) throw new Error('结束时间需要晚于开始时间');
  if (end - start > 7 * 86400000) throw new Error('单个活动最长为 7 天');
  if (!visibilityNames[event.visibility]) throw new Error('请选择可见范围');
  if (event.visibility === 'selected' && !viewers.length) throw new Error('请至少选择一位好友');
  if ((event.location || '').length > 200 || (event.notes || '').length > 2000) throw new Error('地点或备注过长');
}
export function demoData() {
  const start = weekStart(localDate());
  const people = [{ id: 'demo-me', display_name: '小同', friend_code: 'TOGETHER2026' }, { id: 'demo-1', display_name: '林可', friend_code: 'LINKE1234567' }, { id: 'demo-2', display_name: '阿舟', friend_code: 'AZHOU1234567' }, { id: 'demo-3', display_name: 'Mia', friend_code: 'MIADAY123456' }];
  const make = (id, day, hour, duration, title, category, location, owner_id, visibility, viewers = []) => ({ id, owner_id, title, category, location, visibility, viewers, notes: '', starts_at: new Date(`${addDays(start, day)}T${hour}:00`).toISOString(), ends_at: new Date(+new Date(`${addDays(start, day)}T${hour}:00`) + duration * 3600000).toISOString() });
  return { people, contacts: people.slice(1), events: [
    make('sample-1', 0, '18:30', 1.5, '下班后，来一场网球', 'tennis', '滨江网球中心 · 2 号场', 'demo-me', 'selected', ['demo-1', 'demo-2']),
    make('sample-2', 1, '19:00', 1, '让身体跟着音乐走', 'dance', 'Flow 舞蹈工作室', 'demo-1', 'selected', ['demo-me']),
    make('sample-3', 2, '07:30', 1, '晨间能量训练', 'fitness', '社区健身房', 'demo-me', 'private'),
    make('sample-4', 3, '19:30', 1.5, '双打搭子集合', 'tennis', '城市运动公园', 'demo-2', 'public'),
    make('sample-5', 5, '10:00', 1.5, '周末网球练习', 'tennis', '滨江网球中心', 'demo-me', 'selected', ['demo-1', 'demo-3']),
    make('sample-6', 5, '15:00', 2, '咖啡与好天气', 'social', '转角咖啡 · 靠窗的位置', 'demo-3', 'public'),
    make('sample-7', 6, '16:00', 1.5, '周日的即兴舞蹈', 'dance', 'Flow 舞蹈工作室', 'demo-me', 'public')
  ] };
}
