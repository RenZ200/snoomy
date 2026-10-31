import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDeck, newMatch, play, draw, pass, view, playable } from '../game.js';

const card = (id, f, v) => ({ id, f, v });
const table = (hands, top, extra = {}) => ({ status: 'playing', round: 1, draw: [card('d1', 'taro', '3'), card('d2', 'taro', '4'), card('d3', 'vanila', '5')], discard: [top], hands, flavor: top.f, turn: 'Moreno', drawn: null, winner: null, wins: { Moreno: 0, Cahya: 0 }, log: [], ...extra });
const first = () => 0;

test('deck and deal', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 100);
  assert.equal(new Set(deck.map(c => c.id)).size, 100);
  assert.equal(deck.filter(c => c.v === 'wild').length, 4);
  assert.equal(deck.filter(c => c.v === 'plus4').length, 4);
  const match = newMatch(null);
  assert.equal(match.hands.Moreno.length, 7);
  assert.equal(match.hands.Cahya.length, 7);
  assert.match(match.discard[0].v, /^\d$/);
  assert.equal(match.flavor, match.discard[0].f);
  assert.equal(match.draw.length + 14 + 1, 100);
});

test('matching, turns and special cards', () => {
  let s = table({ Moreno: [card('a', 'matcha', '7'), card('b', 'taro', '2'), card('c', 'stroberi', '9')], Cahya: [card('x', 'vanila', '1'), card('y', 'vanila', '2')] }, card('t', 'matcha', '5'));
  assert.throws(() => play(s, 'Cahya', { card: 'x' }), /giliran Moreno/);
  assert.throws(() => play(s, 'Moreno', { card: 'b' }), /belum cocok/);
  play(s, 'Moreno', { card: 'a' });
  assert.equal(s.turn, 'Cahya');
  assert.equal(s.flavor, 'matcha');

  s = table({ Moreno: [card('p', 'matcha', 'plus2'), card('b', 'taro', '2'), card('c', 'taro', '3')], Cahya: [card('x', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'p' }, first);
  assert.equal(s.turn, 'Cahya');
  assert.equal(s.penalty, 2);
  draw(s, 'Cahya', first);
  assert.equal(s.hands.Cahya.length, 3, 'taking a +2 draws two cards');
  assert.equal(s.turn, 'Moreno', 'and loses the turn');
  assert.equal(s.penalty, 0);

  s = table({ Moreno: [card('s', 'matcha', 'skip'), card('b', 'taro', '2'), card('c', 'taro', '3')], Cahya: [card('x', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 's' });
  assert.equal(s.turn, 'Moreno');

  s = table({ Moreno: [card('w', null, 'wild'), card('b', 'taro', '2'), card('c', 'taro', '3')], Cahya: [card('x', 'vanila', '1')] }, card('t', 'matcha', '5'));
  assert.throws(() => play(s, 'Moreno', { card: 'w' }), /Pilih rasa/);
  play(s, 'Moreno', { card: 'w', flavor: 'taro' });
  assert.equal(s.flavor, 'taro');
  assert.equal(s.turn, 'Cahya');

  s = table({ Moreno: [card('sw', 'matcha', 'swap'), card('b', 'taro', '2'), card('c', 'taro', '3')], Cahya: [card('x', 'vanila', '1'), card('y', 'vanila', '2')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'sw' }, first);
  assert.equal(s.hands.Moreno.length, 2);
  assert.equal(s.hands.Cahya.length, 2);
  assert.ok(s.hands.Moreno.some(c => c.id === 'x'));
  assert.ok(s.hands.Cahya.some(c => c.id === 'b'));
});

test('+2 and +4 stack: +2 answers +2 or +4, +4 only answers +4', () => {
  const hands = () => ({ Moreno: [card('m2', 'matcha', 'plus2'), card('m4', null, 'plus4'), card('m7', 'taro', '7'), card('m8', 'taro', '8')], Cahya: [card('c2', 'stroberi', 'plus2'), card('c2b', 'taro', 'plus2'), card('c4', null, 'plus4'), card('c7', 'matcha', '7'), card('c9', 'matcha', '9')] });
  const pile = () => ({ draw: Array.from({ length: 20 }, (_, i) => card(`p${i}`, 'vanila', String(i % 9 + 1))) });
  let s = table(hands(), card('t', 'matcha', '5'), pile());
  play(s, 'Moreno', { card: 'm2' });
  assert.throws(() => play(s, 'Cahya', { card: 'c7' }), /\+2 hanya bisa dibalas/);
  assert.deepEqual(view(s, 1, 'Cahya').playable.sort(), ['c2', 'c2b', 'c4']);
  play(s, 'Cahya', { card: 'c2' });
  assert.equal(s.penalty, 4);
  assert.equal(s.turn, 'Moreno');
  assert.throws(() => play(s, 'Moreno', { card: 'm4' }), /Pilih rasa/);
  play(s, 'Moreno', { card: 'm4', flavor: 'taro' });
  assert.equal(s.penalty, 8);
  assert.equal(s.penaltyType, 'plus4');
  assert.equal(s.flavor, 'taro');
  assert.throws(() => play(s, 'Cahya', { card: 'c2b' }), /\+4 hanya bisa dibalas dengan \+4/);
  play(s, 'Cahya', { card: 'c4', flavor: 'matcha' });
  assert.equal(s.penalty, 12);
  const before = s.hands.Moreno.length;
  draw(s, 'Moreno');
  assert.equal(s.hands.Moreno.length, before + 12, 'the whole stack is drawn');
  assert.equal(s.penalty, 0);
  assert.equal(s.turn, 'Cahya');
  assert.equal(view(s, 2, 'Cahya').playable.includes('c7'), true, 'normal matching resumes after the stack is taken');

  s = table(hands(), card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'm4', flavor: 'stroberi' });
  assert.equal(s.turn, 'Cahya');
  assert.deepEqual(view(s, 1, 'Cahya').playable, ['c4']);
});

test('calling the last card, winning and the next starter', () => {
  let s = table({ Moreno: [card('a', 'matcha', '7'), card('b', 'taro', '2')], Cahya: [card('x', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'a' }, first);
  assert.equal(s.hands.Moreno.length, 3, 'forgetting to call costs two cards');
  s = table({ Moreno: [card('a', 'matcha', '7'), card('b', 'taro', '7')], Cahya: [card('x', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'a', call: true });
  assert.equal(s.hands.Moreno.length, 1);
  s.turn = 'Moreno';
  play(s, 'Moreno', { card: 'b' });
  assert.equal(s.status, 'finished');
  assert.equal(s.winner, 'Moreno');
  assert.deepEqual(s.wins, { Moreno: 1, Cahya: 0 });
  assert.throws(() => draw(s, 'Cahya'), /selesai/);
  const next = newMatch(s);
  assert.equal(next.turn, 'Cahya');
  assert.equal(next.round, 2);
  assert.deepEqual(next.wins, { Moreno: 1, Cahya: 0 });
});

test('drawing, keeping the drawn card and reshuffling', () => {
  let s = table({ Moreno: [card('b', 'taro', '2')], Cahya: [card('x', 'vanila', '1')] }, card('t', 'vanila', '5'));
  draw(s, 'Moreno');
  assert.equal(s.drawn, 'd3');
  assert.throws(() => play(s, 'Moreno', { card: 'b' }), /baru diambil/);
  assert.deepEqual(view(s, 3, 'Moreno').playable, ['d3']);
  pass(s, 'Moreno');
  assert.equal(s.turn, 'Cahya');
  s = table({ Moreno: [card('b', 'taro', '2')], Cahya: [card('x', 'vanila', '1')] }, card('t', 'matcha', '5'), { draw: [], discard: [card('o1', 'taro', '8'), card('o2', 'taro', '9'), card('t', 'matcha', '5')] });
  draw(s, 'Moreno', first);
  assert.equal(s.hands.Moreno.length, 2);
  assert.equal(s.discard.length, 1);
  assert.equal(s.discard[0].id, 't');
  assert.equal(s.turn, 'Cahya');
});

test('a full random match always ends with a winner', () => {
  for (let round = 0; round < 40; round++) {
    const s = newMatch(null);
    for (let moves = 0; s.status === 'playing'; moves++) {
      assert.ok(moves < 2000, 'match should finish');
      const user = s.turn, hand = s.hands[user];
      const choice = hand.find(c => (!s.drawn || c.id === s.drawn) && playable(s, c));
      if (choice) play(s, user, { card: choice.id, flavor: 'matcha', call: hand.length === 2 });
      else if (s.drawn) pass(s, user);
      else draw(s, user);
      const total = s.draw.length + s.discard.length + s.hands.Moreno.length + s.hands.Cahya.length;
      assert.equal(total, 100, 'no card is lost or duplicated');
    }
    assert.ok(['Moreno', 'Cahya'].includes(s.winner));
  }
});

test('game API keeps hands private and rejects stale moves', async () => {
  const temp = mkdtempSync(join(tmpdir(), 'snoomy-game-'));
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'test', VERCEL: '', PORT: '31991', DB_PATH: join(temp, 'game.sqlite'), MORENO_PIN: '', CAHYA_PIN: '', COOKIE_SECURE: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Server timeout')), 30000); child.once('exit', code => reject(Error('Server exited ' + code))); child.stdout.on('data', d => { if (String(d).includes('siap')) { clearTimeout(timer); resolve(); } }); });
    const base = 'http://127.0.0.1:31991/api';
    const request = async (path, method = 'GET', body, cookie) => { const res = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] }; };
    const login = async user => (await request('/login', 'POST', { user })).cookie;
    assert.equal((await request('/game')).status, 401);
    const moreno = await login('Moreno'), cahya = await login('Cahya');
    assert.equal((await request('/game', 'GET', undefined, moreno)).body.status, 'none');
    const started = await request('/game/new', 'POST', {}, moreno);
    assert.equal(started.status, 200);
    assert.equal(started.body.hand.length, 7);
    assert.equal(started.body.opponentCount, 7);
    assert.equal(started.body.drawCount, 85);
    assert.equal((await request('/game/new', 'POST', {}, cahya)).status, 409);
    const seen = (await request('/game', 'GET', undefined, cahya)).body;
    assert.equal(seen.hand.length, 7);
    assert.ok(!seen.hand.some(c => started.body.hand.some(m => m.id === c.id)), 'each player only sees their own hand');
    assert.equal(seen.hands, undefined);
    assert.equal(seen.draw, undefined);
    const mover = seen.turn === 'Cahya' ? cahya : moreno;
    const waiter = mover === cahya ? moreno : cahya;
    assert.equal((await request('/game/draw', 'POST', { version: seen.version }, waiter)).status, 409);
    assert.equal((await request('/game/draw', 'POST', { version: seen.version - 1 }, mover)).status, 409);
    const drew = await request('/game/draw', 'POST', { version: seen.version }, mover);
    assert.equal(drew.status, 200);
    assert.equal(drew.body.hand.length, 8);
    const restarted = await request('/game/new', 'POST', { restart: true }, waiter);
    assert.equal(restarted.status, 200);
    assert.equal(restarted.body.round, 2);
  } finally {
    if (child.exitCode === null) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    rmSync(temp, { recursive: true, force: true });
  }
});
