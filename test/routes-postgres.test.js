import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter } from '../database.js';
import { mountParty } from '../party.js';
import { mountGame } from '../game.js';

// Production runs on PostgreSQL (Neon), where the adapter adds RETURNING id to inserts.
// These checks drive the real route handlers against PGlite so SQLite-only assumptions show up here.
test('Nonton bareng, playlist and card game routes work on PostgreSQL', async () => {
  process.env.SNOOMY_OFFLINE = '1';
  const engine = new PGlite();
  const db = postgresAdapter({
    query: async (sql, args) => { const r = await engine.query(sql, args); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; },
    end: () => engine.close(),
  });
  const routes = {};
  const app = Object.fromEntries(['get', 'post', 'delete'].map(method => [method, (path, handler) => { routes[`${method.toUpperCase()} ${path}`] = handler; }]));
  const call = async (key, user, body = {}, params = {}) => {
    let status = 200, payload;
    const res = { status(code) { status = code; return res; }, json(value) { payload = value; return res; } };
    try { await routes[key]({ user, body, params }, res); }
    catch (error) { status = error.status || 500; payload = { error: error.message }; }
    return { status, body: payload };
  };
  try {
    await engine.exec(readFileSync(new URL('../schema-postgres.sql', import.meta.url), 'utf8'));
    mountParty(app, db);
    mountGame(app, db);

    let watch = await call('GET /api/watch', 'Moreno');
    assert.equal(watch.status, 200, watch.body?.error);
    assert.equal(watch.body.videoId, null);
    assert.equal(watch.body.partner.online, false);
    assert.equal((await call('GET /api/watch', 'Cahya')).status, 200);
    watch = await call('GET /api/watch', 'Moreno');
    assert.equal(watch.body.partner.online, true, 'presence is stored and read back');
    const loaded = await call('POST /api/watch', 'Moreno', { action: 'load', url: 'https://youtu.be/dQw4w9WgXcQ?t=7' });
    assert.equal(loaded.status, 200, loaded.body?.error);
    assert.deepEqual([loaded.body.videoId, loaded.body.position, loaded.body.playing], ['dQw4w9WgXcQ', 7, true]);
    assert.equal(typeof loaded.body.version, 'number');
    const paused = await call('POST /api/watch', 'Cahya', { action: 'pause', position: 21.5 });
    assert.equal(paused.body.version, loaded.body.version + 1);
    watch = await call('GET /api/watch', 'Moreno');
    assert.deepEqual([watch.body.playing, watch.body.position, watch.body.by], [false, 21.5, 'Cahya']);

    const added = await call('POST /api/music', 'Cahya', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Lagu kita' });
    assert.equal(added.status, 201, added.body?.error);
    assert.equal(typeof added.body.id, 'number');
    assert.deepEqual((await call('GET /api/music', 'Moreno')).body.tracks.map(t => [t.videoId, t.title, t.addedBy]), [['dQw4w9WgXcQ', 'Lagu kita', 'Cahya']]);
    assert.equal((await call('DELETE /api/music/:id', 'Moreno', {}, { id: String(added.body.id) })).status, 200);

    const game = await call('POST /api/game/new', 'Moreno');
    assert.equal(game.status, 200, game.body?.error);
    assert.equal(game.body.hand.length, 7);
    const mover = game.body.turn;
    const drew = await call('POST /api/game/draw', mover, { version: (await call('GET /api/game', mover)).body.version });
    assert.equal(drew.status, 200, drew.body?.error);
  } finally { await db.close(); }
});
