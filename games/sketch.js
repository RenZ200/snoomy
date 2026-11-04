// Tebak Gambar: one draws a secret word, the other watches it appear and guesses. A right guess scores for the guesser
// and the roles swap every round. The word only leaves the server for the drawer, or for both once the round is over.
import { WORDS } from './sketch-words.js';

export const PLAYERS = ['Moreno', 'Cahya'];
export const WIDTH = 1000, HEIGHT = 750, COLORS = 8, SIZES = 3, MAX_STROKES = 600, MAX_POINTS = 12000;
const other = user => PLAYERS.find(p => p !== user);
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const say = (state, who, text) => { state.log = [...state.log, { who, text }].slice(-8); };
const shuffled = (length, rand) => {
  const list = Array.from({ length }, (_, index) => index);
  for (let i = list.length - 1; i > 0; i--) { const j = rand(i + 1); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

export function newMatch(previous, rand) {
  const drawer = previous?.drawer ? other(previous.drawer) : PLAYERS[rand(2)];
  const pile = previous?.pile?.length >= 3 ? [...previous.pile] : shuffled(WORDS.length, rand);
  const state = { status: 'playing', stage: 'pick', round: (previous?.round || 0) + 1, drawer, turn: drawer, choices: pile.splice(-3), word: null,
    strokes: [], pile, winner: null, wins: previous?.wins || { Moreno: 0, Cahya: 0 }, log: [] };
  say(state, null, `Ronde ${state.round}. ${drawer} yang gambar.`);
  return state;
}

const clean = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

function pick(state, user, index) {
  if (user !== state.drawer) fail(`${state.drawer} yang milih kata.`);
  if (state.stage !== 'pick') fail('Katanya sudah dipilih.', 409);
  if (!Object.hasOwn(state.choices, index)) fail('Pilih salah satu kata.');
  state.word = WORDS[state.choices[index]];
  state.choices = [];
  state.stage = 'draw';
  state.turn = other(user);
  say(state, user, `${user} mulai gambar.`);
  return state;
}

// A stroke is {c: colour, s: size, p: [x, y, x, y, ...]}. "from" replaces everything after that stroke, which covers a
// stroke still being drawn, undo and clear with one rule, and makes a resend after a lost response harmless.
function stroke(raw) {
  const points = raw?.p;
  if (!Array.isArray(points) || points.length < 2 || points.length % 2 || points.length > MAX_POINTS) fail('Goresan tidak valid.');
  if (!Number.isInteger(raw.c) || raw.c < 0 || raw.c >= COLORS || !Number.isInteger(raw.s) || raw.s < 0 || raw.s >= SIZES) fail('Goresan tidak valid.');
  return { c: raw.c, s: raw.s, p: points.map((value, index) => {
    if (!Number.isFinite(value)) fail('Goresan tidak valid.');
    return Math.max(0, Math.min(index % 2 ? HEIGHT : WIDTH, Math.round(value)));
  }) };
}
function ink(state, user, body) {
  if (user !== state.drawer) fail(`${state.drawer} yang gambar.`);
  if (state.status !== 'playing' || state.stage !== 'draw') fail('Rondenya sudah lewat.', 409);
  const from = Math.min(Math.max(0, Number.parseInt(body.from, 10) || 0), state.strokes.length);
  const add = Array.isArray(body.add) ? body.add.map(stroke) : fail('Goresan tidak valid.');
  const strokes = [...state.strokes.slice(0, from), ...add];
  if (strokes.length > MAX_STROKES || strokes.reduce((total, line) => total + line.p.length / 2, 0) > MAX_POINTS) fail('Gambarnya udah kepenuhan. Hapus sedikit dulu.');
  state.strokes = strokes;
  return state;
}

function guess(state, user, text) {
  if (user === state.drawer) fail('Yang gambar nggak boleh nebak.');
  if (state.status !== 'playing' || state.stage !== 'draw') fail('Belum bisa nebak.', 409);
  const shown = String(text ?? '').trim().slice(0, 40), attempt = clean(shown), word = clean(state.word);
  if (!attempt) fail('Tulis tebakanmu dulu.');
  const away = distance(attempt, word);
  if (away === 0 || (away === 1 && word.length >= 5)) {
    state.status = 'finished';
    state.winner = user;
    state.wins = { ...state.wins, [user]: state.wins[user] + 1 };
    say(state, user, `${user} nebak "${shown}". Bener!`);
    return state;
  }
  say(state, user, `${user} nebak "${shown}"${away <= 2 || word.includes(attempt) && attempt.length >= 3 ? ', dikit lagi!' : ', salah.'}`);
  return state;
}

function giveUp(state, user) {
  if (user === state.drawer) fail('Yang gambar nggak bisa nyerah.');
  if (state.status !== 'playing' || state.stage !== 'draw') fail('Belum bisa nyerah.', 409);
  state.status = 'finished';
  say(state, user, `${user} nyerah. Katanya "${state.word}".`);
  return state;
}

export function act(state, user, body) {
  if (body.action === 'ink') return ink(state, user, body);
  if (state.status !== 'playing') fail('Rondenya sudah selesai.', 409);
  if (body.action === 'pick') return pick(state, user, Number(body.index));
  if (body.action === 'guess') return guess(state, user, body.text);
  if (body.action === 'giveup') return giveUp(state, user);
  fail('Aksi tidak dikenal.');
}

export function view(state, version, user) {
  const rival = other(user);
  if (!state) return { status: 'none', you: user, opponent: rival, wins: { Moreno: 0, Cahya: 0 }, version };
  const open = user === state.drawer || state.status === 'finished';
  return { status: state.status, stage: state.stage, round: state.round, you: user, opponent: rival, turn: state.turn, drawer: state.drawer,
    winner: state.winner, wins: state.wins, word: open ? state.word : null, choices: user === state.drawer ? state.choices.map(index => WORDS[index]) : [],
    hint: state.word ? state.word.split(' ').map(part => Array(part.length).fill('_').join(' ')).join('   ') : '',
    strokes: state.strokes, log: state.log, version };
}
