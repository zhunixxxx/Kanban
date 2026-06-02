const TASKS_KEY = 'daily-kanban-tasks';
const GROUPS_KEY = 'daily-kanban-groups';
const SHOW_DONE_KEY = 'daily-kanban-show-done';
const LAST_GROUP_KEY = 'daily-kanban-last-group';
const SKIP_GROUP_HINT_KEY = 'daily-kanban-skip-group-hint';
const THEME_KEY = 'daily-kanban-theme';
const WEATHER_CACHE_KEY = 'daily-kanban-weather';
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const STICKY_NOTES_KEY = 'daily-kanban-sticky-notes';
const STICKY_PANEL_STATE_KEY = 'daily-kanban-sticky-panel';
const STICKY_SKIP_DELETE_CONFIRM_KEY = 'daily-kanban-sticky-skip-delete-confirm';
const DEFAULT_COORDS = { lat: 31.2304, lon: 121.4737 };

const QUADRANTS = ['q1', 'q2', 'q3', 'q4'];
const QUADRANT_LABELS = {
  q1: '重要且紧急',
  q2: '紧急不重要',
  q3: '重要不紧急',
  q4: '不重要不紧急',
};
const QUADRANT_PRIORITY = { q1: 0, q2: 1, q3: 2, q4: 3 };

/** 与 Arco 主题协调的 20 种预设分组色 */
const GROUP_COLORS = [
  '#165DFF', '#4080FF', '#3491FA', '#6C8CFF',
  '#0FC6C2', '#14C9C9', '#37D4CF', '#00B42A',
  '#9FDB1D', '#F7BA1E', '#FF7D00', '#F77234',
  '#F53F3F', '#F5319D', '#D91AD9', '#722ED1',
  '#A871E3', '#4E5969', '#86909C', '#C9CDD4',
];
const MAX_GROUP_NAME_LENGTH = 20;
const MAX_NOTES_LENGTH = 500;
const MAX_STICKY_CONTENT = 2000;
const STICKY_EDGES = ['right', 'left', 'top', 'bottom'];

let tasks = [];
let groups = [];
let stickyNotes = [];
let stickyPanelState = { collapsed: false, edge: 'right', offset: 0.5 };
let skipStickyDeleteConfirm = false;
let pendingStickyDeleteId = null;
let draggedId = null;
let suppressCardClick = false;
let editingTaskId = null;
let isAddMode = false;
let quickAddQuadrant = 'q3';
let quickAddSkipGroup = false;
let lastUsedGroup = '';
let showCompleted = localStorage.getItem(SHOW_DONE_KEY) === 'true';
let appDialogFinish = null;
let settingsActivePanel = 'theme';

const taskInput = document.getElementById('taskInput');
const quickAddHint = document.getElementById('quickAddHint');
const addTaskQuickBtn = document.getElementById('addTaskQuickBtn');
const addTaskDetailBtn = document.getElementById('addTaskDetailBtn');
const groupInput = document.getElementById('groupInput');
const addGroupBtn = document.getElementById('addGroupBtn');
const modalGroupsList = document.getElementById('modalGroupsList');
const editGroupsBtn = document.getElementById('editGroupsBtn');
const weekOverviewBtn = document.getElementById('weekOverviewBtn');
const weekOverviewModal = document.getElementById('weekOverviewModal');
const weekOverviewBody = document.getElementById('weekOverviewBody');
const closeWeekOverviewModal = document.getElementById('closeWeekOverviewModal');
const groupModal = document.getElementById('groupModal');
const closeGroupModal = document.getElementById('closeGroupModal');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const appDialogModal = document.getElementById('appDialogModal');
const appDialogTitle = document.getElementById('appDialogTitle');
const appDialogDesc = document.getElementById('appDialogDesc');
const appDialogActions = document.getElementById('appDialogActions');
const closeAppDialog = document.getElementById('closeAppDialog');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const showDoneToggle = document.getElementById('showDoneToggle');
const currentDateEl = document.getElementById('currentDate');
const currentWeatherEl = document.getElementById('currentWeather');
const themeMenu = document.getElementById('themeMenu');

const THEMES = ['light', 'dark', 'pink', 'taro', 'baby', 'velvet', 'forest'];
const THEME_LABELS = {
  light: '浅色',
  dark: '暗色',
  pink: '少女粉',
  taro: '香芋紫',
  baby: '婴儿蓝',
  velvet: '鹅绒黄',
  forest: '森林绿',
};
const THEME_LEGACY = { sand: 'pink' };
const progressRing = document.getElementById('progressRing');
const progressFill = document.getElementById('progressFill');
const progressBar = document.getElementById('progressBar');
const statusPercent = document.getElementById('statusPercent');
const statusMeta = document.getElementById('statusMeta');
const todayList = document.getElementById('todayList');
const todayCount = document.getElementById('todayCount');
const taskModal = document.getElementById('taskModal');
const taskModalHeading = document.getElementById('taskModalHeading');
const closeTaskModalBtn = document.getElementById('closeTaskModal');
const taskModalTitle = document.getElementById('taskModalTitle');
const taskModalGroup = document.getElementById('taskModalGroup');
const taskModalQuadrant = document.getElementById('taskModalQuadrant');
const taskModalStartDate = document.getElementById('taskModalStartDate');
const taskModalDueDate = document.getElementById('taskModalDueDate');
const taskModalNotes = document.getElementById('taskModalNotes');
const taskModalCompleted = document.getElementById('taskModalCompleted');
const taskModalMeta = document.getElementById('taskModalMeta');
const taskModalCompletedField = document.getElementById('taskModalCompletedField');
const taskModalDelete = document.getElementById('taskModalDelete');
const taskModalSave = document.getElementById('taskModalSave');

function normalizeTheme(theme) {
  const mapped = THEME_LEGACY[theme] || theme;
  return THEMES.includes(mapped) ? mapped : 'light';
}

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    const theme = normalizeTheme(stored);
    if (stored && theme !== stored) {
      localStorage.setItem(THEME_KEY, theme);
    }
    if (THEMES.includes(theme)) return theme;
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function renderThemeMenu() {
  if (!themeMenu) return;
  themeMenu.innerHTML = THEMES.map(id => (
    `<button type="button" class="theme-option" data-theme="${id}" role="option">${THEME_LABELS[id]}</button>`
  )).join('');
}

function getActiveTheme() {
  return normalizeTheme(document.documentElement.getAttribute('data-theme'));
}

function updateThemeMenuUI(theme) {
  if (!themeMenu) return;
  const next = normalizeTheme(theme);
  themeMenu.querySelectorAll('.theme-option').forEach(btn => {
    const active = btn.dataset.theme === next;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (settingsBtn) {
    settingsBtn.title = `设置 · ${THEME_LABELS[next]}`;
  }
}

function applyTheme(theme) {
  const next = normalizeTheme(theme);
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  updateThemeMenuUI(next);
}

function initTheme() {
  renderThemeMenu();
  applyTheme(getPreferredTheme());
}

function bindThemeMenu() {
  if (!themeMenu) return;

  themeMenu.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
    });
  });
}

function finishAppDialog(result) {
  if (!appDialogModal) return;
  appDialogModal.hidden = true;
  appDialogModal.classList.remove('modal-overlay-top');
  updateBodyModalClass();
  const finish = appDialogFinish;
  appDialogFinish = null;
  if (finish) finish(result);
}

function bindAppDialogActions() {
  if (!appDialogActions) return;
  appDialogActions.querySelectorAll('[data-app-dialog]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.appDialog;
      if (action === 'ok' || action === 'confirm') finishAppDialog(true);
      else finishAppDialog(false);
    });
  });
}

function openAppDialog() {
  if (!appDialogModal) return;
  appDialogModal.hidden = false;
  appDialogModal.classList.add('modal-overlay-top');
  updateBodyModalClass();
}

function showAppAlert(message, title = '提示') {
  return new Promise(resolve => {
    if (!appDialogModal) {
      resolve();
      return;
    }
    appDialogFinish = () => resolve();
    appDialogTitle.textContent = title;
    appDialogDesc.textContent = message;
    appDialogActions.innerHTML = '<button type="button" class="btn btn-primary" data-app-dialog="ok">确定</button>';
    bindAppDialogActions();
    openAppDialog();
    appDialogActions.querySelector('[data-app-dialog="ok"]')?.focus();
  });
}

function showAppConfirm(message, options = {}) {
  const {
    title = '确认',
    confirmText = '确定',
    cancelText = '取消',
    danger = false,
  } = options;
  return new Promise(resolve => {
    if (!appDialogModal) {
      resolve(false);
      return;
    }
    appDialogFinish = resolve;
    appDialogTitle.textContent = title;
    appDialogDesc.textContent = message;
    const confirmClass = danger ? 'btn btn-ghost task-modal-delete' : 'btn btn-primary';
    appDialogActions.innerHTML = `
      <button type="button" class="btn btn-ghost" data-app-dialog="cancel">${escapeHtml(cancelText)}</button>
      <button type="button" class="${confirmClass}" data-app-dialog="confirm">${escapeHtml(confirmText)}</button>
    `;
    bindAppDialogActions();
    openAppDialog();
    appDialogActions.querySelector('[data-app-dialog="confirm"]')?.focus();
  });
}

