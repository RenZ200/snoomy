import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseYouTube, parseStart, watchAction } from '../party.js';

test('YouTube links are recognised in their common shapes', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [id, `https://www.youtube.com/watch?v=${id}`, `youtube.com/watch?v=${id}&list=PL1`, `https://youtu.be/${id}`, `https://m.youtube.com/watch?v=${id}`,
    `https://music.youtube.com/watch?v=${id}`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube-nocookie.com/embed/${id}`, `https://www.youtube.com/live/${id}?si=x`]) {
    assert.equal(parseYouTube(link)?.id, id, link);
  }
  assert.equal(parseYouTube(`https://youtu.be/${id}?t=90`).start, 90);
  assert.equal(parseYouTube(`https://www.youtube.com/watch?v=${id}&t=1m30s`).start, 90);
  assert.equal(parseStart('1h2m3s'), 3723);
  for (const bad of ['', 'hello', 'https://vimeo.com/12345', `https://evil.example/watch?v=${id}`, 'https://youtu.be/short', 'javascript:alert(1)']) assert.equal(parseYouTube(bad), null, bad);
});

test('watch state follows load, play, pause, seek, reactions and clear', () => {
  const id = 'dQw4w9WgXcQ';
  assert.throws(() => watchAction({}, 'Moreno', { action: 'play', position: 3 }, 1000), /Belum ada video/);
  let s = watchAction({}, 'Moreno', { action: 'load', url: `https://youtu.be/${id}?t=12` }, 1000, 'Lagu kita');
  assert.deepEqual([s.videoId, s.title, s.playing, s.position, s.updatedAt, s.by], [id, 'Lagu kita', true, 12, 1000, 'Moreno']);
  s = watchAction(s, 'Cahya', { action: 'pause', position: 40.5 }, 2000);
  assert.deepEqual([s.playing, s.position, s.by], [false, 40.5, 'Cahya']);
  s = watchAction(s, 'Cahya', { action: 'seek', position: 90 }, 3000);
  assert.deepEqual([s.playing, s.position], [false, 90]);
  s = watchAction(s, 'Moreno', { action: 'play', position: 90 }, 4000);
  assert.equal(s.playing, true);
  assert.throws(() => watchAction(s, 'Moreno', { action: 'seek', position: -1 }, 5000), /Posisi/);
  assert.throws(() => watchAction(s, 'Moreno', { action: 'seek', position: 'abc' }, 5000), /Posisi/);
  assert.throws(() => watchAction(s, 'Moreno', { action: 'dance' }, 5000), /Aksi/);
  assert.throws(() => watchAction(s, 'Moreno', { action: 'react', emoji: '<b>' }, 5000), /Reaksi/);
  s = watchAction(s, 'Cahya', { action: 'react', emoji: '😂' }, 5000);
  s = watchAction(s, 'Moreno', { action: 'react', emoji: '♡' }, 5100);
  assert.deepEqual([s.reaction.emoji, s.reaction.by, s.reaction.id], ['♡', 'Moreno', 2]);
  for (let i = 0; i < 10; i++) s = watchAction(s, 'Moreno', { action: 'load', url: `abcdefghij${i}` }, 6000 + i);
  assert.equal(s.history.length, 8, 'history keeps the last eight videos');
  s = watchAction(s, 'Moreno', { action: 'load', url: 'abcdefghij3' }, 7000);
  assert.equal(s.history[0].videoId, 'abcdefghij3');
  assert.equal(s.history.filter(item => item.videoId === 'abcdefghij3').length, 1, 'replaying moves the video to the top');
  s = watchAction(s, 'Cahya', { action: 'clear' }, 8000);
  assert.equal(s.videoId, null);
  assert.equal(s.history.length, 8);
});

test('watch and music API: shared state, presence and playlist', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'snoomy-party-'));
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'test', VERCEL: '', PORT: '31993', DB_PATH: join(temp, 'party.sqlite'), MORENO_PIN: '', CAHYA_PIN: '', COOKIE_SECURE: 'false', SNOOMY_OFFLINE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Server timeout')), 30000); child.once('exit', code => reject(Error('Server exited ' + code))); child.stdout.on('data', d => { if (String(d).includes('siap')) { clearTimeout(timer); resolve(); } }); });
    const base = 'http://127.0.0.1:31993/api';
    const request = async (path, method = 'GET', body, cookie) => { const res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, body: await res.json() }; };
    const login = async user => (await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) })).headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/watch')).status, 401);
    assert.equal((await request('/music')).status, 401);
    const moreno = await login('Moreno'), cahya = await login('Cahya');

    let watch = (await request('/watch', 'GET', undefined, moreno)).body;
    assert.equal(watch.videoId, null);
    assert.equal(watch.partner.name, 'Cahya');
    assert.equal(watch.partner.online, false);
    await request('/watch', 'GET', undefined, cahya);
    watch = (await request('/watch', 'GET', undefined, moreno)).body;
    assert.equal(watch.partner.online, true, 'opening the page marks you as watching');
    assert.equal((await request('/watch', 'POST', { action: 'load', url: 'https://vimeo.com/1' }, moreno)).status, 400);
    const loaded = await request('/watch', 'POST', { action: 'load', url: 'https://youtu.be/dQw4w9WgXcQ?t=5' }, moreno);
    assert.equal(loaded.status, 200);
    assert.deepEqual([loaded.body.videoId, loaded.body.title, loaded.body.playing, loaded.body.position], ['dQw4w9WgXcQ', 'Video YouTube', true, 5]);
    const paused = await request('/watch', 'POST', { action: 'pause', position: 33 }, cahya);
    assert.ok(paused.body.version > loaded.body.version);
    const seen = (await request('/watch', 'GET', undefined, moreno)).body;
    assert.deepEqual([seen.playing, seen.position, seen.by], [false, 33, 'Cahya']);
    assert.equal(typeof seen.now, 'number');

    assert.deepEqual((await request('/music', 'GET', undefined, moreno)).body.tracks, []);
    assert.equal((await request('/music', 'POST', { url: 'not a link' }, moreno)).status, 400);
    const added = await request('/music', 'POST', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: '  Lagu pertama  ' }, moreno);
    assert.equal(added.status, 201);
    assert.deepEqual(added.body.tracks.map(t => [t.videoId, t.title, t.addedBy]), [['dQw4w9WgXcQ', 'Lagu pertama', 'Moreno']]);
    assert.equal((await request('/music', 'POST', { url: 'https://youtu.be/dQw4w9WgXcQ' }, cahya)).status, 409);
    const second = await request('/music', 'POST', { url: 'https://youtu.be/abcdefghijk' }, cahya);
    assert.equal(second.body.tracks[1].title, 'Lagu YouTube');
    assert.equal((await request('/music', 'GET', undefined, cahya)).body.tracks.length, 2);
    assert.equal((await request('/music/' + added.body.id, 'DELETE', {}, cahya)).status, 200);
    assert.equal((await request('/music/' + added.body.id, 'DELETE', {}, cahya)).status, 404);
    assert.deepEqual((await request('/music', 'GET', undefined, moreno)).body.tracks.map(t => t.videoId), ['abcdefghijk']);
  } finally {
    if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    rmSync(temp, { recursive: true, force: true });
  }
});
