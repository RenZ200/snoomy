import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ludo from '../games/ludo.js';
import * as four from '../games/four.js';
import * as snakes from '../games/snakes.js';

// Dice that roll the given numbers in order (rand(6) + 1 === value).
const dice = (...values) => () => values.shift() - 1;
const first = () => 0;

test('ludo: leaving the yard, extra rolls and three sixes', () => {
  let s = ludo.newMatch(null, first);
  assert.equal(s.turn, 'Moreno');
  assert.deepEqual(s.tokens.Moreno, [-1, -1, -1, -1]);
  assert.throws(() => ludo.roll(s, 'Cahya', dice(6)), /giliran Moreno/);
  ludo.roll(s, 'Moreno', dice(3));
  assert.equal(s.turn, 'Cahya', 'without a 6 nothing leaves the yard and the turn passes');
  ludo.roll(s, 'Cahya', dice(6));
  assert.deepEqual(s.tokens.Cahya, [0, -1, -1, -1], 'all tokens in the yard: the move happens at once');
  assert.equal(s.turn, 'Cahya', 'a 6 earns another roll');
  ludo.roll(s, 'Cahya', dice(6));
  assert.equal(s.phase, 'move', 'two different choices wait for the player');
  assert.deepEqual(s.movable, [0, 1, 2, 3]);
  assert.throws(() => ludo.roll(s, 'Cahya', dice(2)), /Pilih dulu/);
  ludo.move(s, 'Cahya', 0);
  assert.deepEqual(s.tokens.Cahya, [6, -1, -1, -1]);
  ludo.roll(s, 'Cahya', dice(6));
  assert.equal(s.turn, 'Moreno', 'the third 6 in a row forfeits the turn');
  assert.deepEqual(s.tokens.Cahya, [6, -1, -1, -1]);
  assert.equal(s.sixes, 0);
});

test('ludo: captures, safe squares and the exact roll home', () => {
  const game = tokens => ({ ...ludo.newMatch(null, first), tokens });
  // Moreno's square 5 is loop index 6; Cahya reaches it at progress 31.
  let s = game({ Moreno: [5, -1, -1, -1], Cahya: [27, -1, -1, -1] });
  s.turn = 'Cahya';
  ludo.roll(s, 'Cahya', dice(4));
  assert.equal(ludo.square('Cahya', 31), ludo.square('Moreno', 5));
  assert.deepEqual(s.tokens.Moreno, [-1, -1, -1, -1], 'the token is sent back to the yard');
  assert.deepEqual(s.last.captured, [{ token: 0, from: 5 }]);
  assert.equal(s.turn, 'Cahya', 'capturing earns another roll');

  // Moreno at progress 8 stands on loop index 9, a star square.
  s = game({ Moreno: [8, -1, -1, -1], Cahya: [30, -1, -1, -1] });
  s.turn = 'Cahya';
  assert.ok(ludo.SAFE.includes(ludo.square('Moreno', 8)));
  ludo.roll(s, 'Cahya', dice(4));
  assert.deepEqual(s.tokens.Moreno, [8, -1, -1, -1], 'nobody is captured on a safe square');
  assert.equal(s.tokens.Cahya[0], 34);

  s = game({ Moreno: [53, 56, 56, 56], Cahya: [-1, -1, -1, -1] });
  ludo.roll(s, 'Moreno', dice(5));
  assert.deepEqual(s.tokens.Moreno, [53, 56, 56, 56], 'overshooting home is not allowed');
  assert.equal(s.turn, 'Cahya');
  s.turn = 'Moreno';
  ludo.roll(s, 'Moreno', dice(3));
  assert.equal(s.status, 'finished');
  assert.equal(s.winner, 'Moreno');
  assert.equal(s.wins.Moreno, 1);
  const next = ludo.newMatch(s, first);
  assert.equal(next.turn, 'Cahya', 'the loser starts the next round');
  assert.equal(next.round, 2);
  assert.deepEqual(next.wins, { Moreno: 1, Cahya: 0 });
});