function setSettingsPanel(panel) {
  settingsActivePanel = panel === 'data' ? 'data' : 'theme';
  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    const active = btn.dataset.settingsPanel === settingsActivePanel;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.settings-panel').forEach(el => {
    const active = el.dataset.settingsPanel === settingsActivePanel;
    el.classList.toggle('is-active', active);
    el.hidden = !active;
  });
}

function bindSettingsNav() {
  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', () => setSettingsPanel(btn.dataset.settingsPanel));
  });
}

function init() {
  initTheme();
  loadData();
  loadStickyNotes();
  showDoneToggle.checked = showCompleted;
  renderDate();
  loadWeather();
  render();
  updateQuickAddHint();
  initStickyNotes();
  bindSettingsNav();
  bindEvents();
}

function loadData() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    const loaded = raw ? JSON.parse(raw) : [];
    tasks = migrateTasks(loaded);
    saveTasks();
  } catch {
    tasks = [];
  }

  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    const loaded = raw ? JSON.parse(raw) : [];
    groups = migrateGroups(loaded);
    saveGroups();
  } catch {
    groups = [];
  }

  loadLastUsedGroup();
  loadQuickAddSkipGroup();
}

function loadQuickAddSkipGroup() {
  try {
    quickAddSkipGroup = localStorage.getItem(SKIP_GROUP_HINT_KEY) === 'true';
  } catch {
    quickAddSkipGroup = false;
  }
}

function setQuickAddSkipGroup(skipped) {
  quickAddSkipGroup = skipped;
  try {
    if (skipped) {
      localStorage.setItem(SKIP_GROUP_HINT_KEY, 'true');
    } else {
      localStorage.removeItem(SKIP_GROUP_HINT_KEY);
    }
  } catch {
    /* ignore */
  }
}

function loadLastUsedGroup() {
  try {
    const stored = localStorage.getItem(LAST_GROUP_KEY);
    const normalized = normalizeGroupChar(stored);
    if (normalized && groups.some(g => g.char === normalized)) {
      lastUsedGroup = normalized;
      return;
    }
  } catch {
    /* ignore */
  }
  lastUsedGroup = '';
}

function rememberLastUsedGroup(char) {
  const normalized = normalizeGroupChar(char);
  if (!normalized || !groups.some(g => g.char === normalized)) return;
  lastUsedGroup = normalized;
  localStorage.setItem(LAST_GROUP_KEY, normalized);
  updateQuickAddHint();
}

function clearLastUsedGroupIf(char) {
  if (lastUsedGroup !== char) return;
  lastUsedGroup = '';
  localStorage.removeItem(LAST_GROUP_KEY);
  updateQuickAddHint();
}

function getDefaultAddGroup() {
  if (quickAddSkipGroup) return '';
  if (lastUsedGroup && groups.some(g => g.char === lastUsedGroup)) {
    return lastUsedGroup;
  }
  return '';
}

function skipQuickAddGroup() {
  setQuickAddSkipGroup(true);
  updateQuickAddHint();
}

function saveTasks() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function saveGroups() {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function normalizeGroupChar(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.length > MAX_GROUP_NAME_LENGTH) return null;
  return trimmed;
}

function nextGroupColor() {
  return GROUP_COLORS[groups.length % GROUP_COLORS.length];
}

function snapToPaletteColor(color, index = 0) {
  const c = (color || '').trim();
  if (!c) return GROUP_COLORS[index % GROUP_COLORS.length];

  const exact = GROUP_COLORS.find(p => p.toLowerCase() === c.toLowerCase());
  if (exact) return exact;

  const hex = c.startsWith('#') ? c : `#${c}`;
  const h = hex.replace('#', '');
  if (h.length !== 6) return GROUP_COLORS[index % GROUP_COLORS.length];

  const rgb = [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  if (rgb.some(n => Number.isNaN(n))) return GROUP_COLORS[index % GROUP_COLORS.length];

  let best = GROUP_COLORS[0];
  let bestDist = Infinity;
  GROUP_COLORS.forEach(p => {
    const ph = p.replace('#', '');
    const pr = [
      parseInt(ph.slice(0, 2), 16),
      parseInt(ph.slice(2, 4), 16),
      parseInt(ph.slice(4, 6), 16),
    ];
    const d = (rgb[0] - pr[0]) ** 2 + (rgb[1] - pr[1]) ** 2 + (rgb[2] - pr[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  });
  return best;
}

function migrateGroups(loaded) {
  if (!Array.isArray(loaded)) return [];

  return loaded.map((g, i) => {
    if (typeof g === 'string') {
      const char = normalizeGroupChar(g);
      if (!char) return null;
      return { char, color: snapToPaletteColor(null, i) };
    }
    if (g && typeof g.char === 'string') {
      const char = normalizeGroupChar(g.char);
      if (!char) return null;
      return { char, color: snapToPaletteColor(g.color, i) };
    }
    return null;
  }).filter(Boolean);
}

function getGroup(char) {
  if (!char) return null;
  return groups.find(g => g.char === char) || null;
}

function getGroupColor(char) {
  return getGroup(char)?.color || null;
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(108, 140, 255, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function taskCardStyle(task) {
  const color = getGroupColor(task.group);
  if (!color) return '';
  const bg = hexToRgba(color, task.completed ? 0.1 : 0.2);
  const border = hexToRgba(color, task.completed ? 0.25 : 0.45);
  return ` style="background:${bg};border-color:${border}"`;
}

function migrateTasks(loaded) {
  if (!Array.isArray(loaded) || loaded.length === 0) return [];
  return loaded.map(t => normalizeTaskFields(t)).filter(Boolean);
}

function normalizeTaskFields(t) {
  if (!t || typeof t.id !== 'string' || typeof t.title !== 'string' || !t.title.trim()) {
    return null;
  }

  let quadrant = t.quadrant;
  if (!QUADRANTS.includes(quadrant)) {
    const priority = t.priority || 'medium';
    const status = t.status || 'todo';
    quadrant = 'q3';
    if (priority === 'high') quadrant = 'q1';
    else if (priority === 'low') quadrant = 'q4';
    if (status === 'doing') quadrant = 'q1';
  }

  const completed = !!t.completed || t.status === 'done';
  const group = normalizeGroupChar(t.group);
  const notes = typeof t.notes === 'string' ? t.notes.trim().slice(0, MAX_NOTES_LENGTH) : '';
  const createdAt = t.createdAt || new Date().toISOString();
  const defaultDate = toDateOnly(createdAt) || todayDateOnly();
  const { startDate, dueDate } = alignTaskDates(
    normalizeDateOnly(t.startDate, defaultDate),
    normalizeDateOnly(t.dueDate, defaultDate),
  );

  return {
    id: t.id,
    title: t.title.trim(),
    quadrant,
    completed,
    ...(group ? { group } : {}),
    ...(notes ? { notes } : {}),
    createdAt,
    startDate,
    dueDate,
    ...(completed && (t.completedAt || t.status === 'done')
      ? { completedAt: t.completedAt || new Date().toISOString() }
      : {}),
  };
}

function normalizeImportedGroups(rawGroups) {
  if (!Array.isArray(rawGroups)) return [];
  return migrateGroups(rawGroups);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function renderDate() {
  const now = new Date();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  currentDateEl.textContent = `${dateStr} · ${weekdays[now.getDay()]}`;
}

const WMO_WEATHER_ZH = {
  0: { label: '晴', icon: '☀️' },
  1: { label: '大部晴朗', icon: '🌤️' },
  2: { label: '多云', icon: '⛅' },
  3: { label: '阴', icon: '☁️' },
  45: { label: '雾', icon: '🌫️' },
  48: { label: '雾凇', icon: '🌫️' },
  51: { label: '小毛毛雨', icon: '🌦️' },
  53: { label: '毛毛雨', icon: '🌦️' },
  55: { label: '大毛毛雨', icon: '🌧️' },
  56: { label: '冻毛毛雨', icon: '🌧️' },
  57: { label: '冻毛毛雨', icon: '🌧️' },
  61: { label: '小雨', icon: '🌧️' },
  63: { label: '中雨', icon: '🌧️' },
  65: { label: '大雨', icon: '🌧️' },
  66: { label: '冻雨', icon: '🌧️' },
  67: { label: '冻雨', icon: '🌧️' },
  71: { label: '小雪', icon: '🌨️' },
  73: { label: '中雪', icon: '🌨️' },
  75: { label: '大雪', icon: '❄️' },
  77: { label: '雪粒', icon: '❄️' },
  80: { label: '小阵雨', icon: '🌦️' },
  81: { label: '阵雨', icon: '🌧️' },
  82: { label: '大阵雨', icon: '🌧️' },
  85: { label: '小阵雪', icon: '🌨️' },
  86: { label: '大阵雪', icon: '❄️' },
  95: { label: '雷雨', icon: '⛈️' },
  96: { label: '雷雨冰雹', icon: '⛈️' },
  99: { label: '强雷雨冰雹', icon: '⛈️' },
};

function getWeatherLabel(code) {
  return WMO_WEATHER_ZH[code] || { label: '未知', icon: '🌡️' };
}

function getWeatherCache() {
  try {
    const raw = sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.fetchedAt || Date.now() - data.fetchedAt > WEATHER_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setWeatherCache(data) {
  sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
}

function setWeatherLoading() {
  if (!currentWeatherEl) return;
  currentWeatherEl.classList.add('is-loading');
  currentWeatherEl.textContent = '天气加载中…';
}

function renderWeather(data) {
  if (!currentWeatherEl) return;
  const { temp, code, place } = data;
  const { label, icon } = getWeatherLabel(code);
  const tempText = Number.isFinite(temp) ? `${Math.round(temp)}°C` : '';
  const placeText = place ? `${place} ` : '';

  currentWeatherEl.classList.remove('is-loading');
  currentWeatherEl.replaceChildren();
  const iconSpan = document.createElement('span');
  iconSpan.className = 'weather-icon';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = icon;
  const textSpan = document.createElement('span');
  textSpan.textContent = `${placeText}${label}${tempText ? ` ${tempText}` : ''}`.trim();
  currentWeatherEl.append(iconSpan, textSpan);
}

function setWeatherError(message = '天气暂不可用') {
  if (!currentWeatherEl) return;
  currentWeatherEl.classList.remove('is-loading');
  currentWeatherEl.textContent = message;
}

function getCoords() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve({ ...DEFAULT_COORDS, fallback: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        fallback: false,
      }),
      () => resolve({ ...DEFAULT_COORDS, fallback: true }),
      { timeout: 8000, maximumAge: 600000 },
    );
  });
}

async function fetchPlaceName(lat, lon) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('language', 'zh');
  const res = await fetch(url);
  if (!res.ok) return '';
  const data = await res.json();
  const hit = data.results?.[0];
  if (!hit) return '';
  return hit.name || hit.admin1 || '';
}

async function fetchWeather(coords) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(coords.lat));
  url.searchParams.set('longitude', String(coords.lon));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url);
  if (!res.ok) throw new Error('weather fetch failed');
  const data = await res.json();
  const place = await fetchPlaceName(coords.lat, coords.lon).catch(() => '');

  return {
    temp: data.current?.temperature_2m,
    code: data.current?.weather_code ?? 0,
    place: coords.fallback && !place ? '上海' : place,
    fetchedAt: Date.now(),
  };
}

