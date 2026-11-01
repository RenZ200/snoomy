import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter } from '../database.js';
import { mountParty } from '../party.js';
import { mountGame } from '../game.js';
import { mountBoardGames } from '../boardgames.js';
import { mountReal, mountRealTick } from '../real.js';
import { createPush } from '../push.js';
import webpush from 'web-push';

// Production runs on PostgreSQL (Neon), where the adapter adds RETURNING id to inserts.
// These checks drive the real route handlers against PGlite so SQLite-only assumptions show up here.
test('Nonton bareng, playlist, games and Real routes work on PostgreSQL', async () => {
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
    const res = { status(code) { status = code; return res; }, json(value) { payload = value; return res; }, set() { return res; }, end(value) { payload = value; return res; } };
    try { await routes[key]({ user, body, params }, res); }
    catch (error) { status = error.status || 500; payload = { error: error.message }; }
    return { status, body: payload };
  };
  try {
    await engine.exec(readFileSync(new URL('../schema-postgres.sql', import.meta.url), 'utf8'));
    mountParty(app, db);
    mountGame(app, db);
    mountBoardGames(app, db);
    let clock = Date.parse('2026-11-01T09:00:00Z'); // 16.00 WIB; with rand 0 the hidden time was 09.00 WIB
    const delivered = [];
    const push = createPush(db, { send: async (subscription, body) => { delivered.push([subscription.endpoint, JSON.parse(body).title]); } });
    push.mount(app);
    mountRealTick(app, db, { clock: () => clock, rand: () => 0, push });
    mountReal(app, db, { clock: () => clock, rand: () => 0, push });

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

    // Push: stored keys, ON CONFLICT ... DO UPDATE with excluded, and the IN (...) lookup.
    const key = (await call('GET /api/push', 'Moreno')).body.publicKey;
    assert.equal(key, (await push.vapid()).publicKey);
    const subscription = { endpoint: 'https://push.example/pg', keys: { p256dh: webpush.generateVAPIDKeys().publicKey, auth: 'c2VjcmV0c2VjcmV0MTIz' } };
    assert.equal((await call('POST /api/push/subscribe', 'Moreno', { subscription })).status, 201);
    assert.equal((await call('POST /api/push/subscribe', 'Cahya', { subscription })).status, 201, 'the same phone moves to Cahya');
    assert.equal((await call('GET /api/push', 'Moreno')).body.devices, 0);
    assert.equal((await call('GET /api/push', 'Cahya')).body.devices, 1);

    // Real: BIGINT moments, ON CONFLICT, the kept flag and the both-posted streak query.
    assert.equal((await call('GET /api/real/tick', 'nobody')).status, 204, 'the tick starts the due Real and tells the phones');
    assert.deepEqual(delivered, [['https://push.example/pg', '⚡ Waktunya Real!']]);
    const jpeg = size => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, 9)]).toString('base64')}`;
    const shot = { main: jpeg(2000), inset: jpeg(600), thumb: jpeg(200) };
    let real = await call('GET /api/real/status', 'Moreno');
    assert.equal(real.status, 200, real.body?.error);
    assert.deepEqual([real.body.started, real.body.at], [true, clock], 'it started when the tick came, not at the hidden time');
    const posted = await call('POST /api/real', 'Moreno', shot);
    assert.equal(posted.status, 201, posted.body?.error);
    assert.deepEqual([posted.body.mine.late, posted.body.mine.full], [0, true]);
    assert.deepEqual(delivered.at(-1), ['https://push.example/pg', 'Moreno baru posting Real ✨']);
    const photo = { id: String(posted.body.mine.id), kind: 'main' };
    assert.equal((await call('GET /api/real/:id/:kind', 'Cahya', {}, photo)).status, 403);
    assert.equal((await call('POST /api/real', 'Moreno', shot)).status, 409);
    assert.equal((await call('POST /api/real', 'Cahya', shot)).status, 201);
    const bytes = await call('GET /api/real/:id/:kind', 'Cahya', {}, photo);
    assert.equal(bytes.status, 200);
    assert.ok(Buffer.isBuffer(bytes.body) && bytes.body[0] === 0xff);
    assert.deepEqual((await call('POST /api/real/:id/react', 'Cahya', { emoji: '🔥' }, { id: photo.id })).body.reactions, { Cahya: '🔥' });
    clock += 86400000;
    real = await call('GET /api/real', 'Cahya');
    assert.equal(real.body.streak, 1);
    assert.deepEqual([real.body.memories[0].Moreno.full, real.body.memories[0].Moreno.reactions], [true, { Cahya: '🔥' }]);
  } finally { await db.close(); }
});
