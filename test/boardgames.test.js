import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ludo from '../games/ludo.js';
import * as four from '../games/four.js';
import * as snakes from '../games/snakes.js';
import * as sketch from '../games/sketch.js';
import * as quiz from '../games/quiz.js';
import * as talk from '../games/talk.js';
import { WORDS } from '../games/sketch-words.js';
import { KNOW, PAIRS, WHO } from '../games/quiz-questions.js';

// Dice that roll the given numbers in order (rand(6) + 1 === value).
const dice = (...values) => () => values.shift() - 1;
const first = () => 0;
const { CARDS } = talk;

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

const players = ['Moreno', 'Cahya'];

test('sketch: the word stays hidden until the round ends', () => {
  let s = sketch.newMatch(null, first);
  assert.equal(s.drawer, 'Moreno');
  assert.equal(sketch.view(s, 1, 'Moreno').choices.length, 3);
  assert.deepEqual(sketch.view(s, 1, 'Cahya').choices, []);
  assert.throws(() => sketch.act(s, 'Cahya', { action: 'pick', index: 0 }), /yang milih/);
  s = sketch.act(s, 'Moreno', { action: 'pick', index: 1 });
  const word = s.word;
  assert.equal(sketch.view(s, 2, 'Cahya').word, null);
  assert.equal(JSON.stringify(sketch.view(s, 2, 'Cahya')).includes(`"${word}"`), false);
  assert.equal(sketch.view(s, 2, 'Moreno').word, word);
  assert.equal(sketch.view(s, 2, 'Cahya').hint.replace(/ /g, '').length, word.replace(/ /g, '').length);
  s = sketch.act(s, 'Moreno', { action: 'ink', from: 0, add: [{ c: 1, s: 1, p: [10, 20, 30, 9999] }] });
  assert.deepEqual(s.strokes[0].p, [10, 20, 30, sketch.HEIGHT], 'points stay on the canvas');
  s = sketch.act(s, 'Moreno', { action: 'ink', from: 0, add: [{ c: 1, s: 1, p: [1, 2, 3, 4] }, { c: 0, s: 0, p: [5, 6] }] });
  assert.equal(s.strokes.length, 2, 'a resend replaces, it never doubles');
  s = sketch.act(s, 'Moreno', { action: 'ink', from: 1, add: [] });
  assert.equal(s.strokes.length, 1, 'undo');
  assert.throws(() => sketch.act(s, 'Moreno', { action: 'ink', from: 0, add: [{ c: 99, s: 0, p: [1, 2] }] }), /tidak valid/);
  assert.throws(() => sketch.act(s, 'Cahya', { action: 'ink', from: 0, add: [] }), /yang gambar/);
  assert.throws(() => sketch.act(s, 'Moreno', { action: 'guess', text: word }), /nggak boleh/);
  s = sketch.act(s, 'Cahya', { action: 'guess', text: 'bukan ini pastinya' });
  assert.equal(s.status, 'playing');
  s = sketch.act(s, 'Cahya', { action: 'guess', text: ` ${word.toUpperCase()} ` });
  assert.equal(s.status, 'finished');
  assert.equal(s.winner, 'Cahya');
  assert.equal(s.wins.Cahya, 1);
  assert.equal(sketch.view(s, 9, 'Cahya').word, word);
  const next = sketch.newMatch(s, first);
  assert.equal(next.drawer, 'Cahya', 'roles swap');
  assert.deepEqual(next.wins, s.wins);
});

test('sketch: a typo still counts and giving up scores nothing', () => {
  assert.equal(sketch.distance('bakso', 'baksi'), 1);
  let s = sketch.act(sketch.newMatch(null, first), 'Moreno', { action: 'pick', index: 0 });
  s.word = 'martabak';
  assert.equal(sketch.act(structuredClone(s), 'Cahya', { action: 'guess', text: 'martabk' }).winner, 'Cahya');
  s = sketch.act(s, 'Cahya', { action: 'giveup' });
  assert.equal(s.status, 'finished');
  assert.equal(s.winner, null);
  assert.deepEqual(s.wins, { Moreno: 0, Cahya: 0 });
});

test('sketch: every word is unique', () => {
  assert.equal(new Set(WORDS).size, WORDS.length);
});

test('quiz: answers stay secret until both are in', () => {
  let s = quiz.newMatch(null, first);
  assert.equal(s.questions.length, 8);
  assert.equal(s.questions[0].kind, 'know');
  const about = s.questions[0].about, guesser = players.find(p => p !== about);
  s = quiz.act(s, guesser, { action: 'answer', text: 'nasi goreng' });
  assert.equal(quiz.view(s, 1, about).answers, null);
  assert.equal(quiz.view(s, 1, about).yours, null);
  assert.equal(JSON.stringify(quiz.view(s, 1, about)).includes('nasi goreng'), false);
  assert.equal(quiz.view(s, 1, guesser).yours, 'nasi goreng');
  assert.equal(quiz.view(s, 1, about).turn, about);
  assert.throws(() => quiz.act(s, guesser, { action: 'answer', text: 'lagi' }), /sudah jawab/);
  s = quiz.act(s, about, { action: 'answer', text: 'bakso' });
  assert.equal(s.stage, 'reveal');
  assert.deepEqual(quiz.view(s, 2, guesser).answers, { [guesser]: 'nasi goreng', [about]: 'bakso' });
  assert.throws(() => quiz.act(s, guesser, { action: 'mark', right: true }), /yang nilai/);
  s = quiz.act(s, about, { action: 'mark', right: true });
  assert.equal(s.scores[guesser], 1);
  assert.equal(s.index, 1);
  assert.equal(s.stage, 'answer');
});

