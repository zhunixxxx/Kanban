const TASKS_KEY = 'daily-kanban-tasks';
const GROUPS_KEY = 'daily-kanban-groups';
const SHOW_DONE_KEY = 'daily-kanban-show-done';
const WEATHER_CACHE_KEY = 'daily-kanban-weather';
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_COORDS = { lat: 39.9042, lon: 116.4074 };

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

let tasks = [];
let groups = [];
let draggedId = null;
let suppressCardClick = false;
let editingTaskId = null;
let isAddMode = false;
let quickAddQuadrant = 'q3';
let showCompleted = localStorage.getItem(SHOW_DONE_KEY) === 'true';

const taskInput = document.getElementById('taskInput');
const quickAddHint = document.getElementById('quickAddHint');
const addTaskQuickBtn = document.getElementById('addTaskQuickBtn');
const addTaskDetailBtn = document.getElementById('addTaskDetailBtn');
const groupInput = document.getElementById('groupInput');
const addGroupBtn = document.getElementById('addGroupBtn');
const modalGroupsList = document.getElementById('modalGroupsList');
const editGroupsBtn = document.getElementById('editGroupsBtn');
const groupModal = document.getElementById('groupModal');
const closeGroupModal = document.getElementById('closeGroupModal');
const dataBtn = document.getElementById('dataBtn');
const dataModal = document.getElementById('dataModal');
const closeDataModalBtn = document.getElementById('closeDataModal');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const showDoneToggle = document.getElementById('showDoneToggle');
const currentDateEl = document.getElementById('currentDate');
const currentWeatherEl = document.getElementById('currentWeather');
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