test('ludo: view hides choices from the waiting player', () => {
  const s = ludo.newMatch(null, first);
  ludo.roll(s, 'Moreno', dice(6));
  ludo.roll(s, 'Moreno', dice(6));
  assert.deepEqual(ludo.view(s, 3, 'Moreno').movable, [0, 1, 2, 3]);
  assert.deepEqual(ludo.view(s, 3, 'Cahya').movable, []);
  assert.equal(ludo.view(s, 3, 'Cahya').canRoll, false);
  assert.equal(ludo.view(null, 0, 'Cahya').status, 'none');
  assert.throws(() => ludo.move(s, 'Moreno', 9), /tidak bisa jalan/);
  assert.throws(() => ludo.act(s, 'Moreno', { action: 'cheat' }), /Aksi/);
});

test('empat sejajar: drops, full columns and four in every direction', () => {
  let s = four.newMatch(null, first);
  assert.equal(s.turn, 'Moreno');
  four.drop(s, 'Moreno', 3);
  assert.equal(s.board[5][3], 'Moreno', 'discs fall to the bottom');
  assert.throws(() => four.drop(s, 'Moreno', 2), /giliran Cahya/);
  assert.throws(() => four.drop(s, 'Cahya', 7), /Kolom tidak valid/);
  for (let i = 0; i < 5; i++) four.drop(s, s.turn, 3);
  assert.throws(() => four.drop(s, s.turn, 3), /penuh/);

  const play = moves => { const g = four.newMatch(null, first); for (const col of moves) four.drop(g, g.turn, col); return g; };
  s = play([0, 0, 1, 1, 2, 2, 3]);
  assert.equal(s.winner, 'Moreno');
  assert.equal(s.line.length, 4);
  s = play([0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual([s.winner, s.status], ['Moreno', 'finished'], 'vertical');
  s = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
  assert.equal(s.winner, 'Moreno', 'diagonal up');
  s = play([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]);
  assert.equal(s.winner, 'Moreno', 'diagonal down');
  assert.throws(() => four.drop(s, 'Cahya', 1), /selesai/);
  assert.equal(four.newMatch(s, first).turn, 'Cahya', 'the loser starts the next round');

  // A full board without four in a row is a draw.
  const g = play([2, 4, 4, 2, 1, 6, 2, 3, 5, 6, 1, 1, 6, 5, 1, 3, 4, 2, 3, 5, 4, 4, 5, 1, 0, 0, 6, 3, 3, 0, 4, 5, 5, 3, 0, 0, 0, 1, 2, 2, 6, 6]);
  assert.equal(g.moves, 42);
  assert.equal(g.status, 'finished');
  assert.equal(g.winner, null, 'draw');
  assert.equal(four.newMatch(g, first).turn, 'Cahya', 'after a draw the other player starts');
});

test('ular tangga: ladders, snakes, bounce, extra rolls and the win', () => {
  const s = snakes.newMatch(null, first);
  snakes.roll(s, 'Moreno', dice(3));
  assert.deepEqual([s.positions.Moreno, s.last.via, s.last.end], [22, 'ladder', 22], 'ladder from 3 to 22');
  assert.equal(s.turn, 'Cahya');
  s.positions.Cahya = 14;
  snakes.roll(s, 'Cahya', dice(3));
  assert.deepEqual([s.positions.Cahya, s.last.via], [4, 'snake'], 'snake from 17 to 4');
  snakes.roll(s, 'Moreno', dice(6));
  assert.equal(s.positions.Moreno, 28 + 27, '22 + 6 = 28 climbs to 55');
  assert.equal(s.turn, 'Moreno', 'a 6 earns another roll');
  s.positions.Moreno = 98;
  snakes.roll(s, 'Moreno', dice(4));
  assert.deepEqual([s.last.to, s.last.bounced, s.positions.Moreno], [98, true, 98], '98 + 4 bounces back from 100 to 98');
  s.positions.Cahya = 96;
  snakes.roll(s, 'Cahya', dice(4));
  assert.deepEqual([s.status, s.winner, s.wins.Cahya], ['finished', 'Cahya', 1]);
  assert.throws(() => snakes.roll(s, 'Moreno', dice(1)), /selesai/);
  assert.equal(snakes.newMatch(s, first).turn, 'Moreno');
  for (const [from, to] of Object.entries(snakes.LADDERS)) assert.ok(Number(to) > Number(from) && !snakes.SNAKES[to]);
  for (const [from, to] of Object.entries(snakes.SNAKES)) assert.ok(Number(to) < Number(from) && !snakes.LADDERS[to]);
});