async function loadWeather() {
  if (!currentWeatherEl) return;
  setWeatherLoading();

  const cached = getWeatherCache();
  if (cached) {
    renderWeather(cached);
    return;
  }

  try {
    const coords = await getCoords();
    const weather = await fetchWeather(coords);
    setWeatherCache(weather);
    renderWeather(weather);
  } catch {
    setWeatherError();
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function toDateOnly(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayDateOnly() {
  return toDateOnly(new Date());
}

function normalizeDateOnly(value, fallback) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return value;
  }
  if (value) {
    const parsed = toDateOnly(value);
    if (parsed) return parsed;
  }
  if (typeof fallback === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fallback)) return fallback;
  if (fallback) {
    const parsed = toDateOnly(fallback);
    if (parsed) return parsed;
  }
  return todayDateOnly();
}

function alignTaskDates(startDate, dueDate) {
  if (dueDate < startDate) return { startDate, dueDate: startDate };
  return { startDate, dueDate };
}

function isTaskInTodayRange(task) {
  const today = todayDateOnly();
  const start = getTaskStartDate(task);
  const due = getTaskDueDate(task);
  return today >= start && today <= due;
}

function syncModalDueToStart() {
  const start = normalizeDateOnly(taskModalStartDate.value, todayDateOnly());
  taskModalStartDate.value = start;
  const due = normalizeDateOnly(taskModalDueDate.value, start);
  if (due < start) taskModalDueDate.value = start;
}

function syncModalStartToDue() {
  const due = normalizeDateOnly(taskModalDueDate.value, todayDateOnly());
  taskModalDueDate.value = due;
  const start = normalizeDateOnly(taskModalStartDate.value, due);
  if (start > due) taskModalStartDate.value = due;
}

function getTaskStartDate(task) {
  return task.startDate || toDateOnly(task.createdAt) || todayDateOnly();
}

function getTaskDueDate(task) {
  return task.dueDate || toDateOnly(task.createdAt) || todayDateOnly();
}

function formatDateShort(dateOnly) {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

function formatTaskDateRange(task) {
  const start = getTaskStartDate(task);
  const due = getTaskDueDate(task);
  if (start === due) return formatDateShort(start);
  return `${formatDateShort(start)} – ${formatDateShort(due)}`;
}

function formatTaskDueDate(task) {
  return formatDateShort(getTaskDueDate(task));
}

function isTaskOverdue(task) {
  return !task.completed && getTaskDueDate(task) < todayDateOnly();
}

function readTaskDatesFromModal() {
  const today = todayDateOnly();
  return alignTaskDates(
    normalizeDateOnly(taskModalStartDate.value, today),
    normalizeDateOnly(taskModalDueDate.value, today),
  );
}

function setTaskModalDates(startDate, dueDate) {
  const aligned = alignTaskDates(
    normalizeDateOnly(startDate, todayDateOnly()),
    normalizeDateOnly(dueDate, todayDateOnly()),
  );
  taskModalStartDate.value = aligned.startDate;
  taskModalDueDate.value = aligned.dueDate;
}

function sortByPriority(a, b) {
  const pa = QUADRANT_PRIORITY[a.quadrant] ?? 99;
  const pb = QUADRANT_PRIORITY[b.quadrant] ?? 99;
  if (pa !== pb) return pa - pb;
  return new Date(a.createdAt) - new Date(b.createdAt);
}

function sortTodayTasks(a, b) {
  const aOverdue = isTaskOverdue(a);
  const bOverdue = isTaskOverdue(b);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
  if (aOverdue && bOverdue) {
    const dueCmp = getTaskDueDate(a).localeCompare(getTaskDueDate(b));
    if (dueCmp !== 0) return dueCmp;
  }
  return sortByPriority(a, b);
}

function isTaskInTodayTodo(task) {
  if (task.completed) return false;
  if (isTaskOverdue(task)) return true;
  return isTaskInTodayRange(task);
}

function getTodayTasks() {
  return tasks
    .filter(isTaskInTodayTodo)
    .sort(sortTodayTasks);
}

function getWeekRange(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateOnly(monday), end: toDateOnly(sunday) };
}

function getTaskCompletedDate(task) {
  if (!task.completed) return null;
  return toDateOnly(task.completedAt || task.createdAt);
}

function isDateInRange(dateOnly, start, end) {
  return dateOnly >= start && dateOnly <= end;
}

function getWeekCompletedTasks() {
  const { start, end } = getWeekRange();
  return tasks
    .filter(t => {
      const completedDate = getTaskCompletedDate(t);
      return completedDate && isDateInRange(completedDate, start, end);
    })
    .sort((a, b) => {
      const da = getTaskCompletedDate(a);
      const db = getTaskCompletedDate(b);
      if (da !== db) return db.localeCompare(da);
      return new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt);
    });
}

