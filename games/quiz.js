// Seberapa Kenal Aku: eight questions a match. Both answer in secret, the answers open together, and whoever knew the
// other better wins. Open questions are judged by the person they are about; pick-one and "siapa" questions judge themselves.
import { KNOW, PAIRS, WHO } from './quiz-questions.js';

export const PLAYERS = ['Moreno', 'Cahya'];
export const MAX_ANSWER = 120, MAX_ASKED = 30;
const SOURCES = { know: KNOW, pair: PAIRS, who: WHO };
const other = user => PLAYERS.find(p => p !== user);
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const say = (state, who, text) => { state.log = [...state.log, { who, text }].slice(-8); };
const capital = text => text[0].toUpperCase() + text.slice(1);
// How a question reads for one person; with no reader it uses both names, for the recap.
const phrase = (q, reader) => capital(q.text.replaceAll('{nama}', reader === q.about ? 'kamu' : q.about).replaceAll('{aku}', reader && reader !== q.about ? 'kamu' : other(q.about)));
const shuffled = (length, rand) => {
  const list = Array.from({ length }, (_, index) => index);
  for (let i = list.length - 1; i > 0; i--) { const j = rand(i + 1); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// Every question comes up once before any repeats, and each person's own questions go first.
function question(state, kind, about, rand) {
  if (kind === 'know') {
    const own = state.custom.findIndex(item => item.by === about);
    if (own >= 0) { const [item] = state.custom.splice(own, 1); return { kind, text: item.text, about, custom: item.id }; }
  }
  if (!state.piles[kind]?.length) state.piles[kind] = shuffled(SOURCES[kind].length, rand);
  const source = SOURCES[kind][state.piles[kind].pop()];
  return kind === 'pair' ? { kind, text: `${source[0]} atau ${source[1]}?`, about, options: source.map(capital) } : { kind, text: source, about };
}

export function newMatch(previous, rand) {
  const first = previous?.starter ? other(previous.starter) : PLAYERS[rand(2)], second = other(first);
  const custom = [...(previous?.custom || [])];
  // A restart gives back the personal questions that were never reached.
  if (previous?.status === 'playing') for (const item of previous.questions.slice(previous.index).reverse()) if (item.custom) custom.unshift({ id: item.custom, by: item.about, text: item.text });
  const state = { status: 'playing', stage: 'answer', round: (previous?.round || 0) + 1, starter: first, turn: [...PLAYERS], questions: [], index: 0, answers: {}, right: null,
    scores: { Moreno: 0, Cahya: 0 }, past: [], piles: previous?.piles || {}, custom, nextId: previous?.nextId || 1, winner: null, wins: previous?.wins || { Moreno: 0, Cahya: 0 }, log: [] };
  const slots = [['know', first], ['pair', second], ['who', first], ['know', second], ['pair', first], ['know', first], ['who', second], ['know', second]];
  state.questions = slots.map(([kind, about]) => question(state, kind, about, rand));
  say(state, null, `Ronde ${state.round} dimulai. Jawab diem-diem ya.`);
  return state;
}

function settle(state, right) {
  const q = state.questions[state.index], guesser = other(q.about);
  const earners = !right ? [] : q.kind === 'who' ? PLAYERS : [guesser];
  for (const name of earners) state.scores[name]++;
  state.past.push({ kind: q.kind, text: phrase(q), about: q.about, answers: state.answers, right });
  say(state, null, q.kind === 'who' ? (right ? 'Kompak! Dua-duanya dapet poin.' : 'Beda jawaban, nggak ada poin.') : `${guesser} ${right ? 'bener, dapet poin' : 'salah nebak'}.`);
  state.index++;
  state.answers = {};
  state.right = null;
  if (state.index < state.questions.length) { state.stage = 'answer'; state.turn = [...PLAYERS]; return state; }
  const [a, b] = PLAYERS, gap = state.scores[a] - state.scores[b];
  state.status = 'finished';
  state.stage = 'done';
  state.turn = [];
  state.winner = gap > 0 ? a : gap < 0 ? b : null;
  if (state.winner) state.wins = { ...state.wins, [state.winner]: state.wins[state.winner] + 1 };
  return state;
}

function answer(state, user, value) {
  if (state.stage !== 'answer') fail('Jawabannya sudah dibuka.', 409);
  if (state.answers[user] != null) fail('Kamu sudah jawab.', 409);
  const q = state.questions[state.index], text = String(value ?? '').trim();
  if (q.kind === 'who' && !PLAYERS.includes(text)) fail('Pilih salah satu nama.');
  if (q.kind === 'pair' && !q.options.includes(text)) fail('Pilih salah satu.');
  if (!text) fail('Tulis jawabanmu dulu.');
  state.answers = { ...state.answers, [user]: text.slice(0, MAX_ANSWER) };
  state.turn = state.turn.filter(name => name !== user);
  say(state, user, `${user} udah jawab.`);
  if (state.turn.length) return state;
  state.stage = 'reveal';
  state.right = q.kind === 'know' ? null : state.answers.Moreno === state.answers.Cahya;
  state.turn = q.kind === 'know' ? [q.about] : [...PLAYERS];
  return state;
}

function mark(state, user, right) {
  const q = state.questions[state.index];
  if (state.stage !== 'reveal' || q.kind !== 'know') fail('Belum bisa dinilai.', 409);
  if (user !== q.about) fail(`${q.about} yang nilai.`);
  return settle(state, right === true);
}

function ask(state, user, value) {
  const text = String(value ?? '').trim().slice(0, 140);
  if (text.length < 4) fail('Pertanyaannya kependekan.');
  if (state.custom.filter(item => item.by === user).length >= MAX_ASKED) fail('Antreannya penuh. Mainin dulu yang ada.');
  state.custom = [...state.custom, { id: state.nextId, by: user, text }];
  state.nextId++;
  return state;
}

export function act(state, user, body) {
  if (body.action === 'ask') return ask(state, user, body.text);
  if (body.action === 'unask') { state.custom = state.custom.filter(item => item.by !== user || item.id !== Number(body.id)); return state; }
  if (state.status !== 'playing') fail('Rondenya sudah selesai.', 409);
  if (body.action === 'answer') return answer(state, user, body.text);
  if (body.action === 'mark') return mark(state, user, body.right);
  if (body.action === 'next') {
    if (state.stage !== 'reveal' || state.right === null) fail('Belum bisa lanjut.', 409);
    return settle(state, state.right);
  }
  fail('Aksi tidak dikenal.');
}

export function view(state, version, user) {
  const rival = other(user);
  if (!state) return { status: 'none', you: user, opponent: rival, wins: { Moreno: 0, Cahya: 0 }, version };
  const q = state.questions[state.index];
  return { status: state.status, stage: state.stage, round: state.round, you: user, opponent: rival, turn: state.turn.includes(user) ? user : state.turn[0] ?? null,
    winner: state.winner, wins: state.wins, scores: state.scores, index: state.index, total: state.questions.length,
    question: q ? { kind: q.kind, text: phrase(q, user), about: q.about, options: q.options, custom: !!q.custom } : null,
    answered: state.stage === 'answer' ? PLAYERS.filter(name => state.answers[name] != null) : PLAYERS, yours: state.answers[user] ?? null,
    answers: state.stage === 'reveal' ? state.answers : null, right: state.right, last: state.past.at(-1) ?? null, past: state.status === 'finished' ? state.past : [],
    mine: state.custom.filter(item => item.by === user), theirs: state.custom.filter(item => item.by === rival).length, log: state.log, version };
}
