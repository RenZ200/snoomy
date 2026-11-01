import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, newMatch, play, draw, pass, view, playable, face, DARK, FLAVORS } from '../game.js';

const card = (id, f, v) => ({ id, f, v });
const pile = (n = 30, f = 'vanila') => Array.from({ length: n }, (_, i) => card(`p${i}`, f, String(i % 9 + 1)));
const table = (mode, hands, top, extra = {}) => ({ mode, side: 'light', status: 'playing', round: 1, draw: pile(), discard: [top], hands, flavor: top.f ?? top.light?.f, turn: 'Moreno', drawn: null, penalty: 0, penaltyType: null, winner: null, wins: { Moreno: 0, Cahya: 0 }, log: [], ...extra });
const first = () => 0;

test('decks for every mode', () => {
  const klasik = buildDeck('klasik');
  assert.equal(klasik.length, 108);
  assert.equal(klasik.filter(c => c.v === '0').length, 4);
  assert.equal(klasik.filter(c => c.v === 'reverse').length, 8);
  const ganas = buildDeck('ganas');
  assert.equal(ganas.length, 168);
  assert.equal(ganas.filter(c => c.v === 'plus10').length, 4);
  const balik = buildDeck('balik');
  assert.equal(balik.length, 112);
  assert.ok(balik.every(c => FLAVORS.includes(c.light.f) || c.light.f === null));
  assert.ok(balik.every(c => DARK.includes(c.dark.f) || c.dark.f === null));
  assert.equal(balik.filter(c => c.dark.v === 'flip').length, 8);
  assert.equal(new Set(balik.map(c => c.id)).size, 112);
  for (const mode of ['klasik', 'balik', 'ganas']) {
    const s = newMatch(null, undefined, mode);
    assert.equal(s.mode, mode);
    assert.match(face(s, s.discard[0]).v, /^\d$/);
  }
  assert.equal(newMatch(newMatch(null, undefined, 'ganas')).mode, 'ganas', 'the next round keeps the mode');
});