function groupTasksByCompletedDay(taskList) {
  const map = new Map();
  taskList.forEach(task => {
    const day = getTaskCompletedDate(task);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(task);
  });
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function formatWeekDayLabel(dateOnly) {
  const today = todayDateOnly();
  const [y, m, d] = dateOnly.split('-').map(Number);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const prefix = dateOnly === today ? '今天' : weekdays[new Date(y, m - 1, d).getDay()];
  return `${prefix} · ${formatDateShort(dateOnly)}`;
}

function formatCompletedTime(task) {
  if (!task.completedAt) return '';
  const d = new Date(task.completedAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function renderWeekOverviewItem(task) {
  const time = formatCompletedTime(task);
  const groupBadge = task.group ? renderGroupBadge(task.group) : '';
  const timeHtml = time ? `<span class="week-overview-time">${escapeHtml(time)}</span>` : '';
  return `
    <li class="week-overview-item">
      <button type="button" class="week-overview-item-body" data-action="open-task" data-id="${task.id}">
        <span class="week-overview-title">${escapeHtml(task.title)}</span>
        <div class="week-overview-meta">
          ${groupBadge}
          <span class="quadrant-badge today-quadrant-badge" data-quadrant="${task.quadrant}">${QUADRANT_LABELS[task.quadrant]}</span>
          ${timeHtml}
        </div>
      </button>
    </li>
  `;
}

function bindWeekOverviewEvents() {
  if (!weekOverviewBody) return;
  weekOverviewBody.querySelectorAll('[data-action="open-task"]').forEach(el => {
    el.addEventListener('click', () => {
      closeWeekOverviewModalFn();
      openTaskModal(el.dataset.id);
    });
  });
}

function renderWeekOverview() {
  if (!weekOverviewBody) return;
  const { start, end } = getWeekRange();
  const completed = getWeekCompletedTasks();
  const byDay = groupTasksByCompletedDay(completed);
  const rangeText = `${formatDateShort(start)} – ${formatDateShort(end)}`;

  let html = `
    <p class="week-overview-summary">
      <span class="week-overview-range">${escapeHtml(rangeText)}</span>
      <span class="week-overview-stat">本周已完成 <strong>${completed.length}</strong> 项</span>
    </p>
  `;

  if (completed.length === 0) {
    html += '<p class="week-overview-empty">本周还没有已完成的任务</p>';
  } else {
    html += '<div class="week-overview-days">';
    byDay.forEach(([day, dayTasks]) => {
      html += `
        <section class="week-overview-day">
          <h3 class="week-overview-day-title">
            ${escapeHtml(formatWeekDayLabel(day))}
            <span class="week-overview-day-count">${dayTasks.length}</span>
          </h3>
          <ul class="week-overview-list">
            ${dayTasks.map(renderWeekOverviewItem).join('')}
          </ul>
        </section>
      `;
    });
    html += '</div>';
  }

  weekOverviewBody.innerHTML = html;
  bindWeekOverviewEvents();
}

function openWeekOverviewModal() {
  if (!weekOverviewModal) return;
  renderWeekOverview();
  weekOverviewModal.hidden = false;
  updateBodyModalClass();
}

function closeWeekOverviewModalFn() {
  if (!weekOverviewModal) return;
  weekOverviewModal.hidden = true;
  updateBodyModalClass();
}

function openGroupModal() {
  groupModal.hidden = false;
  updateBodyModalClass();
  renderModalGroups();
  groupInput.focus();
}

function closeGroupModalFn() {
  groupModal.hidden = true;
  updateBodyModalClass();
}

function updateBodyModalClass() {
  if (
    appDialogModal && !appDialogModal.hidden
    || !groupModal.hidden
    || !taskModal.hidden
    || !weekOverviewModal.hidden
    || !settingsModal.hidden
    || !stickyNotesModal.hidden
    || !stickyDeleteConfirmModal.hidden
  ) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

function closeTopModal() {
  if (appDialogModal && !appDialogModal.hidden) finishAppDialog(false);
  else if (!stickyDeleteConfirmModal.hidden) closeStickyDeleteConfirmFn();
  else if (!taskModal.hidden) closeTaskModalFn();
  else if (!settingsModal.hidden) closeSettingsModalFn();
  else if (!weekOverviewModal.hidden) closeWeekOverviewModalFn();
  else if (!groupModal.hidden) closeGroupModalFn();
  else if (!stickyNotesModal.hidden) closeStickyNotesModalFn();
}

function openSettingsModal() {
  if (!settingsModal) return;
  setSettingsPanel('theme');
  updateThemeMenuUI(getActiveTheme());
  settingsModal.hidden = false;
  updateBodyModalClass();
}

function closeSettingsModalFn() {
  if (!settingsModal) return;
  settingsModal.hidden = true;
  updateBodyModalClass();
}

function openAddTaskModal(options = {}) {
  isAddMode = true;
  editingTaskId = null;
  taskModalHeading.textContent = '添加任务';
  taskModalTitle.value = options.title || '';
  const defaultGroup = 'group' in options ? options.group : getDefaultAddGroup();
  taskModalGroup.innerHTML = renderGroupOptions(defaultGroup);
  taskModalQuadrant.value = QUADRANTS.includes(options.quadrant) ? options.quadrant : quickAddQuadrant;
  taskModalNotes.value = options.notes || '';
  setTaskModalDates(todayDateOnly(), todayDateOnly());
  taskModalCompleted.checked = false;
  taskModalMeta.hidden = true;
  taskModalDelete.hidden = true;
  taskModalCompletedField.hidden = true;
  taskModalSave.textContent = '添加';

  taskModal.hidden = false;
  updateBodyModalClass();
  taskModalTitle.focus();
}

function openTaskModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  isAddMode = false;
  editingTaskId = id;
  taskModalHeading.textContent = '任务详情';
  taskModalTitle.value = task.title;
  taskModalGroup.innerHTML = renderGroupOptions(task.group);
  taskModalQuadrant.value = task.quadrant;
  taskModalNotes.value = task.notes || '';
  setTaskModalDates(getTaskStartDate(task), getTaskDueDate(task));
  taskModalCompleted.checked = task.completed;
  taskModalMeta.hidden = false;
  taskModalDelete.hidden = false;
  taskModalCompletedField.hidden = false;
  taskModalSave.textContent = '保存';

  const created = new Date(task.createdAt).toLocaleString('zh-CN');
  const completedStr = task.completedAt
    ? ` · 完成于 ${new Date(task.completedAt).toLocaleString('zh-CN')}`
    : '';
  taskModalMeta.textContent = `创建于 ${created}${completedStr}`;

  taskModal.hidden = false;
  updateBodyModalClass();
  taskModalTitle.focus();
  taskModalTitle.select();
}

function closeTaskModalFn() {
  taskModal.hidden = true;
  editingTaskId = null;
  isAddMode = false;
  updateBodyModalClass();
}

async function saveTaskFromModal() {
  if (isAddMode) {
    await createTaskFromModal();
    return;
  }
  if (!editingTaskId) return;
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;

  const title = taskModalTitle.value.trim();
  if (!title) {
    await showAppAlert('标题不能为空。');
    taskModalTitle.focus();
    return;
  }

  task.title = title;
  task.quadrant = QUADRANTS.includes(taskModalQuadrant.value)
    ? taskModalQuadrant.value
    : task.quadrant;

  const group = normalizeGroupChar(taskModalGroup.value);
  if (group) {
    task.group = group;
    rememberLastUsedGroup(group);
  } else {
    delete task.group;
  }

  const notes = taskModalNotes.value.trim().slice(0, MAX_NOTES_LENGTH);
  if (notes) task.notes = notes;
  else delete task.notes;

  const wasCompleted = task.completed;
  task.completed = taskModalCompleted.checked;
  if (task.completed && !wasCompleted) {
    task.completedAt = new Date().toISOString();
  } else if (!task.completed) {
    delete task.completedAt;
  }

  const dates = readTaskDatesFromModal();
  task.startDate = dates.startDate;
  task.dueDate = dates.dueDate;

  saveTasks();
  closeTaskModalFn();
  render();
}

async function createTaskFromModal() {
  const title = taskModalTitle.value.trim();
  if (!title) {
    await showAppAlert('标题不能为空。');
    taskModalTitle.focus();
    return;
  }

  const notes = taskModalNotes.value.trim().slice(0, MAX_NOTES_LENGTH);
  const dates = readTaskDatesFromModal();
  addTask(
    title,
    taskModalQuadrant.value,
    taskModalGroup.value,
    notes,
    dates,
  );
  taskInput.value = '';
  quickAddQuadrant = 'q3';
  closeTaskModalFn();
}

function updateQuickAddHint() {
  if (quickAddSkipGroup) {
    quickAddHint.hidden = true;
    quickAddHint.innerHTML = '';
    return;
  }

  const group = getDefaultAddGroup();
  const showQuadrant = quickAddQuadrant !== 'q3';

  if (!group && !showQuadrant) {
    quickAddHint.hidden = true;
    quickAddHint.innerHTML = '';
    return;
  }

  quickAddHint.hidden = false;
  const parts = [];
  if (group) parts.push(renderGroupBadge(group));
  if (showQuadrant) {
    parts.push(`<span class="quick-add-hint-text">${escapeHtml(QUADRANT_LABELS[quickAddQuadrant])}</span>`);
  }
  const clearBtn = group
    ? '<button type="button" class="quick-add-hint-clear" data-action="skip-quick-group" aria-label="本次不使用该分组" title="本次不使用该分组">×</button>'
    : '';
  quickAddHint.innerHTML = `${clearBtn}快速添加至 ${parts.join('<span class="quick-add-hint-sep">·</span>')}`;
}

function addTaskQuick() {
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    return;
  }
  addTask(title, quickAddQuadrant, getDefaultAddGroup());
  taskInput.value = '';
  quickAddQuadrant = 'q3';
  taskInput.focus();
}

async function addGroup(char) {
  const normalized = normalizeGroupChar(char);
  if (!normalized) {
    await showAppAlert(`分组名不能为空，且不超过 ${MAX_GROUP_NAME_LENGTH} 个字符。`);
    return;
  }
  if (groups.some(g => g.char === normalized)) {
    await showAppAlert(`分组「${normalized}」已存在。`);
    return;
  }
  groups.push({ char: normalized, color: nextGroupColor() });
  saveGroups();
  groupInput.value = '';
  render();
  groupInput.focus();
}

async function deleteGroup(char) {
  const count = tasks.filter(t => t.group === char).length;
  const msg = count > 0
    ? `确定删除分组「${char}」？${count} 个任务将变为无分组。`
    : `确定删除分组「${char}」？`;
  if (!await showAppConfirm(msg, { title: '删除分组', confirmText: '删除', danger: true })) return;

  groups = groups.filter(g => g.char !== char);
  tasks.forEach(t => {
    if (t.group === char) delete t.group;
  });
  clearLastUsedGroupIf(char);
  saveGroups();
  saveTasks();
  render();
}

function updateGroupColor(char, color, rerender = true) {
  const group = getGroup(char);
  if (!group || !color) return;
  const idx = groups.findIndex(g => g.char === char);
  group.color = snapToPaletteColor(color, idx >= 0 ? idx : 0);
  saveGroups();
  if (rerender) render();
}

function applyGroupCharStyles(charEl, color) {
  charEl.style.background = hexToRgba(color, 0.25);
  charEl.style.borderColor = hexToRgba(color, 0.5);
  charEl.style.color = color;
}

function renderGroupColorPicker(char, color) {
  const swatches = GROUP_COLORS.map(c => {
    const selected = c.toLowerCase() === color.toLowerCase() ? ' is-selected' : '';
    return `<button type="button" class="group-color-swatch${selected}" data-action="pick-color" data-group="${escapeHtml(char)}" data-color="${c}" style="background-color:${c}" title="选择此颜色" aria-label="颜色"></button>`;
  }).join('');

  return `
    <div class="group-color-picker">
      <button type="button" class="group-color-trigger" data-action="toggle-color-picker" data-group="${escapeHtml(char)}" style="background-color:${color}" title="选择分组颜色" aria-label="选择分组颜色"></button>
      <div class="group-color-options" hidden>${swatches}</div>
    </div>
  `;
}

function positionGroupColorPicker(trigger, panel) {
  panel.hidden = false;
  panel.style.position = 'fixed';
  panel.style.bottom = 'auto';

  const gap = 6;
  const margin = 8;
  const rect = trigger.getBoundingClientRect();
  const panelHeight = panel.offsetHeight;
  const panelWidth = panel.offsetWidth;

  let top = rect.bottom + gap;
  if (top + panelHeight > window.innerHeight - margin) {
    top = rect.top - panelHeight - gap;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - panelHeight - margin));

  let left = rect.left;
  if (left + panelWidth > window.innerWidth - margin) {
    left = window.innerWidth - panelWidth - margin;
  }
  left = Math.max(margin, left);

  panel.style.top = `${Math.round(top)}px`;
  panel.style.left = `${Math.round(left)}px`;
}

function openGroupColorPicker(trigger, panel) {
  positionGroupColorPicker(trigger, panel);
  const modalBody = groupModal.querySelector('.modal-body');
  if (modalBody) {
    modalBody.addEventListener('scroll', closeAllGroupColorPickers, { once: true });
  }
}

function closeAllGroupColorPickers() {
  modalGroupsList.querySelectorAll('.group-color-options').forEach(el => {
    el.hidden = true;
    el.style.position = '';
    el.style.top = '';
    el.style.left = '';
    el.style.bottom = '';
  });
}

function addTask(title, quadrant, group, notes = '', dateOptions = {}) {
  const trimmed = title.trim();
  if (!trimmed) return;

  const normalizedGroup = normalizeGroupChar(group);
  const trimmedNotes = typeof notes === 'string' ? notes.trim().slice(0, MAX_NOTES_LENGTH) : '';
  const createdAt = new Date().toISOString();
  const today = todayDateOnly();
  const { startDate, dueDate } = alignTaskDates(
    normalizeDateOnly(dateOptions.startDate, today),
    normalizeDateOnly(dateOptions.dueDate, today),
  );

  tasks.unshift({
    id: generateId(),
    title: trimmed,
    quadrant: QUADRANTS.includes(quadrant) ? quadrant : 'q3',
    completed: false,
    ...(normalizedGroup ? { group: normalizedGroup } : {}),
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    createdAt,
    startDate,
    dueDate,
  });

  if (normalizedGroup) {
    setQuickAddSkipGroup(false);
    rememberLastUsedGroup(normalizedGroup);
  }

  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
}

function moveTask(id, newQuadrant) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.quadrant === newQuadrant) return;
  task.quadrant = newQuadrant;
  saveTasks();
  render();
}