function init() {
  loadData();
  showDoneToggle.checked = showCompleted;
  renderDate();
  loadWeather();
  render();
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
    place: coords.fallback && !place ? '北京' : place,
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

function getTodayTasks() {
  return tasks
    .filter(t => !t.completed && isTaskInTodayRange(t))
    .sort(sortByPriority);
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
  if (!groupModal.hidden || !taskModal.hidden || !dataModal.hidden) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

function closeTopModal() {
  if (!taskModal.hidden) closeTaskModalFn();
  else if (!dataModal.hidden) closeDataModalFn();
  else if (!groupModal.hidden) closeGroupModalFn();
}

function openDataModal() {
  dataModal.hidden = false;
  updateBodyModalClass();
}

function closeDataModalFn() {
  dataModal.hidden = true;
  updateBodyModalClass();
}

function openAddTaskModal(options = {}) {
  isAddMode = true;
  editingTaskId = null;
  taskModalHeading.textContent = '添加任务';
  taskModalTitle.value = options.title || '';
  taskModalGroup.innerHTML = renderGroupOptions(options.group || '');
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

function saveTaskFromModal() {
  if (isAddMode) {
    createTaskFromModal();
    return;
  }
  if (!editingTaskId) return;
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;

  const title = taskModalTitle.value.trim();
  if (!title) {
    alert('标题不能为空。');
    taskModalTitle.focus();
    return;
  }

  task.title = title;
  task.quadrant = QUADRANTS.includes(taskModalQuadrant.value)
    ? taskModalQuadrant.value
    : task.quadrant;

  const group = normalizeGroupChar(taskModalGroup.value);
  if (group) task.group = group;
  else delete task.group;

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

function createTaskFromModal() {
  const title = taskModalTitle.value.trim();
  if (!title) {
    alert('标题不能为空。');
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
  closeTaskModalFn();
}

function setQuickAddContext(quadrant) {
  quickAddQuadrant = QUADRANTS.includes(quadrant) ? quadrant : 'q3';
  updateQuickAddHint();
  taskInput.focus();
}

function updateQuickAddHint() {
  if (quickAddQuadrant === 'q3') {
    quickAddHint.hidden = true;
    quickAddHint.textContent = '';
    return;
  }
  quickAddHint.hidden = false;
  quickAddHint.textContent = `快速添加至：${QUADRANT_LABELS[quickAddQuadrant]}`;
}

function addTaskQuick() {
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    return;
  }
  addTask(title, quickAddQuadrant, '');
  taskInput.value = '';
  quickAddQuadrant = 'q3';
  updateQuickAddHint();
  taskInput.focus();
}

function addGroup(char) {
  const normalized = normalizeGroupChar(char);
  if (!normalized) {
    alert(`分组名不能为空，且不超过 ${MAX_GROUP_NAME_LENGTH} 个字符。`);
    return;
  }
  if (groups.some(g => g.char === normalized)) {
    alert(`分组「${normalized}」已存在。`);
    return;
  }
  groups.push({ char: normalized, color: nextGroupColor() });
  saveGroups();
  groupInput.value = '';
  render();
  groupInput.focus();
}

function deleteGroup(char) {
  const count = tasks.filter(t => t.group === char).length;
  const msg = count > 0
    ? `确定删除分组「${char}」？${count} 个任务将变为无分组。`
    : `确定删除分组「${char}」？`;
  if (!confirm(msg)) return;

  groups = groups.filter(g => g.char !== char);
  tasks.forEach(t => {
    if (t.group === char) delete t.group;
  });
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

function clearDoneTasks() {
  const doneCount = tasks.filter(t => t.completed).length;
  if (doneCount === 0) return;
  if (!confirm(`确定清除 ${doneCount} 个已完成任务吗？`)) return;
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  render();
}

function exportTasks() {
  const data = {
    version: 3,
    exportedAt: new Date().toISOString(),
    groups,
    tasks,
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
  };
}

function mergeGroups(existing, imported) {
  const map = new Map(existing.map(g => [g.char, g]));
  imported.forEach(g => map.set(g.char, g));
  return [...map.values()];
}

function applyImport(imported) {
  const { tasks: importedTasks, groups: importedGroups } = imported;

  if (tasks.length === 0 && groups.length === 0) {
    tasks = importedTasks;
    groups = importedGroups;
  } else if (confirm(`覆盖现有 ${tasks.length} 个任务、${groups.length} 个分组，导入 ${importedTasks.length} 个任务、${importedGroups.length} 个分组？\n\n确定 = 覆盖\n取消 = 进入合并模式`)) {
    tasks = importedTasks;
    groups = importedGroups;
  } else if (confirm(`合并导入？\n相同 ID 的任务以导入文件为准，分组会合并去重。`)) {
    const map = new Map(tasks.map(t => [t.id, t]));
    importedTasks.forEach(t => map.set(t.id, t));
    tasks = [...map.values()];
    groups = mergeGroups(groups, importedGroups);
  } else {
    return false;
  }

  saveTasks();
  saveGroups();
  render();
  return true;
}

function handleImportFile(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = parseImportData(reader.result);
      if (!imported?.tasks?.length) {
        alert('无效的文件格式，或文件中没有有效任务。');
        return;
      }
      if (applyImport(imported)) {
        alert(`成功导入 ${imported.tasks.length} 个任务、${imported.groups.length} 个分组。`);
        closeDataModalFn();
      }
    } catch {
      alert('文件解析失败，请检查 JSON 格式。');
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

function renderTodayQuickAdd() {
  return `
    <li class="list-quick-add today-quick-add">
      <button type="button" class="list-quick-add-btn" data-action="quick-add">+ 添加新任务</button>
    </li>
  `;
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

  if (todayTasks.length === 0) {
    todayList.innerHTML = renderTodayQuickAdd();
    return;
  }

  todayList.innerHTML = todayTasks
    .map((task, i) => renderTodayItem(task, i + 1))
    .join('') + renderTodayQuickAdd();
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
  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTaskQuick();
  });

  addTaskQuickBtn.addEventListener('click', addTaskQuick);
  addTaskDetailBtn.addEventListener('click', () => openAddTaskModal({ quadrant: quickAddQuadrant }));

  editGroupsBtn.addEventListener('click', openGroupModal);
  document.addEventListener('click', e => {
    if (groupModal.hidden || e.target.closest('.group-color-picker')) return;
    closeAllGroupColorPickers();
  });
  dataBtn.addEventListener('click', openDataModal);
  closeDataModalBtn.addEventListener('click', closeDataModalFn);
  dataModal.addEventListener('click', e => {
    if (e.target === dataModal) closeDataModalFn();
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
  taskModalDelete.addEventListener('click', () => {
    if (!editingTaskId) return;
    if (!confirm('确定删除这个任务吗？')) return;
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
    closeDataModalFn();
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

function bindQuickAddEvents() {
  document.querySelectorAll('[data-action="quick-add"]').forEach(el => {
    el.addEventListener('click', () => {
      setQuickAddContext(el.dataset.quadrant || 'q3');
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
  bindQuickAddEvents();
  bindQuadrantInlineAddEvents();
}

init();
