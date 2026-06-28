/**
 * data.js — Schedule App Data Layer  v1.0
 * ─────────────────────────────────────────
 * ไฟล์นี้เก็บ logic ทั้งหมดที่เกี่ยวกับการบันทึก/โหลดข้อมูล
 * วางไว้ในโฟลเดอร์เดียวกับ index.html
 *
 * localStorage keys ที่ใช้:
 *   sched_users          → { username: { pass, created } }
 *   sched_events_<user>  → event[] ของแต่ละ user
 *   sched_session        → username ที่ login อยู่
 *
 * อัปเดต index.html ได้เสรี — ข้อมูลอยู่ใน localStorage
 * ผ่าน key คงที่ข้างบน ไม่หาย
 */

'use strict';

/* ── Schema version ──────────────────────────────────────
   เพิ่มเลขนี้เมื่อโครงสร้าง event เปลี่ยน
   migrate() จะรันอัตโนมัติเมื่อเปิดแอป               */
const DB_VERSION = 1;

/* ── Internal keys ───────────────────────────────────── */
const KEY_USERS   = 'sched_users';
const KEY_SESSION = 'sched_session';
const KEY_DBVER   = 'sched_db_version';
function _evKey(username) { return 'sched_events_' + username; }

/* ══════════════════════════════════════════════════════
   USER / AUTH
══════════════════════════════════════════════════════ */

/** ดึง object users ทั้งหมด  { username: {pass, created} } */
function DB_getUsers() {
  try { return JSON.parse(localStorage.getItem(KEY_USERS) || '{}'); }
  catch(e) { return {}; }
}

/** บันทึก object users ทั้งหมด */
function DB_saveUsers(users) {
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
}

/** สมัครสมาชิก — คืน null ถ้าสำเร็จ, คืน error string ถ้าไม่สำเร็จ */
function DB_register(username, password) {
  if (!username) return 'กรุณากรอกชื่อผู้ใช้';
  if (password.length < 4) return 'รหัสผ่านต้องมีอย่างน้อย 4 ตัว';
  const users = DB_getUsers();
  if (users[username]) return 'ชื่อผู้ใช้นี้ถูกใช้แล้ว';
  users[username] = { pass: btoa(unescape(encodeURIComponent(password))), created: Date.now() };
  DB_saveUsers(users);
  return null;
}

/** ตรวจ login — คืน null ถ้าสำเร็จ, คืน error string ถ้าไม่สำเร็จ */
function DB_login(username, password) {
  const users = DB_getUsers();
  if (!users[username]) return 'ไม่พบชื่อผู้ใช้นี้';
  const hash = btoa(unescape(encodeURIComponent(password)));
  if (users[username].pass !== hash) return 'รหัสผ่านไม่ถูกต้อง';
  return null;
}

/** บันทึก session (ชื่อ user ที่ login อยู่) */
function DB_setSession(username) {
  if (username) localStorage.setItem(KEY_SESSION, username);
  else          localStorage.removeItem(KEY_SESSION);
}

/** อ่าน session ปัจจุบัน — คืน username หรือ null */
function DB_getSession() {
  const u = localStorage.getItem(KEY_SESSION);
  if (!u) return null;
  // ตรวจว่า user ยังมีอยู่จริง
  return DB_getUsers()[u] ? u : null;
}

/* ══════════════════════════════════════════════════════
   EVENTS
══════════════════════════════════════════════════════ */

/** โหลด events ของ user — คืน array หรือ null ถ้าไม่มีข้อมูล */
function DB_loadEvents(username) {
  try {
    const raw = localStorage.getItem(_evKey(username));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return _migrate(data);
  } catch(e) { return null; }
}

/** บันทึก events ของ user */
function DB_saveEvents(username, eventsArray) {
  localStorage.setItem(_evKey(username), JSON.stringify(eventsArray));
}

/* ══════════════════════════════════════════════════════
   MIGRATION
   เพิ่ม case ใหม่ที่นี่เมื่อโครงสร้าง event เปลี่ยน
══════════════════════════════════════════════════════ */
function _migrate(eventsArray) {
  // ตัวอย่าง migration: ถ้า event ยังไม่มี field "important" ให้เพิ่มค่า default
  return eventsArray.map(ev => ({
    important:    false,
    notifyBefore: 15,
    desc:         '',
    color:        '#007aff',
    ...ev,   // ข้อมูลเดิมทับ default
  }));
}

/* ══════════════════════════════════════════════════════
   EXPORT / IMPORT  (สำรองข้อมูลเป็น JSON)
══════════════════════════════════════════════════════ */

/** Export ข้อมูลของ user เป็น JSON string */
function DB_exportUser(username) {
  return JSON.stringify({
    version:  DB_VERSION,
    exported: new Date().toISOString(),
    username,
    events:   DB_loadEvents(username) || [],
  }, null, 2);
}

/** Import JSON string ทับข้อมูลของ user — คืน {ok, count, error} */
function DB_importUser(username, jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data.events)) return { ok: false, error: 'รูปแบบไฟล์ไม่ถูกต้อง' };
    DB_saveEvents(username, _migrate(data.events));
    return { ok: true, count: data.events.length };
  } catch(e) {
    return { ok: false, error: 'ไม่สามารถอ่านไฟล์ได้: ' + e.message };
  }
}

/* ══════════════════════════════════════════════════════
   DEBUG HELPERS  (เรียกใน console ได้)
══════════════════════════════════════════════════════ */

/** แสดงรายชื่อ users ทั้งหมดใน console */
function DB_listUsers() {
  const u = DB_getUsers();
  console.table(Object.entries(u).map(([name, v]) => ({
    name, created: new Date(v.created).toLocaleString('th-TH')
  })));
}

/** แสดงจำนวน events ของแต่ละ user */
function DB_stats() {
  const users = DB_getUsers();
  Object.keys(users).forEach(u => {
    const ev = DB_loadEvents(u);
    console.log(`${u}: ${ev ? ev.length : 0} events`);
  });
}
