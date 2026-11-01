import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter } from '../database.js';
import { mountParty } from '../party.js';
import { mountGame } from '../game.js';
import { mountBoardGames } from '../boardgames.js';

// Production runs on PostgreSQL (Neon), where the adapter adds RETURNING id to inserts.
// These checks drive the real route handlers against PGlite so SQLite-only assumptions show up here.
test('Nonton bareng, playlist, card and board game routes work on PostgreSQL', async () => {
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
    mountBoardGames(app, db);

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
    // Both phones acting at the same moment: neither change may be lost.
    const [played, reacted] = await Promise.all([
      call('POST /api/watch', 'Moreno', { action: 'play', position: 30 }),
      call('POST /api/watch', 'Cahya', { action: 'react', emoji: '😂' }),
    ]);
    assert.equal(played.status, 200, played.body?.error);
    assert.equal(reacted.status, 200, reacted.body?.error);
    watch = await call('GET /api/watch', 'Moreno');
    assert.deepEqual([watch.body.playing, watch.body.position, watch.body.reaction?.emoji], [true, 30, '😂'], 'a reaction sent alongside a play keeps the play');
    assert.equal(watch.body.version, paused.body.version + 2);

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

    let summary = await call('GET /api/games', 'Cahya');
    assert.equal(summary.status, 200, summary.body?.error);
    assert.deepEqual(Object.keys(summary.body.games), ['cards', 'ludo', 'four', 'snakes']);
    assert.equal(summary.body.games.ludo.status, 'none');
    assert.equal(summary.body.games.cards.status, 'playing');
    assert.equal((await call('GET /api/games/:name', 'Cahya', {}, { name: 'chess' })).status, 404);
    for (const name of ['ludo', 'four', 'snakes']) {
      const started = await call('POST /api/games/:name/new', 'Moreno', {}, { name });
      assert.equal(started.status, 200, started.body?.error);
      assert.equal(started.body.status, 'playing');
      const turn = started.body.turn;
      const body = name === 'four' ? { action: 'drop', col: 3 } : { action: 'roll' };
      assert.equal((await call('POST /api/games/:name/move', turn, { ...body, version: started.body.version - 1 }, { name })).status, 409, 'a stale version is refused');
      const moved = await call('POST /api/games/:name/move', turn, { ...body, version: started.body.version }, { name });
      assert.equal(moved.status, 200, moved.body?.error);
      assert.equal(moved.body.version, started.body.version + 1);
      assert.equal((await call('POST /api/games/:name/new', turn, {}, { name })).status, 409, 'a running round is not replaced by accident');
    }
    summary = await call('GET /api/games', 'Moreno');
    assert.equal(summary.body.games.four.status, 'playing');
    assert.equal(typeof summary.body.games.four.yourTurn, 'boolean');
  } finally { await db.close(); }
});