function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  if (task.completed) {
    task.completedAt = new Date().toISOString();
  } else {
    delete task.completedAt;
  }
  saveTasks();
  render();
}

async function clearDoneTasks() {
  const doneCount = tasks.filter(t => t.completed).length;
  if (doneCount === 0) return;
  if (!await showAppConfirm(`确定清除 ${doneCount} 个已完成任务吗？`, {
    title: '清除已完成',
    confirmText: '清除',
    danger: true,
  })) return;
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  render();
}

function exportTasks() {
  const data = {
    version: 4,
    exportedAt: new Date().toISOString(),
    groups,
    tasks,
    stickyNotes,
    stickyPanelState,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily-quadrant-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseImportData(raw) {
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(list)) return null;

  const importedGroups = normalizeImportedGroups(data?.groups);

  return {
    tasks: list.map(normalizeTaskFields).filter(Boolean),
    groups: importedGroups,
    stickyNotes: normalizeImportedStickyNotes(data?.stickyNotes),
    stickyPanelState: normalizeStickyPanelState(data?.stickyPanelState),
  };
}

function mergeGroups(existing, imported) {
  const map = new Map(existing.map(g => [g.char, g]));
  imported.forEach(g => map.set(g.char, g));
  return [...map.values()];
}

async function applyImport(imported) {
  const { tasks: importedTasks, groups: importedGroups, stickyNotes: importedStickyNotes, stickyPanelState: importedPanelState } = imported;

  if (tasks.length === 0 && groups.length === 0) {
    tasks = importedTasks;
    groups = importedGroups;
    if (importedStickyNotes?.length) {
      stickyNotes = importedStickyNotes;
      saveStickyNotes();
    }
    if (importedPanelState) {
      stickyPanelState = importedPanelState;
      saveStickyPanelState();
      applyStickyPanelState();
    }
  } else if (await showAppConfirm(
    `覆盖现有 ${tasks.length} 个任务、${groups.length} 个分组，导入 ${importedTasks.length} 个任务、${importedGroups.length} 个分组？`,
    { title: '导入方式', confirmText: '覆盖' },
  )) {
    tasks = importedTasks;
    groups = importedGroups;
    if (importedStickyNotes?.length) {
      stickyNotes = importedStickyNotes;
      saveStickyNotes();
    }
    if (importedPanelState) {
      stickyPanelState = importedPanelState;
      saveStickyPanelState();
      applyStickyPanelState();
    }
  } else if (await showAppConfirm(
    '合并导入？\n相同 ID 的任务以导入文件为准，分组会合并去重。',
    { title: '导入方式', confirmText: '合并' },
  )) {
    const map = new Map(tasks.map(t => [t.id, t]));
    importedTasks.forEach(t => map.set(t.id, t));
    tasks = [...map.values()];
    groups = mergeGroups(groups, importedGroups);
    if (importedStickyNotes?.length) {
      const stickyMap = new Map(stickyNotes.map(n => [n.id, n]));
      importedStickyNotes.forEach(n => stickyMap.set(n.id, n));
      stickyNotes = [...stickyMap.values()];
      saveStickyNotes();
    }
  } else {
    return false;
  }

  saveTasks();
  saveGroups();
  renderStickyNotesList();
  renderStickyModalGrid();
  render();
  return true;
}

async function handleImportFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = parseImportData(reader.result);
      if (!imported?.tasks?.length) {
        await showAppAlert('无效的文件格式，或文件中没有有效任务。');
        return;
      }
      if (await applyImport(imported)) {
        await showAppAlert(`成功导入 ${imported.tasks.length} 个任务、${imported.groups.length} 个分组。`, '导入成功');
        closeSettingsModalFn();
      }
    } catch {
      await showAppAlert('文件解析失败，请检查 JSON 格式。');
    }
    importFile.value = '';
  };
  reader.readAsText(file);
}

function renderGroupOptions(selected) {
  const opts = ['<option value="">无分组</option>'];
  groups.forEach(g => {
    const sel = g.char === selected ? ' selected' : '';
    opts.push(`<option value="${escapeHtml(g.char)}"${sel}>${escapeHtml(g.char)}</option>`);
  });
  return opts.join('');
}

function renderGroupBadge(groupChar) {
  if (!groupChar) return '';
  const color = getGroupColor(groupChar);
  const style = color
    ? ` style="background:${hexToRgba(color, 0.25)};border-color:${hexToRgba(color, 0.5)};color:${color}"`
    : '';
  return `<span class="group-badge" data-group="${escapeHtml(groupChar)}"${style}>${escapeHtml(groupChar)}</span>`;
}

function renderTodayGroupBadge(groupChar) {
  if (!groupChar) return '';
  const color = getGroupColor(groupChar);
  const style = color
    ? ` style="background:${hexToRgba(color, 0.25)};border-color:${hexToRgba(color, 0.5)};color:${color}"`
    : '';
  return `<span class="today-group-badge" data-group="${escapeHtml(groupChar)}"${style}>${escapeHtml(groupChar)}</span>`;
}

