// Kartu Ngobrol: one shared table, no winner. Either of you opens the next card and both see it. Every card in the
// chosen deck comes up once before the pile is shuffled again, and cards you want to keep stay in Disimpan.
import { DECKS } from './talk-cards.js';

export const PLAYERS = ['Moreno', 'Cahya'];
export const CARDS = Object.entries(DECKS).flatMap(([deck, { label, cards }]) => cards.map(text => ({ deck, label, text })));
const MAX_SAVED = 200;
const other = user => PLAYERS.find(p => p !== user);
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const say = (state, who, text) => { state.log = [...state.log, { who, text }].slice(-8); };
const shuffled = (length, rand) => {
  const list = Array.from({ length }, (_, index) => index);
  for (let i = list.length - 1; i > 0; i--) { const j = rand(i + 1); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};
const inDeck = (id, deck) => deck === 'semua' || CARDS[id]?.deck === deck;

function draw(state, deck, rand) {
  let at = state.pile.findLastIndex(id => inDeck(id, deck));
  if (at < 0) {
    state.pile = shuffled(CARDS.length, rand).filter(id => id !== state.card);
    at = state.pile.findLastIndex(id => inDeck(id, deck));
  }
  const [id] = state.pile.splice(at, 1);
  state.card = id;
  state.deck = deck;
  state.n++;
}

export function newMatch(previous, rand) {
  const state = { status: 'playing', round: (previous?.round || 0) + 1, turn: null, winner: null, wins: { Moreno: 0, Cahya: 0 }, pile: shuffled(CARDS.length, rand),
    deck: previous?.deck || 'semua', card: null, n: previous?.n || 0, by: null, saved: previous?.saved || [], log: [] };
  draw(state, state.deck, rand);
  return state;
}

export function act(state, user, body, rand) {
  if (body.action === 'next') {
    const deck = body.deck ?? state.deck;
    if (deck !== 'semua' && !Object.hasOwn(DECKS, deck)) fail('Dek tidak dikenal.');
    draw(state, deck, rand);
    state.by = user;
    say(state, user, `${user} buka kartu ${CARDS[state.card].label}.`);
    return state;
  }
  if (body.action === 'save') {
    const id = body.id === undefined ? state.card : Number(body.id);
    if (!CARDS[id]) fail('Kartu tidak dikenal.');
    if (state.saved.includes(id)) state.saved = state.saved.filter(item => item !== id);
    else if (state.saved.length >= MAX_SAVED) fail('Kartu yang disimpan sudah penuh.');
    else state.saved = [...state.saved, id];
    return state;
  }
  fail('Aksi tidak dikenal.');
}

export function view(state, version, user) {
  const rival = other(user);
  if (!state) return { status: 'none', you: user, opponent: rival, wins: { Moreno: 0, Cahya: 0 }, total: CARDS.length, version };
  const card = CARDS[state.card];
  return { status: state.status, round: state.round, you: user, opponent: rival, turn: null, winner: null, wins: state.wins, total: CARDS.length,
    decks: [{ id: 'semua', label: 'Semua' }, ...Object.entries(DECKS).map(([id, { label }]) => ({ id, label }))], deck: state.deck,
    card: { id: state.card, deck: card.deck, label: card.label, text: card.text }, n: state.n, by: state.by, isSaved: state.saved.includes(state.card),
    saved: state.saved.map(id => ({ id, label: CARDS[id].label, text: CARDS[id].text })).reverse(), log: state.log, version };
}
