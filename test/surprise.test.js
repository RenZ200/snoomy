import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import { postgresAdapter } from '../database.js';
import { mountSurprise } from '../surprise.js';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]).toString('base64');

async function run(db, close) {
  let now = Date.parse('2026-11-18T16:59:00Z'); // 23.59 WIB on the 18th
  const app = express();
  app.use(express.json({ limit: '1600kb' }));
  app.use((req, res, next) => { req.user = req.get('x-user'); next(); });
  mountSurprise(app, db, { clock: () => now });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/surprise`;
  const call = async (user, path = '', body) => {
    const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-user': user, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, type: res.headers.get('content-type'), body: res.headers.get('content-type')?.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  try {
    assert.equal((await call('Moreno')).body.ready, false);
    assert.equal((await call('Cahya', '/item', { position: 1, meta: { title: 'x' } })).status, 403, 'only Moreno fills it in');
    assert.equal((await call('Moreno', '/item', { position: 1, meta: { title: 'x' }, photo: 'aGVsbG8gd29ybGQ=' })).status, 400, 'not a JPEG');
    assert.equal((await call('Moreno', '/item', { position: 0, meta: { poem: 'puisi rahasia' } })).status, 200);
    assert.equal((await call('Moreno', '/item', { position: 1, meta: { title: 'Cermin', line: 'baris' }, photo: jpeg })).status, 200);
    assert.equal((await call('Moreno', '/item', { position: 1, meta: { title: 'Cermin baru', line: 'baris' }, photo: jpeg })).status, 200, 'uploading again replaces');

    // Before the day Cahya gets nothing, not even a hint; Moreno can preview.
    const early = await call('Cahya');
    assert.deepEqual(early.body, { show: false });
    assert.equal((await call('Cahya', '/photo/1')).status, 403);
    const preview = (await call('Moreno')).body;
    assert.deepEqual([preview.show, preview.author, preview.ready, preview.autoOpen, preview.text.poem, preview.items[0].title], [false, true, true, false, 'puisi rahasia', 'Cermin baru']);
    assert.equal((await call('Moreno', '/photo/1')).status, 200);

    now = Date.parse('2026-11-18T17:00:00Z'); // midnight WIB, the 19th
    const day = (await call('Cahya')).body;
    assert.deepEqual([day.show, day.autoOpen, day.author, day.items.length], [true, true, false, 1]);
    const photo = await call('Cahya', '/photo/1');
    assert.deepEqual([photo.status, photo.type, photo.body[0]], [200, 'image/jpeg', 0xff]);
    assert.equal((await call('Moreno')).body.autoOpen, false, 'it only opens by itself for Cahya');
    now = Date.parse('2026-12-01T05:00:00Z');
    assert.deepEqual([(await call('Cahya')).body.show, (await call('Cahya')).body.autoOpen], [true, false], 'it stays available, without popping up');

    assert.equal((await call('Cahya', '/clear', {})).status, 403);
    assert.equal((await call('Moreno', '/clear', {})).status, 200);
    assert.equal((await call('Cahya')).body.show, false);
  } finally { server.close(); await close(); }
}

test('surprise stays locked for Cahya until 19 November WIB (SQLite)', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await run(sqlite, () => sqlite.close());
});

test('surprise routes work on PostgreSQL', async () => {
  const engine = new PGlite();
  await engine.exec(readFileSync(new URL('../schema-postgres.sql', import.meta.url), 'utf8'));
  const db = postgresAdapter({ query: async (sql, args) => { const r = await engine.query(sql, args); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; }, end: () => engine.close() });
  await run(db, () => db.close());
});
