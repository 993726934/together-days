import { categories, visibilityNames, escapeHTML as h, localDate, addDays, weekStart, localInput, visibleEvents, validateEvent, demoData } from './domain.js';
import { accountName, registerAccount, loginAccount, changePassword } from './auth.js';

const paths = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0112 0v2M17 5a3 3 0 010 6M21 21v-2a6 6 0 00-4-5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1116 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3M12 14v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  leaf: '<path d="M5 19C-1 7 14 3 21 3c0 14-5 19-13 14M3 21 15 9"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0116 0v2"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0113 3M5 15a8 8 0 0013 3"/>',
  check: '<path d="m5 12 4 4L19 6"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.calendar}</svg>`;
const colors = ['green', 'pink', 'orange', 'purple'];
const app = document.querySelector('#app'), modal = document.querySelector('#modal');
const cfg = window.APP_CONFIG || {};
function publicKeyOnly(key) {
  if (/^sb_publishable_/.test(key || '')) return true;
  try { const part=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(atob(part)).role==='anon'; } catch { return false; }
}
const configured = /^https:\/\/[\w.-]+(?::\d+)?\/?$/.test(cfg.supabaseUrl || '') && publicKeyOnly(cfg.supabaseKey);
const state = { demo: true, user: null, profile: null, events: [], people: [], contacts: [], date: localDate(), tab: 'all', category: 'all', search: '', view: 'week', loading: false, error: '', authMode: 'login' };
let db, toastTimer, dataEpoch = 0;
const time = iso => new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const person = id => state.people.find(p => p.id === id) || { id, display_name: '日程主人' };
const avatar = (p, i = 0, cls = '') => `<span class="avatar ${colors[i % 4]} ${cls}" aria-hidden="true">${h(p?.display_name?.slice(0, 1) || '同')}</span>`;
const uid = () => state.user?.id;
const onlyMine = e => e.owner_id === uid();
const notify = message => { const t = document.querySelector('#toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500); };
const fail = (el, error) => { el.textContent = friendlyError(error); };
function friendlyError(error) {
  const message = error?.message || String(error);
  if (/Invalid login credentials/i.test(message)) return '账号或密码不正确，请重试';
  if (/Email not confirmed/i.test(message)) return '账号服务仍要求验证，请联系管理员关闭邮箱确认；本网站不使用验证邮件';
  if (/already registered|already been registered|user_already_exists/i.test(message)) return '这个账号已被使用，请换一个或直接登录';
  if (/rate limit|too many requests/i.test(message)) return '操作太频繁，请稍后再试';
  if (/Failed to fetch|NetworkError/i.test(message)) return '连接失败，请检查网络后重试';
  return message;
}
function loadDemo() {
  dataEpoch++;
  let data;
  try { data = JSON.parse(localStorage.getItem('together-demo-v1')); } catch {}
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.people) || !Array.isArray(data.contacts)) data = demoData();
  state.demo = true; state.user = { id: 'demo-me' }; state.profile = data.people[0];
  state.events = visibleEvents(data.events, 'demo-me'); state.people = data.people; state.contacts = data.contacts;
  state.error = ''; state.loading = false; render();
}
function saveDemo() {
  try { localStorage.setItem('together-demo-v1', JSON.stringify({ events: state.events, people: state.people, contacts: state.contacts })); }
  catch { notify('浏览器存储不可用，体验数据仅在本次打开时保留'); }
}
function matchingEvents() {
  return state.events.filter(e => (state.tab === 'all' || (state.tab === 'mine' ? onlyMine(e) : !onlyMine(e))) && (state.category === 'all' || e.category === state.category) && `${e.title} ${e.location} ${person(e.owner_id).display_name}`.toLowerCase().includes(state.search.toLowerCase())).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}
