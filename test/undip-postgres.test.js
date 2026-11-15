import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter } from '../database.js';

// The SIAP import queries in server.js, run on PostgreSQL (production) through the same adapter.
test('SIAP import SQL works on PostgreSQL', async () => {
 const engine = new PGlite();
 const db = postgresAdapter({
  query: async (sql, args) => { const r = await engine.query(sql, args); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; },
  end: () => engine.close(),
 });
 try {
  await engine.exec(readFileSync(new URL('../schema-postgres.sql', import.meta.url), 'utf8'));
  const r = await db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run('Moreno', 1, '07:00', '09:30', 'Termodinamika', '', 'A.502');
  const id = Number(r.lastInsertRowid);
  assert.ok(id > 0);
  const s = await db.prepare('INSERT INTO schedule_sources(schedule_id,owner,source,external_id,imported) VALUES(?,?,?,?,?)').run(id, 'Moreno', 'siap', 'tkk1|a#1', Date.now());
  assert.ok(Number(s.lastInsertRowid) > 0);
  await db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run('Moreno', 6, '09:00', '11:00', 'Manual', '', '');

  const existing = await db.prepare('SELECT ss.schedule_id, ss.external_id, s.day, s.start, s.end, s.course, s.lecturer, s.room FROM schedule_sources ss JOIN schedules s ON s.id=ss.schedule_id WHERE ss.owner=? AND ss.source=?').all('Moreno', 'siap');
  assert.deepEqual(existing.map(e => [e.external_id, e.day, e.start, e.end, e.room]), [['tkk1|a#1', 1, '07:00', '09:30', 'A.502']]);

  const state = await db.prepare('SELECT s.*, ss.source FROM schedules s LEFT JOIN schedule_sources ss ON ss.schedule_id=s.id ORDER BY s.day,s.start').all();
  assert.deepEqual(state.map(x => [x.course, x.source ?? null]), [['Termodinamika', 'siap'], ['Manual', null]]);

  await db.prepare('UPDATE schedules SET day=?,start=?,end=?,course=?,lecturer=?,room=? WHERE id=? AND owner=?').run(1, '07:00', '09:30', 'Termodinamika', '', 'C.105', id, 'Moreno');
  await db.prepare('DELETE FROM schedules WHERE id=? AND owner=?').run(id, 'Moreno');
  const orphan = await db.prepare('DELETE FROM schedule_sources WHERE owner=? AND schedule_id NOT IN (SELECT id FROM schedules)').run('Moreno');
  assert.equal(orphan.changes, 1);

  await db.prepare('INSERT INTO sync_tokens(user_name,token_hash,created,last_used,last_result) VALUES(?,?,?,?,?)').run('Moreno', 'h1', Date.now(), 0, '');
  await db.prepare('UPDATE sync_tokens SET last_used=? WHERE token_hash=?').run(Date.now(), 'h1');
  await db.prepare('UPDATE sync_tokens SET last_result=? WHERE token_hash=?').run('{"ok":true}', 'h1');
  const tok = await db.prepare('SELECT user_name,last_used FROM sync_tokens WHERE token_hash=?').get('h1');
  assert.equal(tok.user_name, 'Moreno');
  assert.ok(Number(tok.last_used) > 0);
  const info = await db.prepare('SELECT created,last_used,last_result FROM sync_tokens WHERE user_name=?').get('Moreno');
  assert.equal(info.last_result, '{"ok":true}');
  assert.equal((await db.prepare('DELETE FROM sync_tokens WHERE user_name=?').run('Moreno')).changes, 1);
 } finally { await db.close(); }
});