function previewNotesLine(notes) {
  if (!notes?.trim()) return '';
  const firstLine = notes.trim().split(/\r?\n/)[0].trim();
  if (!firstLine) return '';
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

function renderTaskCard(task) {
  const doneClass = task.completed ? ' completed' : '';
  const groupClass = task.group ? ' has-group' : '';
  const notesPreview = task.notes ? previewNotesLine(task.notes) : '';
  const overdueClass = isTaskOverdue(task) ? ' is-overdue' : '';
  const notesHtml = notesPreview
    ? `<span class="task-notes-preview">${escapeHtml(notesPreview)}</span>`
    : '';
  return `
    <li class="task-card${doneClass}${groupClass}${notesPreview ? ' has-notes' : ''}" draggable="true" data-id="${task.id}"${taskCardStyle(task)}>
      <label class="task-check" title="${task.completed ? '标为未完成' : '标为已完成'}">
        <input type="checkbox" data-action="toggle" data-id="${task.id}"${task.completed ? ' checked' : ''}>
      </label>
      <button type="button" class="task-card-body" data-action="open-task" data-id="${task.id}">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="task-dates${overdueClass}">${escapeHtml(formatTaskDateRange(task))}</span>
        ${notesHtml}
      </button>
    </li>
  `;
}

function renderTodayItem(task, rank) {
  return `
    <li class="today-item" data-id="${task.id}">
      <span class="today-rank">${rank}</span>
      <label class="task-check" title="标为已完成">
        <input type="checkbox" data-action="toggle" data-id="${task.id}">
      </label>
      <span class="task-title today-item-title" data-action="open-task" data-id="${task.id}" role="button" tabindex="0">${escapeHtml(task.title)}</span>
      <div class="today-tags">
        ${renderTodayGroupBadge(task.group)}
        <span class="quadrant-badge today-quadrant-badge" data-quadrant="${task.quadrant}">${QUADRANT_LABELS[task.quadrant]}</span>
      </div>
      <span class="today-time${isTaskOverdue(task) ? ' is-overdue' : ''}">${escapeHtml(formatTaskDueDate(task))}</span>
      <button class="task-action-btn delete" data-action="delete" data-id="${task.id}">删除</button>
    </li>
  `;
}

function renderQuadrantInlineAdd(quadrant) {
  return `
    <li class="quadrant-inline-add" data-quadrant="${quadrant}">
      <input type="text" class="quadrant-inline-add-input" data-quadrant="${quadrant}"
        placeholder="输入任务，Enter 添加…" maxlength="200" autocomplete="off" hidden>
    </li>
  `;
}

function openQuadrantInlineAdd(li) {
  const input = li.querySelector('.quadrant-inline-add-input');
  li.classList.add('is-editing');
  input.hidden = false;
  input.focus();
}

function closeQuadrantInlineAdd(li, clear = true) {
  const input = li.querySelector('.quadrant-inline-add-input');
  li.classList.remove('is-editing');
  input.hidden = true;
  if (clear) input.value = '';
}

function addTaskFromQuadrantInput(quadrant, inputEl) {
  const title = inputEl.value.trim();
  if (!title) {
    inputEl.focus();
    return;
  }
  addTask(title, quadrant, '');
  closeQuadrantInlineAdd(inputEl.closest('.quadrant-inline-add'), true);
}

function renderGroupSelects() {
  /* 分组选项在打开任务弹窗时填充 */
}

function getModalGroupNameWidth() {
  const font = '700 0.85rem "Noto Sans SC", sans-serif';
  const minPx = 40;
  const paddingPx = 16;
  if (groups.length === 0) return `${minPx}px`;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const maxTextWidth = Math.max(...groups.map(g => ctx.measureText(g.char).width));
  return `${Math.ceil(Math.max(minPx, maxTextWidth + paddingPx))}px`;
}

function renderModalGroups() {
  if (groups.length === 0) {
    modalGroupsList.innerHTML = '<li class="modal-groups-empty">暂无分组，上方添加分组名</li>';
    modalGroupsList.style.removeProperty('--modal-group-name-width');
    return;
  }

  modalGroupsList.style.setProperty('--modal-group-name-width', getModalGroupNameWidth());

  modalGroupsList.innerHTML = groups.map(g => `
    <li class="modal-group-item">
      ${renderGroupColorPicker(g.char, g.color)}
      <span class="modal-group-char" style="background:${hexToRgba(g.color, 0.25)};border-color:${hexToRgba(g.color, 0.5)};color:${g.color}">${escapeHtml(g.char)}</span>
      <button class="task-action-btn delete" data-action="delete-group" data-group="${escapeHtml(g.char)}">删除</button>
    </li>
  `).join('');

  bindGroupColorPickers();

  modalGroupsList.querySelectorAll('[data-action="delete-group"]').forEach(btn => {
    btn.addEventListener('click', () => deleteGroup(btn.dataset.group));
  });
}

function bindGroupColorPickers() {
  modalGroupsList.querySelectorAll('[data-action="toggle-color-picker"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const options = btn.nextElementSibling;
      const wasOpen = !options.hidden;
      closeAllGroupColorPickers();
      if (!wasOpen) openGroupColorPicker(btn, options);
    });
  });

  modalGroupsList.querySelectorAll('[data-action="pick-color"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { group: char, color } = btn.dataset;
      updateGroupColor(char, color, false);
      const item = btn.closest('.modal-group-item');
      applyGroupCharStyles(item.querySelector('.modal-group-char'), color);
      item.querySelector('.group-color-trigger').style.backgroundColor = color;
      item.querySelectorAll('.group-color-swatch').forEach(s => {
        s.classList.toggle('is-selected', s.dataset.color === color);
      });
      closeAllGroupColorPickers();
      render();
    });
  });
}

function renderStatusBar() {
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const active = total - done;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  progressRing.style.setProperty('--progress', `${rate}`);
  progressFill.style.width = `${rate}%`;
  progressBar.setAttribute('aria-valuenow', String(rate));
  progressBar.setAttribute('aria-label', `完成度 ${rate}%`);
  statusPercent.textContent = `${rate}%`;
  statusMeta.textContent = total > 0
    ? `待办 ${active} · 已完成 ${done} / ${total}`
    : '暂无任务';
}

function renderTodayTodo() {
  const todayTasks = getTodayTasks();
  todayCount.textContent = todayTasks.length;
  todayList.innerHTML = todayTasks
    .map((task, i) => renderTodayItem(task, i + 1))
    .join('');
}

function render() {
  renderStatusBar();
  renderGroupSelects();
  if (!groupModal.hidden) renderModalGroups();
  renderTodayTodo();

  QUADRANTS.forEach(q => {
    const list = document.getElementById(`${q}List`);
    let columnTasks = tasks.filter(t => t.quadrant === q);
    const active = columnTasks.filter(t => !t.completed);
    const done = columnTasks.filter(t => t.completed);

    if (!showCompleted) {
      columnTasks = active;
    }

    document.querySelector(`[data-count="${q}"]`).textContent =
      showCompleted ? columnTasks.length : `${active.length}${done.length ? `/${active.length + done.length}` : ''}`;

    if (columnTasks.length === 0) {
      list.innerHTML = renderQuadrantInlineAdd(q);
      list.classList.add('task-list--empty');
      return;
    }

    list.classList.remove('task-list--empty');

    const activeHtml = active.map(renderTaskCard).join('');
    const doneHtml = showCompleted && done.length
      ? `<li class="done-divider">已完成 ${done.length}</li>${done.map(renderTaskCard).join('')}`
      : '';

    list.innerHTML = activeHtml + doneHtml + renderQuadrantInlineAdd(q);
  });

  bindCardEvents();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function bindEvents() {
  bindThemeMenu();

  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTaskQuick();
  });

  addTaskQuickBtn.addEventListener('click', addTaskQuick);
  addTaskDetailBtn.addEventListener('click', () => {
    openAddTaskModal({ title: taskInput.value, quadrant: quickAddQuadrant });
  });
  quickAddHint.addEventListener('click', e => {
    if (e.target.closest('[data-action="skip-quick-group"]')) {
      e.preventDefault();
      skipQuickAddGroup();
    }
  });

  weekOverviewBtn?.addEventListener('click', openWeekOverviewModal);
  closeWeekOverviewModal?.addEventListener('click', closeWeekOverviewModalFn);
  weekOverviewModal?.addEventListener('click', e => {
    if (e.target === weekOverviewModal) closeWeekOverviewModalFn();
  });

  editGroupsBtn.addEventListener('click', openGroupModal);
  document.addEventListener('click', e => {
    if (groupModal.hidden || e.target.closest('.group-color-picker')) return;
    closeAllGroupColorPickers();
  });
  settingsBtn?.addEventListener('click', openSettingsModal);
  closeSettingsModal?.addEventListener('click', closeSettingsModalFn);
  settingsModal?.addEventListener('click', e => {
    if (e.target === settingsModal) closeSettingsModalFn();
  });

  closeAppDialog?.addEventListener('click', () => finishAppDialog(false));
  appDialogModal?.addEventListener('click', e => {
    if (e.target === appDialogModal) finishAppDialog(false);
  });

  closeGroupModal.addEventListener('click', closeGroupModalFn);
  groupModal.addEventListener('click', e => {
    if (e.target === groupModal) closeGroupModalFn();
  });

  closeTaskModalBtn.addEventListener('click', closeTaskModalFn);
  taskModal.addEventListener('click', e => {
    if (e.target === taskModal) closeTaskModalFn();
  });
  taskModalSave.addEventListener('click', saveTaskFromModal);
  taskModalStartDate.addEventListener('change', syncModalDueToStart);
  taskModalStartDate.addEventListener('input', syncModalDueToStart);
  taskModalDueDate.addEventListener('change', syncModalStartToDue);
  taskModalDueDate.addEventListener('input', syncModalStartToDue);
  taskModalDelete.addEventListener('click', async () => {
    if (!editingTaskId) return;
    if (!await showAppConfirm('确定删除这个任务吗？', {
      title: '删除任务',
      confirmText: '删除',
      danger: true,
    })) return;
    const id = editingTaskId;
    closeTaskModalFn();
    deleteTask(id);
  });

  addGroupBtn.addEventListener('click', () => addGroup(groupInput.value));
  groupInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addGroup(groupInput.value);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTopModal();
  });

  showDoneToggle.addEventListener('change', () => {
    showCompleted = showDoneToggle.checked;
    localStorage.setItem(SHOW_DONE_KEY, showCompleted);
    render();
  });

  clearDoneBtn.addEventListener('click', clearDoneTasks);
  exportBtn.addEventListener('click', () => {
    exportTasks();
    closeSettingsModalFn();
  });
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => handleImportFile(importFile.files[0]));

  QUADRANTS.forEach(q => {
    const list = document.getElementById(`${q}List`);
    list.addEventListener('dragover', e => {
      e.preventDefault();
      list.classList.add('drag-over');
    });
    list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
    list.addEventListener('drop', e => {
      e.preventDefault();
      list.classList.remove('drag-over');
      if (draggedId) moveTask(draggedId, q);
      draggedId = null;
    });
  });
}

