import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('SIAP import: preview, apply, re-sync keeps manual schedules, owner only', async () => {
 const temp = mkdtempSync(join(tmpdir(), 'snoomy-undip-'));
 const port = '31993', base = `http://127.0.0.1:${port}/api`;
 const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'test', VERCEL: '', PORT: port, DB_PATH: join(temp, 'test.sqlite'), MORENO_PIN: '1234', CAHYA_PIN: '5678', COOKIE_SECURE: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
 await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Server timeout')), 30000); child.once('exit', code => { clearTimeout(timer); reject(Error('Server exited ' + code)); }); child.stdout.on('data', d => { if (String(d).includes('siap')) { clearTimeout(timer); resolve(); } }); child.stderr.on('data', () => {}); });
 async function request(path, method = 'GET', body, cookie) {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
 }
 const login = async (user, pin) => (await request('/login', 'POST', { user, pin })).cookie;
 try {
  assert.equal((await request('/undip/preview', 'POST', { text: 'x' })).status, 401);
  const moreno = await login('Moreno', '1234'), cahya = await login('Cahya', '5678');
  // Manual schedules of both users must survive every import.
  const manual = await request('/schedules', 'POST', { day: 6, start: '09:00', end: '11:00', course: 'Asistensi lab', lecturer: '', room: '' }, moreno);
  await request('/schedules', 'POST', { day: 1, start: '08:00', end: '10:00', course: 'Kelas Cahya', lecturer: '', room: '' }, cahya);

  const v1 = JSON.stringify({ data: [
   { hari: 'Senin', kode_mk: 'TKK1', nama_kelas: 'A', nama_mk: 'Termodinamika', nama_ruang: 'A.502', waktu_mulai: '07:00', waktu_selesai: '09:30', nama_dosen: 'Dr. Satu' },
   { hari: 'Rabu', kode_mk: 'TKK2', nama_kelas: 'A', nama_mk: 'Perpindahan Panas', nama_ruang: 'B.201', waktu_mulai: '10:00', waktu_selesai: '12:30' },
  ] });
  assert.equal((await request('/undip/preview', 'POST', { text: 'halo' }, moreno)).status, 400);
  const preview = await request('/undip/preview', 'POST', { text: v1 }, moreno);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.add.length, 2);
  assert.equal(preview.body.total, 2);
  // Preview writes nothing.
  assert.equal((await request('/state', 'GET', null, moreno)).body.schedules.length, 2);

  const applied = await request('/undip/import', 'POST', { text: v1 }, moreno);
  assert.deepEqual(applied.body, { added: 2, updated: 0, removed: 0, same: 0 });
  let state = (await request('/state', 'GET', null, moreno)).body.schedules;
  assert.equal(state.length, 4);
  assert.equal(state.filter(s => s.source === 'siap').length, 2);
  assert.ok(state.every(s => s.source === 'siap' ? s.owner === 'Moreno' : true));

  // Same data again: nothing changes.
  assert.deepEqual((await request('/undip/import', 'POST', { text: v1 }, moreno)).body, { added: 0, updated: 0, removed: 0, same: 2 });

  // Room moved for Termodinamika, Perpindahan Panas dropped, a new class added.
  const v2 = JSON.stringify([
   { hari: 'Senin', kode_mk: 'TKK1', nama_kelas: 'A', nama_mk: 'Termodinamika', nama_ruang: 'C.105', waktu_mulai: '07:00', waktu_selesai: '09:30', nama_dosen: 'Dr. Satu' },
   { hari: 'Kamis', kode_mk: 'TKK3', nama_kelas: 'B', nama_mk: 'Kimia Fisika', nama_ruang: 'E.201', waktu_mulai: '13:00', waktu_selesai: '15:30' },
  ]);
  const p2 = (await request('/undip/preview', 'POST', { text: v2 }, moreno)).body;
  assert.deepEqual([p2.add.length, p2.update.length, p2.remove.length], [1, 1, 1]);
  assert.deepEqual(p2.update[0].changes, ['room']);
  assert.deepEqual((await request('/undip/import', 'POST', { text: v2 }, moreno)).body, { added: 1, updated: 1, removed: 1, same: 0 });
  state = (await request('/state', 'GET', null, moreno)).body.schedules;
  assert.ok(state.some(s => s.id === manual.body.id && s.course === 'Asistensi lab' && !s.source));
  assert.ok(state.some(s => s.course === 'Kelas Cahya'));
  assert.ok(!state.some(s => s.course === 'Perpindahan Panas'));
  assert.equal(state.find(s => s.course === 'Termodinamika').room, 'C.105');

  // Cahya's import only touches Cahya's rows.
  await request('/undip/import', 'POST', { text: 'Selasa 10:00-11:40 Biokimia | D.101' }, cahya);
  state = (await request('/state', 'GET', null, cahya)).body.schedules;
  assert.equal(state.filter(s => s.owner === 'Moreno' && s.source === 'siap').length, 2);
  assert.equal(state.find(s => s.course === 'Biokimia').owner, 'Cahya');

  // A deleted imported class can be imported again; keepMissing leaves old rows alone.
  const termo = state.find(s => s.course === 'Termodinamika');
  assert.equal((await request('/schedules/' + termo.id, 'DELETE', {}, moreno)).status, 200);
  assert.deepEqual((await request('/undip/import', 'POST', { text: v2 }, moreno)).body, { added: 1, updated: 0, removed: 0, same: 1 });
  assert.deepEqual((await request('/undip/import', 'POST', { text: 'Jumat 07:00-08:40 Kalkulus', keepMissing: true }, moreno)).body, { added: 1, updated: 0, removed: 0, same: 0 });
  assert.equal((await request('/state', 'GET', null, moreno)).body.schedules.filter(s => s.owner === 'Moreno' && s.source === 'siap').length, 3);
 } finally {
  if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
  rmSync(temp, { recursive: true, force: true });
 }
});