test('quiz: self-scoring questions and a full match', () => {
  let s = quiz.newMatch(null, first);
  while (s.status === 'playing') {
    const q = s.questions[s.index], guesser = players.find(p => p !== q.about);
    const options = q.kind === 'who' ? players : q.kind === 'pair' ? q.options : ['a', 'b'];
    s = quiz.act(s, q.about, { action: 'answer', text: options[0] });
    s = quiz.act(s, guesser, { action: 'answer', text: q.kind === 'who' ? options[0] : options[1] });
    s = q.kind === 'know' ? quiz.act(s, q.about, { action: 'mark', right: true }) : quiz.act(s, guesser, { action: 'next' });
  }
  assert.equal(s.past.length, 8);
  assert.equal(s.past.some(entry => entry.text.includes('{')), false, 'recaps have no placeholders left');
  assert.equal(quiz.view(s, 9, 'Moreno').past.length, 8);
  assert.deepEqual(s.turn, []);
  assert.deepEqual(s.scores, { Moreno: 4, Cahya: 4 }, 'each answered two know questions right and both agreed on two who questions');
  assert.equal(s.winner, null);
});

test('quiz: "aku" points at the right person for each reader', () => {
  const s = quiz.newMatch(null, first);
  s.questions[0] = { kind: 'know', text: 'Hal yang paling {nama} suka dari {aku} apa?', about: 'Cahya' };
  assert.equal(quiz.view(s, 1, 'Cahya').question.text, 'Hal yang paling kamu suka dari Moreno apa?');
  assert.equal(quiz.view(s, 1, 'Moreno').question.text, 'Hal yang paling Cahya suka dari kamu apa?');
});

test('quiz: own questions come first, stay private and survive a restart', () => {
  let s = quiz.newMatch(null, first);
  s = quiz.act(s, 'Moreno', { action: 'ask', text: 'Aku paling takut apa?' });
  assert.equal(quiz.view(s, 1, 'Moreno').mine.length, 1);
  assert.equal(quiz.view(s, 1, 'Cahya').theirs, 1);
  assert.equal(JSON.stringify(quiz.view(s, 1, 'Cahya')).includes('paling takut'), false);
  const next = quiz.newMatch(s, first);
  const mine = next.questions.filter(q => q.custom);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].about, 'Moreno');
  assert.equal(next.custom.length, 0);
  assert.equal(quiz.newMatch(next, first).questions.filter(q => q.custom).length, 1, 'a restart puts it back');
});

test('quiz: every question appears once before repeats, and there are plenty', () => {
  assert.ok(KNOW.length >= 200 && PAIRS.length >= 100 && WHO.length >= 100);
  assert.equal(new Set(KNOW).size, KNOW.length);
  assert.equal(new Set(WHO).size, WHO.length);
  assert.equal(new Set(PAIRS.map(pair => pair.join())).size, PAIRS.length);
  let s = quiz.newMatch(null, first);
  const seen = new Set(s.questions.filter(q => q.kind === 'who').map(q => q.text));
  for (let i = 1; i < Math.floor(WHO.length / 2); i++) {
    s = quiz.newMatch(s, first);
    for (const q of s.questions.filter(item => item.kind === 'who')) { assert.equal(seen.has(q.text), false); seen.add(q.text); }
  }
});

test('talk: a shared card, decks, saved cards and no repeats', () => {
  assert.ok(CARDS.length >= 350);
  assert.equal(new Set(CARDS.map(card => card.text)).size, CARDS.length);
  let s = talk.newMatch(null, first);
  const seen = new Set([s.card]);
  for (const name of players) assert.equal(talk.view(s, 1, name).card.id, s.card);
  assert.equal(talk.view(s, 1, 'Moreno').turn, null);
  for (let i = 1; i < CARDS.length; i++) { s = talk.act(s, 'Moreno', { action: 'next' }, first); assert.equal(seen.has(s.card), false); seen.add(s.card); }
  const before = s.card;
  s = talk.act(s, 'Cahya', { action: 'next' }, first);
  assert.notEqual(s.card, before, 'an empty pile reshuffles without repeating the current card');
  s = talk.act(s, 'Cahya', { action: 'next', deck: 'tantangan' }, first);
  assert.equal(CARDS[s.card].deck, 'tantangan');
  assert.equal(s.by, 'Cahya');
  assert.throws(() => talk.act(s, 'Cahya', { action: 'next', deck: 'tidakada' }, first), /Dek/);
  s = talk.act(s, 'Moreno', { action: 'save' }, first);
  assert.equal(talk.view(s, 2, 'Cahya').saved.length, 1);
  assert.equal(talk.view(s, 2, 'Cahya').isSaved, true);
  assert.equal(talk.newMatch(s, first).saved.length, 1, 'saved cards outlive a reshuffle');
  s = talk.act(s, 'Moreno', { action: 'save', id: s.card }, first);
  assert.equal(s.saved.length, 0);
});