function bindQuadrantInlineAddEvents() {
  document.querySelectorAll('.quadrant-inline-add').forEach(li => {
    li.addEventListener('click', () => {
      if (li.classList.contains('is-editing')) return;
      openQuadrantInlineAdd(li);
    });
  });

  document.querySelectorAll('.quadrant-inline-add-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTaskFromQuadrantInput(input.dataset.quadrant, input);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeQuadrantInlineAdd(input.closest('.quadrant-inline-add'), true);
      }
    });
    input.addEventListener('blur', () => {
      closeQuadrantInlineAdd(input.closest('.quadrant-inline-add'), true);
    });
  });
}

function bindCardEvents() {
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      if (e.target.closest('.task-check')) {
        e.preventDefault();
        return;
      }
      suppressCardClick = true;
      draggedId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedId = null;
      setTimeout(() => { suppressCardClick = false; }, 0);
    });
  });

  document.querySelectorAll('[data-action="open-task"]').forEach(el => {
    const open = () => {
      if (suppressCardClick) return;
      openTaskModal(el.dataset.id);
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });

  document.querySelectorAll('[data-action="toggle"]').forEach(input => {
    input.addEventListener('change', e => {
      e.stopPropagation();
      toggleComplete(input.dataset.id);
    });
  });

  document.querySelectorAll('.today-item .task-action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (btn.dataset.action === 'delete') deleteTask(btn.dataset.id);
    });
  });
  bindQuadrantInlineAddEvents();
}

const stickyNotesWrap = document.getElementById('stickyNotesWrap');
const stickyNotesList = document.getElementById('stickyNotesList');
const stickyNotesTab = document.getElementById('stickyNotesTab');
const stickyAddBtn = document.getElementById('stickyAddBtn');
const stickyCollapseBtn = document.getElementById('stickyCollapseBtn');
const stickyNotesModal = document.getElementById('stickyNotesModal');
const closeStickyNotesModalBtn = document.getElementById('closeStickyNotesModal');
const stickyModalAddBtn = document.getElementById('stickyModalAddBtn');
const stickyModalGrid = document.getElementById('stickyModalGrid');
const stickyModalCount = document.getElementById('stickyModalCount');
const stickyDeleteConfirmModal = document.getElementById('stickyDeleteConfirmModal');
const closeStickyDeleteConfirmBtn = document.getElementById('closeStickyDeleteConfirm');
const stickyDeleteSkipConfirm = document.getElementById('stickyDeleteSkipConfirm');
const stickyDeleteCancelBtn = document.getElementById('stickyDeleteCancelBtn');
const stickyDeleteConfirmBtn = document.getElementById('stickyDeleteConfirmBtn');

let stickySaveTimer = null;
let stickyTabDragState = null;
let suppressStickyTabClick = false;
let stickyTabClickTimer = null;

function normalizeStickyPanelState(state) {
  const edge = STICKY_EDGES.includes(state?.edge) ? state.edge : 'right';
  const offset = typeof state?.offset === 'number' && state.offset >= 0 && state.offset <= 1
    ? state.offset
    : 0.5;
  return {
    collapsed: Boolean(state?.collapsed),
    edge,
    offset,
  };
}

function normalizeImportedStickyNotes(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, index) => {
      const content = String(item?.content ?? '').slice(0, MAX_STICKY_CONTENT);
      const id = item?.id || generateId();
      const createdAt = item?.createdAt || new Date().toISOString();
      const updatedAt = item?.updatedAt || createdAt;
      if (!content && !item?.id) return null;
      return { id, content, createdAt, updatedAt };
    })
    .filter(Boolean);
}

function createStickyNote(content = '') {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    content: String(content).slice(0, MAX_STICKY_CONTENT),
    createdAt: now,
    updatedAt: now,
  };
}

function loadStickyNotes() {
  try {
    skipStickyDeleteConfirm = localStorage.getItem(STICKY_SKIP_DELETE_CONFIRM_KEY) === 'true';
  } catch {
    skipStickyDeleteConfirm = false;
  }

  try {
    const rawNotes = localStorage.getItem(STICKY_NOTES_KEY);
    stickyNotes = normalizeImportedStickyNotes(rawNotes ? JSON.parse(rawNotes) : []);
  } catch {
    stickyNotes = [];
  }

  try {
    const rawState = localStorage.getItem(STICKY_PANEL_STATE_KEY);
    stickyPanelState = normalizeStickyPanelState(rawState ? JSON.parse(rawState) : {});
  } catch {
    stickyPanelState = normalizeStickyPanelState({});
  }
}

function saveStickyNotes() {
  localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(stickyNotes));
}

function saveStickyPanelState() {
  localStorage.setItem(STICKY_PANEL_STATE_KEY, JSON.stringify(stickyPanelState));
}

function formatStickyTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function syncStickyPanelBootstrapAttrs() {
  const root = document.documentElement;
  root.setAttribute('data-sticky-collapsed', stickyPanelState.collapsed ? 'true' : 'false');
  root.setAttribute('data-sticky-edge', stickyPanelState.edge);
  root.style.setProperty('--sticky-panel-offset', `${stickyPanelState.offset * 100}%`);
  root.setAttribute('data-sticky-ready', 'true');
}

function applyStickyPanelState() {
  if (!stickyNotesWrap) return;
  stickyNotesWrap.dataset.edge = stickyPanelState.edge;
  stickyNotesWrap.dataset.collapsed = stickyPanelState.collapsed ? 'true' : 'false';
  stickyNotesWrap.style.setProperty('--sticky-offset', `${stickyPanelState.offset * 100}%`);
  if (stickyNotesTab) {
    stickyNotesTab.hidden = !stickyPanelState.collapsed;
  }
  syncStickyPanelBootstrapAttrs();
}

function setStickyPanelCollapsed(collapsed) {
  stickyPanelState.collapsed = collapsed;
  saveStickyPanelState();
  applyStickyPanelState();
}

function setStickyPanelEdge(edge, offset) {
  stickyPanelState.edge = STICKY_EDGES.includes(edge) ? edge : stickyPanelState.edge;
  if (typeof offset === 'number') {
    stickyPanelState.offset = Math.min(1, Math.max(0, offset));
  }
  saveStickyPanelState();
  applyStickyPanelState();
}

function getNearestStickyEdge(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const distances = [
    { edge: 'top', dist: y },
    { edge: 'bottom', dist: h - y },
    { edge: 'left', dist: x },
    { edge: 'right', dist: w - x },
  ];
  distances.sort((a, b) => a.dist - b.dist);
  return distances[0].edge;
}

function getStickyTabRect() {
  if (!stickyNotesTab) return null;
  return stickyNotesTab.getBoundingClientRect();
}

function getStickyOffsetForPoint(edge, x, y) {
  const rect = getStickyTabRect();
  const tabWidth = rect?.width || 48;
  const tabHeight = rect?.height || 48;
  const margin = 8;

  if (edge === 'top' || edge === 'bottom') {
    const w = window.innerWidth;
    const min = margin + tabWidth / 2;
    const max = w - margin - tabWidth / 2;
    const ratio = (x - min) / Math.max(max - min, 1);
    return Math.min(1, Math.max(0, ratio));
  }

  const h = window.innerHeight;
  const min = margin + tabHeight / 2;
  const max = h - margin - tabHeight / 2;
  const ratio = (y - min) / Math.max(max - min, 1);
  return Math.min(1, Math.max(0, ratio));
}

function updateStickyTabDragPosition(clientX, clientY, grabOffsetX, grabOffsetY) {
  stickyNotesWrap.classList.add('is-tab-free');
  stickyNotesWrap.style.setProperty('--tab-x', `${clientX - grabOffsetX}px`);
  stickyNotesWrap.style.setProperty('--tab-y', `${clientY - grabOffsetY}px`);
}

function snapStickyTabToEdge(clientX, clientY) {
  const rect = getStickyTabRect();
  const cx = rect ? rect.left + rect.width / 2 : clientX;
  const cy = rect ? rect.top + rect.height / 2 : clientY;
  const edge = getNearestStickyEdge(cx, cy);
  const offset = getStickyOffsetForPoint(edge, cx, cy);
  setStickyPanelEdge(edge, offset);
  stickyNotesWrap.classList.remove('is-tab-free');
  stickyNotesWrap.style.removeProperty('--tab-x');
  stickyNotesWrap.style.removeProperty('--tab-y');
}

function scheduleStickySave() {
  clearTimeout(stickySaveTimer);
  stickySaveTimer = setTimeout(() => saveStickyNotes(), 300);
}

function addStickyNote(content = '') {
  const note = createStickyNote(content);
  stickyNotes.unshift(note);
  saveStickyNotes();
  renderStickyNotesList();
  renderStickyModalGrid();
  return note;
}

function updateStickyNoteContent(id, content) {
  const note = stickyNotes.find(n => n.id === id);
  if (!note) return;
  note.content = String(content).slice(0, MAX_STICKY_CONTENT);
  note.updatedAt = new Date().toISOString();
  scheduleStickySave();
  syncStickyNoteViews(id);
}