function eventCard(e) {
  const cat = categories[e.category] || categories.other, own = onlyMine(e);
  const viewers = (e.viewers || []).map(person).slice(0, 3);
  return `<div class="event"><div class="event-time">${time(e.starts_at)}<small>${time(e.ends_at)}${localDate(new Date(e.ends_at)) !== localDate(new Date(e.starts_at)) ? ' +跨日' : ''}</small></div><button class="event-card ${cat.color}" data-action="detail" data-id="${h(e.id)}"><div class="event-top"><span class="tag ${cat.color}">${cat.icon} ${cat.name}</span><span class="event-owner">${own ? '我的日程' : h(person(e.owner_id).display_name) + ' 的日程'}</span></div><h3>${h(e.title)}</h3><div class="event-location">${icon('pin')}<span>${h(e.location || '地点待定')}</span></div><div class="event-bottom">${viewers.length ? `<span class="face-stack">${viewers.map((p,i) => avatar(p,i+1)).join('')}</span>` : ''}<span class="visibility">${icon(e.visibility === 'private' ? 'lock' : e.visibility === 'public' ? 'globe' : 'people')}${visibilityNames[e.visibility]}${e.visibility === 'selected' && own ? ` · ${e.viewers?.length || 0} 人` : ''}</span><span class="event-arrow">↗</span></div></button></div>`;
}
function eventsHTML() {
  const events = matchingEvents(), start = weekStart(state.date);
  const days = state.view === 'day' ? [state.date] : Array.from({ length: 7 }, (_, i) => addDays(start, i));
  let count = 0;
  const html = days.map(day => {
    const group = events.filter(e => localDate(new Date(e.starts_at)) === day); count += group.length;
    if (!group.length) return '';
    const d = new Date(day + 'T12:00:00');
    return `<div class="day-heading">${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]}${day === localDate() ? ' · 今天' : ''}<span>${group.length} 个活动</span></div>${group.map(eventCard).join('')}`;
  }).join('');
  if (state.loading) return '<div class="empty">正在同步日程…</div>';
  if (state.error) return `<div class="load-error">${h(state.error)}<br><button class="text-button" data-action="refresh">重新加载</button></div>`;
  return count ? html : `<div class="empty">${icon('leaf')}<h3>${state.search ? '没有找到匹配的活动' : '给这段时间，留一点期待'}</h3><p>${state.tab === 'shared' ? '好友分享给你的活动，会出现在这里。' : '约一场网球，学一支新舞，或只是见见朋友。'}</p><button class="btn" data-action="create">${icon('plus')} 记录一个活动</button>${state.search || state.category !== 'all' ? '<button class="text-button" data-action="clear-filters">清除筛选</button>' : ''}</div>`;
}
function render() {
  const p = state.profile || { display_name: '同频访客' }, week = weekStart(state.date), end = addDays(week, 7);
  const weekly = state.events.filter(e => { const d = localDate(new Date(e.starts_at)); return d >= week && d < end; });
  const hours = weekly.filter(onlyMine).reduce((sum,e) => sum + (new Date(e.ends_at) - new Date(e.starts_at)) / 3600000, 0);
  const countMine = weekly.filter(onlyMine).length;
  app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><img src="./assets/icon.svg" alt=""><div class="brand-name">同频<small>TOGETHER</small></div></div><nav class="nav" aria-label="主导航"><button class="${state.tab === 'all' ? 'active' : ''}" data-action="tab" data-value="all">${icon('grid')} 日程总览</button><button class="${state.tab === 'mine' ? 'active' : ''}" data-action="tab" data-value="mine">${icon('calendar')} 我的日程<span class="nav-count">${countMine}</span></button><button class="${state.tab === 'shared' ? 'active' : ''}" data-action="tab" data-value="shared">${icon('people')} 与我分享</button><button data-action="people">${icon('user')} 我的好友<span class="nav-count">${state.contacts.length}</span></button></nav><div class="side-label">生活里的小热爱</div>${Object.entries(categories).map(([key,c]) => `<button class="side-category" data-action="category" data-value="${key}"><span class="dot ${c.color}"></span>${c.name}</button>`).join('')}<div class="side-note">${icon('leaf')}<strong>好好生活，慢慢同频。</strong>给喜欢的事留点时间，<br>也给喜欢的人留个位置。</div><button class="account" data-action="account">${avatar(p)}<span><strong>${h(p.display_name)}${state.demo ? ' · 体验' : ''}</strong><small>${state.demo ? '打开同频的第一天' : '管理账号与好友码'}</small></span>${icon('right')}</button></aside><div class="main"><header class="topbar"><div class="mobile-brand brand"><img src="./assets/icon.svg" alt=""><div class="brand-name">同频<small>TOGETHER</small></div></div><div class="breadcrumb">我的生活 <span>/</span> <strong>${state.tab === 'mine' ? '我的日程' : state.tab === 'shared' ? '与我分享' : '日程总览'}</strong></div><div class="top-actions"><label class="search">${icon('search')}<input id="search" aria-label="搜索日程" placeholder="搜索日程或好友" value="${h(state.search)}"></label><button class="icon-btn" data-action="refresh" aria-label="刷新日程">${icon('refresh')}</button><button data-action="account" aria-label="账号">${avatar(p,0,'small-avatar')}</button></div></header><main class="content">${state.demo ? `<div class="mode-banner">${icon('info')}<span>体验模式 · 示例日程仅保存在此设备</span><button data-action="auth">登录 / 注册 ${icon('right')}</button></div>` : ''}<div class="greeting-row"><div class="greeting"><div class="eyebrow">A LITTLE PLAN, A LOVELY DAY</div><h1>把时间，留给<span>喜欢的事。</span></h1><p>记录生活的小热爱，与同频的人分享每一天。</p></div><button class="btn primary" data-action="create" aria-label="新建日程">${icon('plus')}<span>新建日程</span></button></div><div class="stats"><div class="stat"><div class="stat-symbol">${icon('calendar')}</div><div><small>本周我的日程</small><strong>${countMine}<span>个活动</span></strong></div></div><div class="stat"><div class="stat-symbol">${icon('clock')}</div><div><small>留给热爱的时间</small><strong>${Number(hours.toFixed(1))}<span>小时</span></strong></div></div><div class="stat"><div class="stat-symbol">${icon('people')}</div><div><small>我的同频好友</small><strong>${state.contacts.length}<span>位好友</span></strong></div></div></div><div class="workspace"><section class="schedule"><div class="section-head"><h2>这一周的期待 <small>MY WEEKLY PLANS</small></h2><div class="date-controls"><button class="icon-btn" data-action="week" data-value="-1" aria-label="上一周">${icon('left')}</button><button class="month-label" data-action="month">${new Date(state.date+'T12:00:00').getFullYear()} 年 ${new Date(state.date+'T12:00:00').getMonth()+1} 月</button><button class="icon-btn" data-action="week" data-value="1" aria-label="下一周">${icon('right')}</button><button class="today-btn" data-action="today">今天</button></div></div><div class="week" aria-label="选择日期">${Array.from({length:7},(_,i) => { const d = addDays(week,i), dt = new Date(d+'T12:00:00'); return `<button class="day ${d === state.date ? 'selected' : ''} ${d === localDate() ? 'is-today' : ''}" data-action="day" data-value="${d}" aria-label="${d}" aria-pressed="${d === state.date}"><small>${['一','二','三','四','五','六','日'][i]}</small><b>${dt.getDate()}</b><span class="day-dot" style="opacity:${state.events.some(e=>localDate(new Date(e.starts_at))===d) ? 1 : 0}"></span></button>`; }).join('')}</div><div class="filters" aria-label="日程筛选">${[['all','全部日程'],['mine','我的日程'],['shared','与我分享']].map(([key,label])=>`<button class="filter ${state.tab===key?'active':''}" data-action="tab" data-value="${key}">${label}</button>`).join('')}<select class="category-select" id="category" aria-label="活动类型"><option value="all">所有活动</option>${Object.entries(categories).map(([key,c])=>`<option value="${key}" ${state.category===key?'selected':''}>${c.name}</option>`).join('')}</select></div><div style="display:flex;justify-content:space-between;gap:8px"><button class="sync-btn" data-action="view">${state.view==='week'?'本周全部活动 · 切换单日':'当前单日活动 · 查看整周'}</button><button class="sync-btn" data-action="refresh">${icon('refresh')} 同步</button></div><div id="event-list">${eventsHTML()}</div></section><aside class="right-rail"><div class="rail-card"><div class="court" aria-hidden="true"><span class="court-caption">MAKE TIME TO PLAY</span><div class="court-lines"></div><div class="court-net"></div><div class="tennis-ball"></div></div><div class="rail-inner"><div class="rail-label">本周的小灵感</div><h3>下一场球，<br>和谁一起打？</h3><p>挥拍、流汗、笑出声。<br>把快乐约进日程里。</p><button class="rail-link" data-action="create-tennis">安排一场网球 ${icon('arrow')}</button></div></div><div class="rail-card"><div class="rail-inner"><div class="friends-head"><h3>我的同频好友</h3><button data-action="people">管理 ↗</button></div>${state.contacts.slice(0,3).map((p,i)=>`<div class="friend-row">${avatar(p,i+1)}<div class="friend-info">${h(p.display_name)}<small>分享日程，一起计划</small></div><span></span></div>`).join('') || '<p>用好友码，找到同频的人。</p>'}<button class="rail-link" data-action="people">${icon('plus')} 添加好友</button></div></div><div class="rail-card privacy-card"><div class="rail-inner">${icon('lock')}<h3>分享，由你决定。</h3><p>每个日程单独设置可见范围。<br>小小的日常，只给想分享的人看。</p></div></div></aside></div><footer class="footer"><span>同频 TOGETHER &nbsp; · &nbsp; 让每一次相聚，都有迹可循。</span><span>${state.demo?'体验数据 · 本地保存':'已登录 · 数据按权限共享'} &nbsp; / &nbsp; 时间按设备时区显示</span></footer></main></div><nav class="bottom-nav" aria-label="手机导航"><button class="${state.tab==='all'?'active':''}" data-action="tab" data-value="all">${icon('grid')}总览</button><button class="${state.tab==='mine'?'active':''}" data-action="tab" data-value="mine">${icon('calendar')}我的日程</button><button class="create-mobile" data-action="create" aria-label="新建日程">${icon('plus')}</button><button class="${state.tab==='shared'?'active':''}" data-action="tab" data-value="shared">${icon('people')}与我分享</button><button data-action="people">${icon('user')}好友</button></nav></div>`;
}
function openModal(title, body, className = '') {
  modal.className = className;
  modal.innerHTML = `<div class="modal-head"><h2 id="modal-title">${h(title)}</h2><button class="icon-btn" data-action="close" aria-label="关闭">${icon('close')}</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
}
function closeModal() { modal.close(); }
function sharingPicker(e) {
  return `<div id="share-picker" ${e.visibility !== 'selected' ? 'hidden' : ''}><div class="checklist">${state.contacts.length ? state.contacts.map((p,i)=>`<label class="check"><input type="checkbox" name="viewers" value="${h(p.id)}" ${e.viewers?.includes(p.id)?'checked':''}>${avatar(p,i+1)} ${h(p.display_name)}</label>`).join('') : '<p class="help-link">还没有好友。请先在「好友」中添加对方的好友码。</p>'}</div><p class="help-link">未选中的人无法读取此活动。分享链接也不会绕过权限。</p></div>`;
}
function openEditor(event, category = 'tennis') {
  const e = event || { title:'',category,location:'',notes:'',visibility:'private',starts_at:`${state.date}T18:00:00`,ends_at:`${state.date}T19:00:00`,viewers:[] };
  openModal(event ? '编辑日程' : '给喜欢的事，留个时间', `<p>${state.demo?'当前为体验模式，修改仅保存在此设备。':'记录一个活动，再选择想分享给谁。'}</p><form id="event-form" data-id="${h(event?.id || '')}"><label class="field"><span>活动名称</span><input name="title" required maxlength="80" placeholder="例如：周末的网球练习" value="${h(e.title)}"></label><label class="field"><span>活动类型</span><select name="category">${Object.entries(categories).map(([key,c])=>`<option value="${key}" ${e.category===key?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select></label><div class="form-row"><label class="field"><span>开始时间</span><input name="starts_at" type="datetime-local" required value="${localInput(e.starts_at)}"></label><label class="field"><span>结束时间</span><input name="ends_at" type="datetime-local" required value="${localInput(e.ends_at)}"></label></div><label class="field"><span>活动地点</span><input name="location" maxlength="200" placeholder="在哪里见面？（选填）" value="${h(e.location)}"></label><label class="field"><span>谁可以看见</span><select name="visibility" id="visibility">${Object.entries(visibilityNames).map(([key,v])=>`<option value="${key}" ${e.visibility===key?'selected':''}>${key==='private'?'🔒':key==='selected'?'👥':'🌐'} ${v}</option>`).join('')}</select><small>默认仅自己可见。「所有登录用户」对每位注册并登录的人开放。</small></label>${sharingPicker(e)}<label class="field"><span>备注</span><textarea name="notes" maxlength="2000" placeholder="装备、集合方式，或一点小期待…">${h(e.notes)}</textarea></label><div class="form-error" role="alert"></div><div class="form-actions"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">${icon('check')} 保存日程</button></div></form>`);
}
async function submitEvent(form) {
  const values = new FormData(form), id = form.dataset.id || null;
  const e = Object.fromEntries(['title','category','starts_at','ends_at','location','visibility','notes'].map(k=>[k,values.get(k)]));
  const viewers = values.getAll('viewers');
  const errorEl = form.querySelector('.form-error'); errorEl.textContent = '';
  try {
    validateEvent(e,viewers); e.title=e.title.trim(); e.starts_at=new Date(e.starts_at).toISOString();e.ends_at=new Date(e.ends_at).toISOString();
    form.querySelector('[type=submit]').disabled = true;
    if (state.demo) {
      const existing=state.events.find(e=>e.id===id); if(existing && !onlyMine(existing)) throw new Error('只能编辑自己的日程');
      const saved={...e,id:id||crypto.randomUUID(),owner_id:uid(),viewers:e.visibility==='selected'?viewers:[]};
      state.events=state.events.filter(e=>e.id!==saved.id).concat(saved); saveDemo();
    } else {
      const {error}=await db.rpc('save_event',{p_id:id,p_title:e.title,p_category:e.category,p_starts_at:e.starts_at,p_ends_at:e.ends_at,p_location:e.location,p_notes:e.notes,p_visibility:e.visibility,p_viewers:e.visibility==='selected'?viewers:[]});
      if(error) throw error;
      await loadData(false);
    }
    state.date=localDate(new Date(e.starts_at));closeModal();render();notify('日程已保存，期待这一天');
  } catch(error) { fail(errorEl,error); } finally { const button=form.querySelector('[type=submit]');if(button)button.disabled=false; }
}
function openDetail(id) {
  const e=state.events.find(e=>e.id===id);if(!e)return;
  const cat=categories[e.category]||categories.other;
  openModal('日程详情', `<span class="tag ${cat.color}">${cat.icon} ${cat.name}</span><h3 class="detail-title">${h(e.title)}</h3><div class="detail-line">${icon('user')}${h(person(e.owner_id).display_name)}${onlyMine(e)?' · 我的日程':''}</div><div class="detail-line">${icon('calendar')}<span>${h(new Date(e.starts_at).toLocaleString('zh-CN',{month:'long',day:'numeric',weekday:'long',hour:'2-digit',minute:'2-digit',hour12:false}))}<br>至 ${h(new Date(e.ends_at).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}))}</span></div><div class="detail-line">${icon('pin')}${h(e.location||'地点待定')}</div><div class="detail-line">${icon('lock')}<span>${visibilityNames[e.visibility]}${onlyMine(e)&&e.visibility==='selected'?'<br>'+h((e.viewers||[]).map(id=>person(id).display_name).join('、')):''}</span></div>${e.notes?`<div class="detail-notes">${h(e.notes)}</div>`:''}<div class="notice">${state.demo?'体验活动 · 仅供预览':'分享链接不会改变活动的可见权限，接收人需要登录。'}</div><div class="form-actions">${onlyMine(e)?`<button class="btn danger" data-action="delete" data-id="${h(id)}">删除</button><button class="btn" data-action="edit" data-id="${h(id)}">编辑</button>`:''}<button class="btn primary" data-action="share" data-id="${h(id)}">${icon('copy')}复制链接</button></div>`);
}
function confirmDelete(id) {
  const e=state.events.find(e=>e.id===id);if(!e||!onlyMine(e))return;
  openModal('删除这个日程？',`<p>「${h(e.title)}」删除后将从你和分享对象的日程中移除。</p><div class="form-error" role="alert"></div><div class="form-actions"><button class="btn" data-action="detail" data-id="${h(id)}">保留日程</button><button class="btn danger" data-action="delete-confirm" data-id="${h(id)}">确认删除</button></div>`);
}
async function deleteEvent(id, button) {
  button.disabled=true;
  try {
    if(state.demo){state.events=state.events.filter(e=>e.id!==id);saveDemo();}
    else {const {error}=await db.from('events').delete().eq('id',id).eq('owner_id',uid());if(error)throw error;await loadData(false);}
    closeModal();render();notify('日程已删除');
  }catch(error){fail(modal.querySelector('.form-error'),error);}finally{button.disabled=false;}
}
async function copy(text) {
  try{await navigator.clipboard.writeText(text);notify('已复制，可以发给好友了');}catch{openModal('复制内容',`<p>长按或选中下方内容复制：</p><label class="field"><textarea readonly>${h(text)}</textarea></label>`);}
}
function openPeople() {
  openModal('找到你的同频好友',`<p>请好友注册后，把「我的账号」中的好友码发给你。添加好友后，可以在新建日程时选择仅分享给对方。</p><div class="profile-code"><small>我的好友码 ${state.demo?'（体验示例）':''}</small><strong>${h(state.profile?.friend_code||'加载中')}</strong><button class="rail-link" style="margin:auto" data-action="copy-code">${icon('copy')}复制好友码</button></div><form id="friend-form"><div class="people-actions"><input name="code" aria-label="好友码" placeholder="输入对方的 12 位好友码" required maxlength="12" minlength="12" autocapitalize="characters" autocomplete="off"><button class="btn primary" type="submit">添加好友</button></div><div class="form-error" role="alert"></div></form><p class="help-link">添加好友只建立联系人，不会自动开放私人日程。移除好友会同时撤销你已指定给对方的活动权限。</p>${state.contacts.map((p,i)=>`<div class="person-card">${avatar(p,i+1)}<div><strong>${h(p.display_name)}</strong><small>${h(p.friend_code)}</small></div><button class="icon-btn" data-action="remove-contact" data-id="${h(p.id)}" aria-label="移除${h(p.display_name)}">${icon('trash')}</button></div>`).join('')||'<div class="empty"><h3>好朋友，从一个好友码开始</h3><p>把你的好友码发给想一起活动的人。</p></div>'}${state.demo?'<div class="notice warn">体验模式使用示例好友。注册登录后才能添加真实账号。</div>':''}`);
}
async function addFriend(form) {
  const code = new FormData(form).get('code').trim().toUpperCase();
  if(state.demo){notify('请先注册登录，再添加真实好友');return;}
  const btn=form.querySelector('button');btn.disabled=true;
  try {const {error}=await db.rpc('add_contact',{p_code:code});if(error)throw error;await loadData(false);openPeople();notify('好友已添加，可以向对方分享日程了');}
  catch(error){fail(form.querySelector('.form-error'),error);}finally{btn.disabled=false;}
}
function confirmRemoveContact(id) {
  openModal('移除这位好友？',`<p>移除「${h(person(id).display_name)}」后，将撤销你所有指定分享给对方的日程权限。所有登录用户可见的活动仍可被对方查看。</p><div class="form-error" role="alert"></div><div class="form-actions"><button class="btn" data-action="people">取消</button><button class="btn danger" data-action="remove-contact-confirm" data-id="${h(id)}">移除并撤销分享</button></div>`);
}
async function removeContact(id,button) {
  button.disabled=true;
  try {
    if(state.demo){state.contacts=state.contacts.filter(p=>p.id!==id);state.events=state.events.map(e=>onlyMine(e)?{...e,viewers:(e.viewers||[]).filter(v=>v!==id)}:e);saveDemo();}
    else{const {error}=await db.rpc('remove_contact',{p_contact:id});if(error)throw error;await loadData(false);}
    render();openPeople();notify('好友已移除，指定分享已撤销');
  }catch(error){fail(modal.querySelector('.form-error'),error);}finally{button.disabled=false;}
}
function openAccount() {
  if(state.demo){openAuth();return;}
  openModal('我的账号',`<p>登录账号：${h(accountName(state.user))}</p><form id="profile-form"><label class="field"><span>我的昵称</span><input name="display_name" value="${h(state.profile?.display_name)}" required maxlength="30"></label><div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">保存昵称</button></form><div class="profile-code" style="margin-top:22px"><small>我的好友码</small><strong>${h(state.profile?.friend_code)}</strong><button class="rail-link" style="margin:auto" data-action="copy-code">${icon('copy')}复制好友码</button></div><div class="account-actions"><button class="text-button" data-action="change-password">修改密码</button><button class="btn" data-action="logout">退出登录</button></div>`);
}
function openAuth(mode='login') {
  state.authMode=mode;
  openModal('和同频的人，一起计划',`<div class="auth-tabs"><button data-action="auth-login" class="${mode==='login'?'active':''}">登录账号</button><button data-action="auth-register" class="${mode==='register'?'active':''}">注册账号</button></div><p>只需账号和密码，不用邮箱或验证码。</p>${!configured?'<div class="notice warn">账号服务尚未接入。当前可以体验日程功能，管理员完成基础配置后即可注册。</div>':''}<form id="auth-form"><label class="field"><span>账号 / 手机号</span><input name="account" required minlength="4" maxlength="24" pattern="[A-Za-z0-9_]{4,24}" placeholder="自定义账号，或使用手机号" autocomplete="username" autocapitalize="none" spellcheck="false"><small>4–24 位字母、数字或下划线，不区分大小写。手机号仅作为账号，不发送短信。</small></label><label class="field"><span>密码</span><input name="password" id="auth-password" type="password" required minlength="8" maxlength="128" placeholder="至少 8 位" autocomplete="${mode==='login'?'current-password':'new-password'}"></label><button class="text-button" type="button" data-action="toggle-password" aria-controls="auth-password" aria-pressed="false">显示密码</button>${mode==='register'?'<label class="field"><span>昵称（选填）</span><input name="name" maxlength="30" placeholder="朋友们看到的名字" autocomplete="nickname"></label>':''}<div class="form-error" role="alert"></div><button class="btn primary wide" type="submit" ${!configured?'disabled':''}>${mode==='login'?'登录':'注册并登录'}</button></form><button class="text-button" data-action="forgot-password">忘记密码？</button><p class="help-link">请记住账号和密码，不支持邮件或短信找回。</p>`);
}
async function submitAuth(form) {
  const f=new FormData(form), mode=state.authMode, button=form.querySelector('[type=submit]');button.disabled=true;
  try {
    if(!db)throw new Error('请先按部署说明配置账号服务');
    const values={account:f.get('account'),password:f.get('password'),name:f.get('name')};
    if(mode==='register')await registerAccount(db,values);else await loginAccount(db,values);
    closeModal();notify(mode==='register'?'注册成功，已经为你登录':'欢迎回来，今天也有小期待');
  }catch(error){fail(form.querySelector('.form-error'),error);}finally{button.disabled=false;}
}
function openPasswordChange() {
  if(state.demo)return openAuth();
  openModal('修改密码',`<p>验证当前密码后，直接设置新密码，无需邮件或验证码。</p><form id="password-form"><label class="field"><span>当前密码</span><input name="current" type="password" required maxlength="128" autocomplete="current-password"></label><label class="field"><span>新密码</span><input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><label class="field"><span>确认新密码</span><input name="confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label><div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">保存新密码</button></form>`);
}
function openMonth(base=state.date) {
  const date=new Date(base+'T12:00:00');date.setDate(1);const first=localDate(date), offset=(date.getDay()+6)%7;
  const next=new Date(date);next.setMonth(date.getMonth()+1);const prev=new Date(date);prev.setMonth(date.getMonth()-1);
  openModal('选择日期',`<div class="section-head"><button class="icon-btn" data-action="month-prev" data-value="${localDate(prev)}" aria-label="上个月">${icon('left')}</button><strong>${date.getFullYear()} 年 ${date.getMonth()+1} 月</strong><button class="icon-btn" data-action="month-next" data-value="${localDate(next)}" aria-label="下个月">${icon('right')}</button></div><div class="month-grid">${['一','二','三','四','五','六','日'].map(x=>`<small>${x}</small>`).join('')}${Array.from({length:42},(_,i)=>{const day=addDays(first,i-offset),d=new Date(day+'T12:00:00');return `<button data-action="pick-date" data-value="${day}" class="${day===state.date?'active':d.getMonth()!==date.getMonth()?'muted':''}">${d.getDate()}</button>`;}).join('')}</div>`);
}
async function loadData(repaint=true) {
  if(!db||state.demo)return;
  const epoch=++dataEpoch,userId=uid();state.loading=true;state.error='';if(repaint)render();
  try{
    const [profile,events,contacts,shares]=await Promise.all([
      db.from('profiles').select('*').eq('id',userId).single(),
      allRows(()=>db.from('events').select('*').order('starts_at').order('id')),
      allRows(()=>db.from('contacts').select('contact_id,profile:profiles!contacts_contact_id_fkey(id,display_name,friend_code)').eq('owner_id',userId).order('contact_id')),
      allRows(()=>db.from('event_shares').select('event_id,viewer_id').order('event_id').order('viewer_id'))
    ]);
    for(const result of [profile,events,contacts,shares])if(result.error)throw result.error;
    if(epoch!==dataEpoch||state.demo||uid()!==userId)return;
    state.profile=profile.data;state.contacts=contacts.data.map(c=>c.profile).filter(Boolean);
    state.events=events.data.map(e=>({...e,viewers:shares.data.filter(s=>s.event_id===e.id).map(s=>s.viewer_id)}));
    const ids=[...new Set(events.data.map(e=>e.owner_id).concat(shares.data.map(s=>s.viewer_id)))];
    const profiles=ids.length?await db.from('profiles').select('id,display_name').in('id',ids):{data:[]};
    if(profiles.error)throw profiles.error;
    if(epoch!==dataEpoch||state.demo||uid()!==userId)return;
    state.people=[state.profile,...state.contacts,...profiles.data.filter(p=>p.id!==userId&&!state.contacts.some(c=>c.id===p.id))];
  }catch(error){if(epoch===dataEpoch)state.error='日程同步失败：'+friendlyError(error);}
  finally{if(epoch===dataEpoch){state.loading=false;if(repaint)render();}}
}
function readSharedLink() {
  const params=new URLSearchParams(location.hash.slice(1)), id=params.get('event');
  if(!id)return;
  const e=state.events.find(e=>e.id===id);
  if(e){state.date=localDate(new Date(e.starts_at));render();openDetail(id);}
  else openModal('这份日程暂时不可查看',`<p>${state.demo?'请先登录被邀请的账号，再重新打开链接。':'日程可能已删除，或主人尚未向当前账号开放可见权限。'}</p>${state.demo?'<button class="btn primary wide" data-action="auth">登录账号</button>':'<button class="btn wide" data-action="close">知道了</button>'}`);
}
async function allRows(query) {
  const rows=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await query().range(offset,offset+499);
    if(error)return {data:null,error};
    rows.push(...data);
    if(data.length<500)return {data:rows,error:null};
  }
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action, value=button.dataset.value,id=button.dataset.id;
  if(action==='close')return closeModal();
  if(action==='create'||action==='create-tennis')return openEditor(null,action==='create-tennis'?'tennis':state.category==='all'?'tennis':state.category);
  if(action==='tab'){state.tab=value;render();return;}
  if(action==='category'){state.category=state.category===value?'all':value;render();return;}
  if(action==='clear-filters'){state.category='all';state.search='';render();return;}
  if(action==='week'){state.date=addDays(state.date,Number(value)*7);render();return;}
  if(action==='day'){state.date=value;state.view='day';render();return;}
  if(action==='today'){state.date=localDate();state.view='day';render();return;}
  if(action==='view'){state.view=state.view==='week'?'day':'week';render();return;}
  if(action==='month')return openMonth();
  if(action==='month-prev'||action==='month-next')return openMonth(value);
  if(action==='pick-date'){state.date=value;state.view='day';closeModal();render();return;}
  if(action==='detail')return openDetail(id);
  if(action==='edit')return openEditor(state.events.find(e=>e.id===id));
  if(action==='delete')return confirmDelete(id);
  if(action==='delete-confirm')return deleteEvent(id,button);
  if(action==='people')return openPeople();
  if(action==='account')return openAccount();
  if(action==='copy-code')return copy(state.profile?.friend_code||'');
  if(action==='share'){
    if(state.demo){notify('体验日程无法跨设备分享，请先注册登录');return;}
    return copy(new URL('./',location.href).href+'#event='+encodeURIComponent(id));
  }
  if(action==='remove-contact')return confirmRemoveContact(id);
  if(action==='remove-contact-confirm')return removeContact(id,button);
  if(action==='auth'||action==='auth-login')return openAuth();
  if(action==='auth-register')return openAuth('register');
  if(action==='change-password')return openPasswordChange();
  if(action==='forgot-password')return openModal('忘记密码了？','<p>本站不绑定邮箱，也不发送短信。请联系网站管理员，并提供你的账号，由管理员核实身份后协助重置。手机号作为账号时，也不能通过短信找回。</p><button class="btn primary wide" data-action="auth-login">返回登录</button>');
  if(action==='toggle-password'){const input=document.querySelector('#auth-password'),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'隐藏密码':'显示密码';button.setAttribute('aria-pressed',String(show));return;}
  if(action==='refresh'){if(state.demo){notify('体验数据已在本机保存');return;}await loadData();if(!state.error)notify('日程已同步');return;}
  if(action==='logout'){
    button.disabled=true;const {error}=await db.auth.signOut();
    if(error){notify(friendlyError(error));button.disabled=false;return;}
    closeModal();state.date=localDate();state.tab='all';state.category='all';state.search='';loadDemo();notify('已退出登录');
  }
});
document.addEventListener('input',e=>{if(e.target.id==='search'){state.search=e.target.value;document.querySelector('#event-list').innerHTML=eventsHTML();}});
document.addEventListener('change',e=>{
  if(e.target.id==='category'){state.category=e.target.value;render();}
  if(e.target.id==='visibility')document.querySelector('#share-picker').hidden=e.target.value!=='selected';
});
document.addEventListener('submit',async e=>{
  const form=e.target;if(!form.id)return;e.preventDefault();
  if(form.id==='event-form')return submitEvent(form);
  if(form.id==='auth-form')return submitAuth(form);
  if(form.id==='friend-form')return addFriend(form);
  if(form.id==='profile-form'){
    const button=form.querySelector('button');button.disabled=true;
    try{const name=new FormData(form).get('display_name').trim();if(!name)throw new Error('昵称不能为空');const {error}=await db.from('profiles').update({display_name:name}).eq('id',uid());if(error)throw error;await loadData(false);render();closeModal();notify('昵称已更新');}
    catch(error){fail(form.querySelector('.form-error'),error);}finally{button.disabled=false;}
  }
  if(form.id==='password-form'){
    const button=form.querySelector('button');button.disabled=true;
    try{const values=new FormData(form);await changePassword(db,state.user,{currentPassword:values.get('current'),password:values.get('password'),confirm:values.get('confirm')});closeModal();notify('密码已更新，下次请用新密码登录');}
    catch(error){fail(form.querySelector('.form-error'),error);}finally{button.disabled=false;}
  }
});
window.addEventListener('hashchange',readSharedLink);
window.addEventListener('focus',()=>{if(!state.demo&&!modal.open)loadData();});
async function init(){
  loadDemo();
  if(!configured){readSharedLink();return;}
  try{
    const {createClient}=await import('./assets/supabase.js');
    db=createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    db.auth.onAuthStateChange((event,session)=>{
      if((event==='SIGNED_IN'||event==='INITIAL_SESSION')&&session&&(state.demo||uid()!==session.user.id)){
        state.demo=false;state.user=session.user;state.profile=null;state.events=[];state.people=[];state.contacts=[];state.date=localDate();state.tab='all';state.category='all';state.search='';
        setTimeout(async()=>{await loadData();readSharedLink();},0);
      }
      if(event==='SIGNED_OUT'&&!state.demo){closeModal();loadDemo();}
    });
    const {error}=await db.auth.getSession();if(error)throw error;
  }catch(error){notify('账号服务连接失败：'+friendlyError(error));}
}
init();
