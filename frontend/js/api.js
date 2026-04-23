/**
 * api.js — КондитерПРО
 * Полная замена Node.js сервера через PocketBase JS SDK.
 * Совместим со всеми вызовами API.* из app.js без изменений.
 *
 * НАСТРОЙКА: укажите адрес вашего PocketBase в PB_URL.
 * Локально: http://127.0.0.1:8090
 * Railway:  https://ВАШ_ПРОЕКТ.railway.app
 */
const PB_URL = window.PB_URL || 'https://ВАШ_ПРОЕКТ.up.railway.app';

// ── PocketBase client ─────────────────────────────────────────────────────────
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false); // не отменять параллельные запросы

// ── Хелперы ───────────────────────────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

// Преобразует PB-запись в формат, совместимый с прежним app.js
// PB использует .id (CUID), app.js тоже использует .id — всё совпадает
function toRecord(r) {
  if (!r) return r;
  // Поле created в PB: "2024-01-01 12:00:00.000Z" → нормализуем
  return { ...r, created: r.created || r.created_at };
}

function toList(items) { return (items || []).map(toRecord); }

// ── CRUD factory (совместим с прежним api.js) ──────────────────────────────
function crud(collection) {
  return {
    async list() {
      const res = await pb.collection(collection).getFullList({ sort: '-created' });
      return toList(res);
    },
    async get(id) {
      const r = await pb.collection(collection).getOne(id);
      return toRecord(r);
    },
    async create(data) {
      const r = await pb.collection(collection).create(data);
      return toRecord(r);
    },
    async update(id, data) {
      const r = await pb.collection(collection).update(id, data);
      return toRecord(r);
    },
    async remove(id) {
      await pb.collection(collection).delete(id);
      return { ok: true };
    },
  };
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function pbMe() {
  if (!pb.authStore.isValid) return null;
  // Обновим токен если нужно
  try { await pb.collection('users').authRefresh(); } catch { pb.authStore.clear(); return null; }

  const u = pb.authStore.model;
  if (!u) return null;

  // Получить роль с правами
  let pages = [], roleId = u.roleId || '', roleName = '';
  try {
    const role = await pb.collection('roles').getOne(roleId);
    pages    = role.pages   || [];
    roleName = role.name    || '';
  } catch { /* роль не найдена */ }

  return { userId: u.id, username: u.username, name: u.name, roleId, roleName, pages };
}

// ── USERS (особая логика) ─────────────────────────────────────────────────────
const Users = {
  async list() {
    const res = await pb.collection('users').getFullList({ sort: '-created' });
    return toList(res);
  },
  async create({ username, name, password, roleId }) {
    // Создаём через стандартную коллекцию users (PocketBase поддерживает кастомных users)
    const r = await pb.collection('users').create({
      username, name, roleId,
      password, passwordConfirm: password,
      email: username + '@konditer.local', // PB требует email
    });
    return toRecord(r);
  },
  async update(id, payload) {
    const data = { name: payload.name, roleId: payload.roleId };
    if (payload.password) {
      data.password        = payload.password;
      data.passwordConfirm = payload.password;
    }
    const r = await pb.collection('users').update(id, data);
    return toRecord(r);
  },
  async remove(id) {
    await pb.collection('users').delete(id);
    return { ok: true };
  },
};

// ── ROLES ─────────────────────────────────────────────────────────────────────
const Roles = {
  async list() {
    const res = await pb.collection('roles').getFullList({ sort: 'name' });
    return toList(res);
  },
  async create(payload) {
    const r = await pb.collection('roles').create(payload);
    return toRecord(r);
  },
  async update(id, payload) {
    const r = await pb.collection('roles').update(id, payload);
    return toRecord(r);
  },
  async remove(id) {
    // Защита: нельзя удалить последнюю роль с rbac
    const all = await pb.collection('roles').getFullList();
    const rbacRoles = all.filter(r => r.pages && r.pages.includes('rbac'));
    if (rbacRoles.length <= 1 && rbacRoles.find(r => r.id === id)) {
      throw new Error('Нельзя удалить последнюю роль администратора');
    }
    await pb.collection('roles').delete(id);
    return { ok: true };
  },
};

// ── FILE UPLOAD ───────────────────────────────────────────────────────────────
async function uploadFile(formData) {
  const file = formData.get('file');
  if (!file) throw new Error('Файл не выбран');

  // Сохраняем файл как PB-запись в коллекции uploads
  const pbForm = new FormData();
  pbForm.append('file', file);
  pbForm.append('original', file.name);

  const rec = await pb.collection('uploads').create(pbForm);
  const url = pb.files.getUrl(rec, rec.file);

  return { filename: rec.id, original: file.name, url };
}

// ── Главный API-объект (совместим с прежним api.js) ────────────────────────
const API = {
  // CRUD ресурсы — точные имена коллекций в PocketBase
  raw:        crud('raw'),
  pkg:        crud('pkg'),
  events:     crud('events'),
  products:   crud('products'),
  plan:       crud('plan'),
  production: crud('production'),
  requests:   crud('requests'),
  roles:      Roles,
  users:      Users,

  // Авторизация
  async me() { return pbMe(); },

  async logout() {
    pb.authStore.clear();
  },

  async uploadFile(formData) {
    return uploadFile(formData);
  },

  // Прямой доступ к pb для нестандартных сценариев
  pb,
};

// ── Функция login (используется из login.html) ────────────────────────────────
async function pbLogin(username, password) {
  // PocketBase аутентифицирует по username (если настроено) или по email
  try {
    await pb.collection('users').authWithPassword(username, password);
  } catch {
    // Fallback: попробовать как email
    await pb.collection('users').authWithPassword(username + '@konditer.local', password);
  }
}