function deleteStickyNote(id) {
  stickyNotes = stickyNotes.filter(n => n.id !== id);
  saveStickyNotes();
  renderStickyNotesList();
  renderStickyModalGrid();
}

function setSkipStickyDeleteConfirm(skip) {
  skipStickyDeleteConfirm = skip;
  try {
    if (skip) localStorage.setItem(STICKY_SKIP_DELETE_CONFIRM_KEY, 'true');
    else localStorage.removeItem(STICKY_SKIP_DELETE_CONFIRM_KEY);
  } catch {
    /* ignore */
  }
}

function openStickyDeleteConfirm(id) {
  if (!stickyDeleteConfirmModal) return;
  pendingStickyDeleteId = id;
  if (stickyDeleteSkipConfirm) stickyDeleteSkipConfirm.checked = false;
  stickyDeleteConfirmModal.hidden = false;
  stickyDeleteConfirmModal.classList.add('modal-overlay-top');
  updateBodyModalClass();
  stickyDeleteConfirmBtn?.focus();
}

function closeStickyDeleteConfirmFn() {
  if (!stickyDeleteConfirmModal) return;
  pendingStickyDeleteId = null;
  stickyDeleteConfirmModal.hidden = true;
  stickyDeleteConfirmModal.classList.remove('modal-overlay-top');
  updateBodyModalClass();
}

function confirmDeleteStickyNote() {
  if (stickyDeleteSkipConfirm?.checked) {
    setSkipStickyDeleteConfirm(true);
  }
  const id = pendingStickyDeleteId;
  closeStickyDeleteConfirmFn();
  if (id) deleteStickyNote(id);
}

function requestDeleteStickyNote(id) {
  if (skipStickyDeleteConfirm) {
    deleteStickyNote(id);
    return;
  }
  openStickyDeleteConfirm(id);
}

function renderStickyNoteCard(note, context) {
  const meta = note.updatedAt !== note.createdAt
    ? formatStickyTime(note.updatedAt)
    : formatStickyTime(note.createdAt);
  return `
    <div class="sticky-note-card" data-id="${note.id}" data-context="${context}">
      <button type="button" class="sticky-note-delete" data-action="delete-sticky" title="删除便签" aria-label="删除便签">×</button>
      <textarea class="sticky-note-textarea" data-id="${note.id}" maxlength="${MAX_STICKY_CONTENT}" placeholder="写点什么…">${escapeHtml(note.content)}</textarea>
      <div class="sticky-note-meta">${meta ? escapeHtml(meta) : ''}</div>
    </div>
  `;
}

function renderStickyNotesList() {
  if (!stickyNotesList) return;
  if (stickyNotes.length === 0) {
    stickyNotesList.innerHTML = '<p class="sticky-notes-empty">暂无便签<br>点击右上角 + 新建</p>';
    return;
  }
  stickyNotesList.innerHTML = stickyNotes.map(n => renderStickyNoteCard(n, 'panel')).join('');
  bindStickyNoteEvents(stickyNotesList);
}

function renderStickyModalGrid() {
  if (!stickyModalGrid) return;
  stickyModalCount.textContent = stickyNotes.length ? `共 ${stickyNotes.length} 条` : '';
  if (stickyNotes.length === 0) {
    stickyModalGrid.innerHTML = '<p class="sticky-notes-empty">还没有便签，点击上方按钮新建</p>';
    return;
  }
  stickyModalGrid.innerHTML = stickyNotes.map(n => renderStickyNoteCard(n, 'modal')).join('');
  bindStickyNoteEvents(stickyModalGrid);
}

function syncStickyNoteViews(id) {
  const note = stickyNotes.find(n => n.id === id);
  if (!note) return;
  const meta = note.updatedAt !== note.createdAt
    ? formatStickyTime(note.updatedAt)
    : formatStickyTime(note.createdAt);
  document.querySelectorAll(`.sticky-note-card[data-id="${id}"]`).forEach(card => {
    const metaEl = card.querySelector('.sticky-note-meta');
    if (metaEl) metaEl.textContent = meta;
  });
}

function bindStickyNoteEvents(container) {
  container.querySelectorAll('.sticky-note-textarea').forEach(textarea => {
    textarea.addEventListener('input', () => {
      updateStickyNoteContent(textarea.dataset.id, textarea.value);
    });
  });
  container.querySelectorAll('[data-action="delete-sticky"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card = btn.closest('.sticky-note-card');
      if (card) requestDeleteStickyNote(card.dataset.id);
    });
  });
}

function openStickyNotesModalFn() {
  if (!stickyNotesModal) return;
  renderStickyModalGrid();
  stickyNotesModal.hidden = false;
  updateBodyModalClass();
}

function closeStickyNotesModalFn() {
  if (!stickyNotesModal) return;
  stickyNotesModal.hidden = true;
  updateBodyModalClass();
}

function bindStickyTabDrag() {
  if (!stickyNotesTab || !stickyNotesWrap) return;

  stickyNotesTab.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const rect = stickyNotesTab.getBoundingClientRect();
    stickyTabDragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabOffsetX: e.clientX - rect.left,
      grabOffsetY: e.clientY - rect.top,
      moved: false,
    };
    stickyNotesTab.setPointerCapture(e.pointerId);
  });

  stickyNotesTab.addEventListener('pointermove', e => {
    if (!stickyTabDragState || stickyTabDragState.pointerId !== e.pointerId) return;
    const dx = e.clientX - stickyTabDragState.startX;
    const dy = e.clientY - stickyTabDragState.startY;
    if (!stickyTabDragState.moved && Math.hypot(dx, dy) < 6) return;

    stickyTabDragState.moved = true;
    updateStickyTabDragPosition(
      e.clientX,
      e.clientY,
      stickyTabDragState.grabOffsetX,
      stickyTabDragState.grabOffsetY,
    );
    stickyNotesTab.classList.add('is-dragging');
  });

  stickyNotesTab.addEventListener('pointerup', e => {
    if (!stickyTabDragState || stickyTabDragState.pointerId !== e.pointerId) return;
    const { moved } = stickyTabDragState;
    stickyTabDragState = null;
    stickyNotesTab.classList.remove('is-dragging');

    try {
      stickyNotesTab.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (moved) {
      suppressStickyTabClick = true;
      setTimeout(() => { suppressStickyTabClick = false; }, 300);
      snapStickyTabToEdge(e.clientX, e.clientY);
      return;
    }

    stickyNotesWrap.classList.remove('is-tab-free');
    stickyNotesWrap.style.removeProperty('--tab-x');
    stickyNotesWrap.style.removeProperty('--tab-y');

    if (stickyTabClickTimer) {
      clearTimeout(stickyTabClickTimer);
      stickyTabClickTimer = null;
      return;
    }

    stickyTabClickTimer = setTimeout(() => {
      stickyTabClickTimer = null;
      setStickyPanelCollapsed(false);
    }, 280);
  });

  stickyNotesTab.addEventListener('pointercancel', () => {
    stickyTabDragState = null;
    stickyNotesTab.classList.remove('is-dragging');
    stickyNotesWrap.classList.remove('is-tab-free');
    stickyNotesWrap.style.removeProperty('--tab-x');
    stickyNotesWrap.style.removeProperty('--tab-y');
  });

  stickyNotesTab.addEventListener('dblclick', e => {
    e.preventDefault();
    if (stickyTabClickTimer) {
      clearTimeout(stickyTabClickTimer);
      stickyTabClickTimer = null;
    }
    suppressStickyTabClick = true;
    setTimeout(() => { suppressStickyTabClick = false; }, 300);
    openStickyNotesModalFn();
  });

  stickyNotesTab.addEventListener('click', e => {
    if (suppressStickyTabClick) {
      e.preventDefault();
    }
  });
}

function initStickyNotes() {
  if (!stickyNotesWrap) return;

  applyStickyPanelState();
  renderStickyNotesList();

  stickyAddBtn?.addEventListener('click', () => {
    const note = addStickyNote('');
    const textarea = stickyNotesList?.querySelector(`.sticky-note-textarea[data-id="${note.id}"]`);
    textarea?.focus();
  });

  stickyCollapseBtn?.addEventListener('click', () => {
    setStickyPanelCollapsed(true);
  });

  stickyModalAddBtn?.addEventListener('click', () => {
    const note = addStickyNote('');
    const textarea = stickyModalGrid?.querySelector(`.sticky-note-textarea[data-id="${note.id}"]`);
    textarea?.focus();
  });

  closeStickyNotesModalBtn?.addEventListener('click', closeStickyNotesModalFn);
  stickyNotesModal?.addEventListener('click', e => {
    if (e.target === stickyNotesModal) closeStickyNotesModalFn();
  });

  closeStickyDeleteConfirmBtn?.addEventListener('click', closeStickyDeleteConfirmFn);
  stickyDeleteCancelBtn?.addEventListener('click', closeStickyDeleteConfirmFn);
  stickyDeleteConfirmBtn?.addEventListener('click', confirmDeleteStickyNote);
  stickyDeleteConfirmModal?.addEventListener('click', e => {
    if (e.target === stickyDeleteConfirmModal) closeStickyDeleteConfirmFn();
  });

  bindStickyTabDrag();
}

init();