test('extension push: personal token, hash-only storage, owner scoping, rate limit, revoke', async () => {
 const temp = mkdtempSync(join(tmpdir(), 'snoomy-push-'));
 const port = '31994', origin = `http://127.0.0.1:${port}`, base = origin + '/api';
 const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'test', VERCEL: '', PORT: port, DB_PATH: join(temp, 'test.sqlite'), MORENO_PIN: '1234', CAHYA_PIN: '5678', COOKIE_SECURE: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
 await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Server timeout')), 30000); child.once('exit', code => { clearTimeout(timer); reject(Error('Server exited ' + code)); }); child.stdout.on('data', d => { if (String(d).includes('siap')) { clearTimeout(timer); resolve(); } }); child.stderr.on('data', () => {}); });
 async function request(path, method = 'GET', body, headers = {}) {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
 }
 const login = async (user, pin) => (await request('/login', 'POST', { user, pin })).cookie;
 const page = 'No\tHari\tMatakuliah\tRuangan\tWaktu\tSks\tHadir\tAksi\n1\tsenin\tMata Kuliah Satu\tE 1.1\t08:00:00 s/d 08:50:00\t1.0\t\n57.1%\n2\tkamis\tMata Kuliah Dua\tA 3.1\t18:30:00 s/d 20:10:00\t2.0\t\n71.4%\n';
 try {
  const moreno = await login('Moreno', '1234');
  assert.equal((await request('/undip/token', 'POST', {})).status, 401);
  assert.deepEqual((await request('/undip/token', 'GET', null, { cookie: moreno })).body, { exists: false });
  const created = await request('/undip/token', 'POST', {}, { cookie: moreno });
  assert.equal(created.status, 201);
  const token = created.body.token;
  assert.match(token, /^snm_[A-Za-z0-9_-]{40,}$/);

  assert.equal((await request('/undip/push', 'POST', { text: page })).status, 401);
  assert.equal((await request('/undip/push', 'POST', { text: page }, { authorization: 'Bearer snm_' + 'x'.repeat(43) })).status, 401);
  const pushed = await request('/undip/push', 'POST', { text: page }, { authorization: 'Bearer ' + token });
  assert.equal(pushed.status, 200);
  assert.deepEqual(pushed.body, { user: 'Moreno', ok: true, added: 2, updated: 0, removed: 0, same: 0 });
  assert.equal((await request('/undip/push', 'POST', { text: page }, { authorization: 'Bearer ' + token })).status, 429);

  const info = (await request('/undip/token', 'GET', null, { cookie: moreno })).body;
  assert.equal(info.exists, true);
  assert.ok(info.lastUsed > 0);
  assert.equal(info.lastResult.added, 2);
  assert.ok(!JSON.stringify(info).includes(token));

  const state = (await request('/state', 'GET', null, { cookie: moreno })).body.schedules;
  assert.equal(state.filter(s => s.source === 'siap' && s.owner === 'Moreno').length, 2);

  // A new token replaces the old one; revoking stops pushes.
  const second = (await request('/undip/token', 'POST', {}, { cookie: moreno })).body.token;
  assert.equal((await request('/undip/push', 'POST', { text: page }, { authorization: 'Bearer ' + token })).status, 401);
  assert.equal((await request('/undip/token', 'DELETE', {}, { cookie: moreno })).status, 200);
  assert.equal((await request('/undip/push', 'POST', { text: page }, { authorization: 'Bearer ' + second })).status, 401);
 } finally {
  if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
  rmSync(temp, { recursive: true, force: true });
 }
});
