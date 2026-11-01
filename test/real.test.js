import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { mountReal, dayOf, startOf, shiftDay, pickMoment, streak, image, WINDOW } from '../real.js';

const jpeg = (size = 2000, fill = 7) => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, fill)]).toString('base64')}`;
const photos = fill => ({ main: jpeg(3000, fill), inset: jpeg(800, fill), thumb: jpeg(300, fill) });
const HOUR = 3600000, DAY = 24 * HOUR;

test('moments fall between 09.00 and 21.00 WIB on their own day', () => {
  assert.equal(dayOf(Date.parse('2026-11-01T16:59:59Z')), '2026-11-01', '23.59 WIB is still the same day');
  assert.equal(dayOf(Date.parse('2026-11-01T17:00:00Z')), '2026-11-02', '00.00 WIB starts the next day');
  assert.equal(startOf('2026-11-02'), Date.parse('2026-11-01T17:00:00Z'));
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(pickMoment('2026-11-01', () => 0), Date.parse('2026-11-01T02:00:00Z'), 'earliest is 09.00 WIB');
  assert.equal(pickMoment('2026-11-01', n => n - 1), Date.parse('2026-11-01T13:59:59Z'), 'latest is 20.59.59 WIB');
  assert.equal(streak(['2026-10-30', '2026-10-31', '2026-11-01'], '2026-11-01'), 3);
  assert.equal(streak(['2026-10-30', '2026-10-31'], '2026-11-01'), 2, 'an unfinished today keeps the streak');
  assert.equal(streak(['2026-10-29', '2026-10-31'], '2026-11-01'), 1);
  assert.equal(streak([], '2026-11-01'), 0);
});

test('photos are checked by their bytes and size', () => {
  assert.throws(() => image('data:image/png;base64,AAAA', 1000, 'Foto'), /tidak valid/);
  assert.throws(() => image(`data:image/jpeg;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`, 1000, 'Foto'), /tidak valid/);
  assert.throws(() => image(jpeg(5000), 1000, 'Foto'), /terlalu besar/);
  assert.throws(() => image(undefined, 1000, 'Foto'), /tidak valid/);
  assert.equal(typeof image(jpeg(100), 1000, 'Foto'), 'string');
});

test('Real API: one moment a day, locked until you post, late posts, reactions, memories and clean-up', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  let now = Date.parse('2026-11-01T01:00:00Z'); // 08.00 WIB, before any moment
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => { req.user = req.get('x-user'); next(); });
  // rand(n) = n/2 puts every moment at 15.00.30 WIB.
  mountReal(app, db, { clock: () => now, rand: n => Math.floor(n / 2) });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/real`;
  const call = async (user, path = '', body, method = body ? 'POST' : 'GET') => {
    const res = await fetch(base + path, { method, headers: { 'x-user': user, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const type = res.headers.get('content-type') || '';
    return { status: res.status, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()), type, cache: res.headers.get('cache-control') };
  };
  try {
    const moment = Date.parse('2026-11-01T08:00:30Z');
    let status = (await call('Moreno', '/status')).body;
    assert.deepEqual([status.day, status.started, status.at, status.you, status.partner], ['2026-11-01', false, null, false, false], 'the moment stays secret until it happens');
    assert.equal((await call('Moreno', '', photos(1))).status, 409, 'no posting before the moment');

    now = moment + 60000;
    status = (await call('Cahya', '/status')).body;
    assert.deepEqual([status.started, status.at, status.window], [true, moment, WINDOW], 'both phones see the same moment');
    assert.equal((await call('Moreno', '', { ...photos(1), main: 'data:image/png;base64,AAAA' })).status, 400);
    const posted = await call('Moreno', '', { ...photos(1), caption: '  kopi pagi   ' });
    assert.equal(posted.status, 201, posted.body.error);
    assert.deepEqual([posted.body.mine.late, posted.body.mine.caption, posted.body.mine.full], [60000, 'kopi pagi', true]);
    assert.equal((await call('Moreno', '', photos(2))).status, 409, 'one Real a day');

    // Cahya has not posted: she learns that Moreno posted, but not what.
    let seen = (await call('Cahya')).body;
    assert.deepEqual(seen.theirs, { locked: true, user: 'Moreno', posted: moment + 60000, late: 60000 });
    const id = posted.body.mine.id;
    const blocked = await call('Cahya', `/${id}/main`);
    assert.equal(blocked.status, 403);
    assert.match(blocked.cache, /no-store/, 'a refusal is never cached');
    assert.equal((await call('Cahya', `/${id}/react`, { emoji: '😍' })).status, 403);

    now = moment + 3 * HOUR;
    const late = await call('Cahya', '', photos(3));
    assert.equal(late.status, 201, late.body.error);
    assert.equal(late.body.mine.late, 3 * HOUR);
    assert.equal(late.body.theirs.id, id, 'posting unlocks the partner photo at once');
    seen = (await call('Cahya')).body;
    assert.equal(seen.theirs.id, id);
    const photo = await call('Cahya', `/${id}/main`);
    assert.equal(photo.status, 200);
    assert.equal(photo.type, 'image/jpeg');
    assert.deepEqual(photo.body, Buffer.from(photos(1).main.split(',')[1], 'base64'));
    assert.match(photo.cache, /immutable/);
    assert.equal((await call('Cahya', `/${id}/secret`)).status, 404);

    assert.equal((await call('Moreno', `/${id}/react`, { emoji: '😍' })).status, 400, 'no reacting to your own Real');
    assert.equal((await call('Cahya', `/${id}/react`, { emoji: '<b>' })).status, 400);
    assert.deepEqual((await call('Cahya', `/${id}/react`, { emoji: '😍' })).body.reactions, { Cahya: '😍' });
    assert.deepEqual((await call('Moreno')).body.mine.reactions, { Cahya: '😍' });
    assert.deepEqual((await call('Cahya', `/${id}/react`, { emoji: '' })).body.reactions, {}, 'an empty reaction removes it');

    // Next evening: yesterday is a memory, the streak counts it, and nobody has posted today yet.
    now = moment + DAY + 5 * HOUR;
    const next = (await call('Moreno')).body;
    assert.equal(next.day, '2026-11-02');
    assert.equal(next.mine, null);
    assert.equal(next.streak, 1);
    assert.deepEqual(next.memories.map(memory => [memory.day, memory.Moreno?.id, !!memory.Cahya]), [['2026-11-01', id, true]]);
    assert.equal((await call('Moreno', `/${late.body.mine.id}/main`)).status, 200, 'earlier days stay visible');

    // Two months on, the first day keeps only its previews.
    now = moment + 61 * DAY;
    assert.equal((await call('Moreno', '', photos(4))).status, 201);
    assert.equal((await call('Cahya', `/${id}/main`)).status, 404);
    assert.equal((await call('Cahya', `/${id}/thumb`)).status, 200);
  } finally {
    server.close();
    db.close();
  }
});
