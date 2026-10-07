const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(message, isError = false) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function stageLabel(stage) {
  return stage.replaceAll('_', ' ').replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());
}

async function loadCurrentUser() {
  try {
    const { user } = await apiFetch('/auth/me');
    return user;
  } catch (e) {
    return null;
  }
}

// Which sidebar sections each role is allowed to see.
// MD (chairman) and OPS_MANAGER see everything. Everyone else only sees the
// one section that matches their job, plus the Dashboard.
const ROLE_SECTIONS = {
  MD: ['dashboard', 'leads', 'audit', 'cases', 'case-processing', 'reports', 'employees'],
  OPS_MANAGER: ['dashboard', 'leads', 'audit', 'cases', 'case-processing', 'reports', 'employees'],
  COUNSELOR: ['dashboard', 'leads', 'reports'],
  AUDITOR: ['dashboard', 'audit', 'reports'],
  CASE_OFFICER: ['dashboard', 'cases', 'reports'],
};

async function renderSidebar(activeKey) {
  const user = await loadCurrentUser();
  if (!user) return;

const userWorkProfiles = user.work_profiles || [
  user.work_profile
];

const allowedSections = [
  ...new Set(
    userWorkProfiles.flatMap(
      profile => ROLE_SECTIONS[profile] || []
    )
  ),
];
  // Direct-URL guard: if someone types /leads.html etc. but their role can't
  // see that section, bounce them back to the dashboard instead of showing
  // a broken page full of permission errors.
 console.log('REPORT DEBUG:', JSON.stringify({
  activeKey,
  work_profile: user.work_profile,
  allowedSections
}));

if (activeKey !== 'dashboard' && !allowedSections.includes(activeKey)) {
  console.log('REPORT REDIRECT:', activeKey, allowedSections);
  return user;
}

const displayName = user.work_profile === 'MD' ? 'Mani' : user.name;

const displayRole =
  user.work_profile === 'MD'
    ? 'Chairman'
    : user.role === 'manager'
    ? 'Manager'
    : user.role === 'mis-executive'
    ? 'MIS Executive'
    : user.role === 'employee'
    ? 'Employee'
    : user.role;

const initials = displayName
  .split(' ')
  .map((p) => p[0])
  .slice(0, 2)
  .join('')
  .toUpperCase();   
   const items = [
  { key: 'dashboard', href: '/dashboard.html', icon: '&#9635;', label: 'Dashboard' },

  { key: 'leads', href: '/leads.html', icon: '&#128100;', label: 'Leads / Agreements' },

  { key: 'audit', href: '/audit.html', icon: '&#127908;', label: 'Quality Audit' },

{
  key: 'cases',
  href: '/cases.html',
  icon: '&#128203;',
  label: (user.work_profiles || [user.work_profile])
  .includes('CASE_OFFICER')
  ? 'Case Processing'
  : 'Case Filing Ops'
},

{
  key: 'case-processing',
  href: '/cases.html?view=processing',
  icon: '&#128203;',
  label: 'Case Processing'
},

  {
    key: 'reports',
    href: '/reports.html',
    icon: '&#128202;',
    label: 'Reports'
  },

  { key: 'employees', href: '/view-employees.html', icon: '&#128101;', label: 'Employees' },
].filter((it) => allowedSections.includes(it.key));
  const el = document.getElementById('sidebar');
  if (!el) return;
    el.innerHTML = `
<div class="sidebar-logo">
  <img src="/images/brand-logo-img.png" class="brand-logo-img" alt="VJC Logo">
  <strong>VJC OPS PORTAL</strong>
</div>
    <div class="notif-bell-wrap" id="notifBellWrap">
      <button type="button" id="notifBellBtn" class="notif-bell-btn">&#128276;<span id="notifBadge" class="notif-badge" style="display:none">0</span></button>
      <div id="notifPanel" class="notif-panel" style="display:none"></div>
    </div>
    <div>
      ${items.map((it) => `
        <a class="nav-item ${it.key === activeKey ? 'active' : ''}" href="${it.href}">
          <span class="ic">${it.icon}</span> ${it.label}
        </a>`).join('')}
    </div>
<div class="sidebar-footer"> 
  Logged in as<br/> 
  <b style="color:#fff">${displayName}</b> 
  <span class="role-pill" style="background:rgba(255,255,255,0.12);color:#fff">
    ${displayRole}
  </span> 

  <button id="logoutBtn">Logout</button> 
</div>
  `;
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    window.location.href = '/index.html';
  });
  initNotifications();
  return user;
}

let notifSeenIds = new Set();
let notifFirstPoll = true;

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) { /* ignore — some browsers block audio before any user click */ }
}

function showDesktopNotification(n) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const popup = new Notification('VJC Ops Portal', { body: n.message });
    popup.onclick = () => {
      window.focus();
      if (n.link) window.location.href = n.link;
    };
  }
}

function renderNotifPanel(notifications) {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.innerHTML = notifications.length
    ? notifications.map((n) => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}">
          <div>${n.message}</div>
          <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
        </div>`).join('')
    : '<div class="notif-empty">No notifications yet.</div>';
}

async function pollNotifications() {
  try {
    const { notifications, unreadCount } = await apiFetch('/notifications');
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount ? 'inline-block' : 'none';
    }
    const unread = notifications.filter((n) => !n.is_read);
    const newOnes = unread.filter((n) => !notifSeenIds.has(n.id));
    if (!notifFirstPoll && newOnes.length) {
      newOnes.forEach(showDesktopNotification);
      playNotificationSound();
    }
    notifFirstPoll = false;
    notifSeenIds = new Set(unread.map((n) => n.id));
    renderNotifPanel(notifications);
  } catch (e) { /* silent — don't spam toasts for a background poll */ }
}

function initNotifications() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  pollNotifications();
  setInterval(pollNotifications, 20000);

  document.addEventListener('click', (e) => {
    const bellBtn = e.target.closest('#notifBellBtn');
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    if (bellBtn) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      return;
    }
    const item = e.target.closest('.notif-item');
    if (item) {
      apiFetch(`/notifications/${item.dataset.id}/read`, { method: 'PATCH' }).then(pollNotifications);
      if (item.dataset.link) window.location.href = item.dataset.link;
      return;
    }
    if (!e.target.closest('#notifBellWrap')) panel.style.display = 'none';
  });
}