test('klasik: draw cards are drawn at once, no stacking, reverse acts as skip, one card at a time', () => {
  let s = table('klasik', { Moreno: [card('p', 'matcha', 'plus2'), card('a', 'matcha', '3'), card('b', 'taro', '3')], Cahya: [card('x', 'stroberi', 'plus2'), card('y', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'p' });
  assert.equal(s.hands.Cahya.length, 4, 'Cahya draws two at once');
  assert.equal(s.penalty, 0);
  assert.equal(s.turn, 'Moreno', 'and misses her turn');
  assert.throws(() => play(s, 'Moreno', { cards: ['a', 'b'] }), /satu per satu/);
  s = table('klasik', { Moreno: [card('r', 'matcha', 'reverse'), card('a', 'taro', '3'), card('b', 'taro', '4')], Cahya: [card('y', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'r' });
  assert.equal(s.turn, 'Moreno');
  s = table('klasik', { Moreno: [card('w', null, 'plus4'), card('a', 'taro', '3'), card('b', 'taro', '4')], Cahya: [card('y', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'w', flavor: 'taro' });
  assert.deepEqual([s.hands.Cahya.length, s.turn, s.flavor], [5, 'Moreno', 'taro']);
});

test('bolak-balik: flipping turns every card, harsher dark cards, and the partner sees your other side', () => {
  const two = (id, light, dark) => ({ id, light: { f: light[0], v: light[1] }, dark: { f: dark[0], v: dark[1] } });
  const hands = { Moreno: [two('f', ['matcha', 'flip'], ['kopi', '5']), two('a', ['taro', '2'], ['laut', 'plus5']), two('b', ['taro', '3'], ['laut', '9'])],
    Cahya: [two('x', ['vanila', '1'], ['jeruk', '7']), two('y', ['vanila', '4'], [null, 'wildcolor'])] };
  const draws = Array.from({ length: 20 }, (_, i) => two(`d${i}`, ['vanila', '8'], [i === 15 ? 'anggur' : 'jeruk', '3']));
  const s = table('balik', hands, two('t', ['matcha', '5'], ['laut', '6']), { draw: draws });
  assert.deepEqual(view(s, 1, 'Cahya').opponentBacks.map(c => c.f), ['kopi', 'laut', 'laut'], "Cahya sees the dark side of Moreno's cards");
  play(s, 'Moreno', { card: 'f' });
  assert.equal(s.side, 'dark');
  assert.deepEqual(face(s, s.discard.at(-1)), { f: 'kopi', v: '5' }, 'the top card turns over');
  assert.equal(s.flavor, 'kopi');
  assert.deepEqual(view(s, 2, 'Moreno').hand.map(c => c.f), ['laut', 'laut']);
  assert.equal(s.turn, 'Cahya');
  play(s, 'Cahya', { card: 'y', flavor: 'anggur' });
  // Ambil Sampai Warna: Moreno draws until an anggur card appears (the draw pile is taken from the end).
  assert.equal(s.hands.Moreno.length, 2 + 5);
  assert.equal(face(s, s.hands.Moreno.at(-1)).f, 'anggur');
  assert.equal(s.turn, 'Cahya');
  assert.throws(() => play(s, 'Cahya', { card: 'x', flavor: 'matcha' }), /belum cocok/);
});

test('tanpa ampun: stacking upward, drawing until a card fits, 7 swaps hands, buang semua and the mercy rule', () => {
  const draws = () => ({ draw: [...pile(40, 'vanila'), card('fit', 'matcha', '9'), card('n1', 'taro', '1'), card('n2', 'taro', '2')] });
  let s = table('ganas', { Moreno: [card('m2', 'matcha', 'plus2'), card('m6', null, 'plus6'), card('m7', 'taro', '7')], Cahya: [card('c4', 'stroberi', 'cplus4'), card('c2', 'taro', 'plus2'), card('c9', 'taro', '9')] }, card('t', 'matcha', '5'), draws());
  play(s, 'Moreno', { card: 'm2' });
  assert.deepEqual(view(s, 1, 'Cahya').playable.sort(), ['c2', 'c4']);
  play(s, 'Cahya', { card: 'c4' });
  assert.equal(s.penalty, 6);
  assert.throws(() => play(s, 'Moreno', { card: 'm7' }), /minimal \+4/);
  play(s, 'Moreno', { card: 'm6', flavor: 'taro', call: true });
  assert.equal(s.penalty, 12);
  assert.throws(() => play(s, 'Cahya', { card: 'c2' }), /minimal \+6/);
  draw(s, 'Cahya');
  assert.deepEqual([s.hands.Cahya.length, s.penalty, s.turn], [14, 0, 'Moreno']);

  s = table('ganas', { Moreno: [card('a', 'taro', '3'), card('b', 'taro', '4')], Cahya: [card('y', 'vanila', '1')] }, card('t', 'matcha', '5'), draws());
  draw(s, 'Moreno');
  assert.equal(s.hands.Moreno.length, 2 + 3, 'draws until the first matcha (or 5) card');
  assert.equal(s.drawn, 'fit');

  s = table('ganas', { Moreno: [card('s', 'matcha', '7'), card('a', 'taro', '3'), card('b', 'taro', '4')], Cahya: [card('y', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 's', call: true });
  assert.deepEqual([s.hands.Moreno.map(c => c.id), s.hands.Cahya.map(c => c.id)], [['y'], ['a', 'b']]);

  s = table('ganas', { Moreno: [card('d', 'matcha', 'discard'), card('a', 'matcha', '3'), card('b', 'matcha', '8'), card('c', 'taro', '4'), card('e', 'taro', '6')], Cahya: [card('y', 'vanila', '1')] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'd' });
  assert.deepEqual(s.hands.Moreno.map(c => c.id), ['c', 'e'], 'every matcha card goes');
  assert.equal(s.discard.at(-1).id, 'd');

  s = table('ganas', { Moreno: [card('p', null, 'plus10'), card('a', 'taro', '3'), card('b', 'taro', '4')], Cahya: [...pile(16, 'stroberi').map(c => ({ ...c, id: `h${c.id}` }))] }, card('t', 'matcha', '5'));
  play(s, 'Moreno', { card: 'p', flavor: 'taro' });
  draw(s, 'Cahya');
  assert.deepEqual([s.status, s.winner], ['finished', 'Moreno'], '25 cards in hand loses the round');
  assert.equal(s.wins.Moreno, 1);
});

test('every mode plays out to a winner without losing a card', () => {
  for (const mode of ['klasik', 'balik', 'ganas']) {
    const size = buildDeck(mode).length;
    for (let round = 0; round < 25; round++) {
      const s = newMatch(null, undefined, mode);
      for (let moves = 0; s.status === 'playing'; moves++) {
        assert.ok(moves < 3000, `${mode} match should finish`);
        const user = s.turn, hand = s.hands[user];
        const choice = hand.find(c => (!s.drawn || c.id === s.drawn) && playable(s, c));
        const colours = s.side === 'dark' ? DARK : FLAVORS;
        if (choice) play(s, user, { card: choice.id, flavor: colours[moves % 4], call: hand.length === 2 });
        else if (s.drawn) pass(s, user);
        else draw(s, user);
        assert.equal(s.draw.length + s.discard.length + s.hands.Moreno.length + s.hands.Cahya.length, size, `${mode}: no card is lost`);
      }
      assert.ok(['Moreno', 'Cahya'].includes(s.winner));
      assert.equal(view(s, 1, 'Moreno').mode, mode);
    }
  }
});
