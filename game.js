import { randomInt } from 'node:crypto';

// Kartu Snoomy: an original two-player shedding card game. Match the flavour or the value,
// empty your hand first. +2 and +4 stack: +2 answers +2 or +4, +4 only answers +4.
// Cards sharing a number or symbol may be played together in one move. One shared match at a time, stored as JSON with an optimistic version.
export const PLAYERS = ['Moreno', 'Cahya'];
export const FLAVORS = ['matcha', 'stroberi', 'taro', 'vanila'];
const FLAVOR_NAME = { matcha: 'Matcha', stroberi: 'Stroberi', taro: 'Taro', vanila: 'Vanila' };
const VALUE_NAME = { plus2: '+2', skip: 'Lewati', swap: 'Tukar Kartu', wild: 'Ganti Rasa', plus4: '+4' };
const WILD = ['wild', 'plus4'];
const HAND = 7;
const other = user => PLAYERS.find(p => p !== user);
const label = card => card.v === 'wild' ? 'Ganti Rasa' : card.v === 'plus4' ? '+4' : `${FLAVOR_NAME[card.f]} ${VALUE_NAME[card.v] || card.v}`;

export function buildDeck() {
  const cards = [];
  let n = 0;
  const add = (f, v) => cards.push({ id: `c${++n}`, f, v });
  for (const f of FLAVORS) {
    for (let v = 1; v <= 9; v++) { add(f, String(v)); add(f, String(v)); }
    for (const v of ['plus2', 'plus2', 'skip', 'skip', 'swap']) add(f, v);
  }
  for (let i = 0; i < 4; i++) { add(null, 'wild'); add(null, 'plus4'); }
  return cards;
}
function shuffle(cards, rand) {
  for (let i = cards.length - 1; i > 0; i--) { const j = rand(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const say = (state, who, text) => { state.log = [...state.log, { who, text }].slice(-8); };

function drawCards(state, user, count, rand) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (!state.draw.length) {
      // Reshuffle everything under the top card back into the draw pile.
      const top = state.discard.pop();
      state.draw = shuffle(state.discard, rand);
      state.discard = top ? [top] : [];
    }
    const card = state.draw.pop();
    if (!card) break;
    state.hands[user].push(card);
    drawn.push(card);
  }
  return drawn;
}

export function newMatch(previous, rand = randomInt) {
  const draw = shuffle(buildDeck(), rand);
  const hands = { Moreno: draw.splice(-HAND), Cahya: draw.splice(-HAND) };
  // The first face-up card is always a plain number.
  let index = draw.findLastIndex(card => /^\d$/.test(card.v));
  const [top] = draw.splice(index, 1);
  const wins = previous?.wins || { Moreno: 0, Cahya: 0 };
  const loser = previous?.winner ? other(previous.winner) : null;
  const turn = loser || PLAYERS[rand(2)];
  const state = { status: 'playing', round: (previous?.round || 0) + 1, draw, discard: [top], hands, flavor: top.f, turn, drawn: null, penalty: 0, penaltyType: null, winner: null, wins, log: [] };
  say(state, null, `Ronde ${state.round} dimulai. ${turn} jalan duluan.`);
  return state;
}

export function playable(state, card) {
  // While a +2/+4 stack is open, only a stacking card may answer it.
  if (state.penalty) return card.v === 'plus4' || (state.penaltyType === 'plus2' && card.v === 'plus2');
  return WILD.includes(card.v) || card.f === state.flavor || card.v === state.discard.at(-1).v;
}

function mine(state, user) {
  if (state.status !== 'playing') fail('Permainan sudah selesai. Mulai ronde baru.', 409);
  if (state.turn !== user) fail(`Sekarang giliran ${state.turn}.`, 409);
}

export function play(state, user, { card: id, cards, flavor, call } = {}, rand = randomInt) {
  mine(state, user);
  // Several cards with the same number or symbol can go down together; the first one must fit.
  const ids = Array.isArray(cards) && cards.length ? cards : [id];
  if (ids.length > 12 || new Set(ids).size !== ids.length) fail('Pilihan kartunya tidak valid.');
  const hand = state.hands[user];
  const chosen = ids.map(cardId => hand.find(c => c.id === cardId));
  if (chosen.some(c => !c)) fail('Kartu itu tidak ada di tanganmu.');
  const [card] = chosen;
  if (state.drawn && state.drawn !== card.id) fail('Setelah ambil kartu, kamu hanya bisa memainkan kartu yang baru diambil atau lewat.');
  if (!playable(state, card)) fail(state.penalty ? (state.penaltyType === 'plus4' ? '+4 hanya bisa dibalas dengan +4.' : '+2 hanya bisa dibalas dengan +2 atau +4.') : 'Kartu itu belum cocok. Samakan rasa atau angkanya.');
  if (chosen.some(c => c.v !== card.v)) fail('Kartu yang ditumpuk harus punya angka atau simbol yang sama.');
  if (WILD.includes(card.v) && !FLAVORS.includes(flavor)) fail('Pilih rasa yang baru.');
  const rival = other(user), count = chosen.length;
  for (const c of chosen) { hand.splice(hand.indexOf(c), 1); state.discard.push(c); }
  state.flavor = WILD.includes(card.v) ? flavor : chosen.at(-1).f;
  state.drawn = null;
  const played = count > 1 ? `${count} kartu sekaligus: ${chosen.map(label).join(' + ')}` : label(card);
  say(state, user, WILD.includes(card.v) ? `${user} memainkan ${played} → ${FLAVOR_NAME[flavor]}.` : `${user} memainkan ${played}.`);
  if (!hand.length) {
    state.status = 'finished'; state.winner = user; state.wins = { ...state.wins, [user]: state.wins[user] + 1 };
    say(state, user, `${user} menang ronde ini ♡`);
    return state;
  }
  let again = false;
  if (card.v === 'plus2' || card.v === 'plus4') {
    state.penalty = (state.penalty || 0) + (card.v === 'plus2' ? 2 : 4) * count;
    state.penaltyType = card.v;
    say(state, rival, `${rival} harus ambil ${state.penalty} kartu atau membalas.`);
  }
  if (card.v === 'skip') { again = true; say(state, rival, `${rival} kehilangan giliran.`); }
  if (card.v === 'swap') {
    for (let i = 0; i < count && hand.length && state.hands[rival].length; i++) {
      const give = rand(hand.length), take = rand(state.hands[rival].length);
      [hand[give], state.hands[rival][take]] = [state.hands[rival][take], hand[give]];
    }
    say(state, user, `${user} dan ${rival} bertukar ${count > 1 ? `${count} kartu` : 'satu kartu'} acak.`);
  }
  if (hand.length === 1 && !call) { drawCards(state, user, 2, rand); say(state, user, `${user} lupa bilang “Satu lagi ♡”, ambil 2 kartu.`); }
  else if (hand.length === 1) say(state, user, `${user}: “Satu lagi ♡”`);
  state.turn = again ? user : rival;
  return state;
}

export function draw(state, user, rand = randomInt) {
  mine(state, user);
  if (state.penalty) {
    const owed = state.penalty;
    drawCards(state, user, owed, rand);
    state.penalty = 0; state.penaltyType = null; state.turn = other(user);
    say(state, user, `${user} ambil ${owed} kartu dan kehilangan giliran.`);
    return state;
  }
  if (state.drawn) fail('Kamu sudah ambil kartu. Mainkan kartunya atau lewat.');
  const [card] = drawCards(state, user, 1, rand);
  if (card && playable(state, card)) { state.drawn = card.id; say(state, user, `${user} ambil 1 kartu.`); }
  else { state.turn = other(user); say(state, user, `${user} ambil 1 kartu dan lewat.`); }
  return state;
}

export function pass(state, user) {
  mine(state, user);
  if (!state.drawn) fail('Ambil kartu dulu sebelum lewat.');
  state.drawn = null; state.turn = other(user);
  say(state, user, `${user} menyimpan kartunya dan lewat.`);
  return state;
}

export function view(state, version, user) {
  const rival = other(user);
  if (!state) return { status: 'none', you: user, opponent: rival, wins: { Moreno: 0, Cahya: 0 }, version };
  const hand = state.hands[user];
  const yourTurn = state.status === 'playing' && state.turn === user;
  return {
    status: state.status, round: state.round, you: user, opponent: rival, turn: state.turn, winner: state.winner, wins: state.wins,
    hand, opponentCount: state.hands[rival].length, drawCount: state.draw.length, top: state.discard.at(-1), flavor: state.flavor,
    drawn: yourTurn ? state.drawn : null, penalty: state.penalty || 0, penaltyType: state.penaltyType || null,
    playable: yourTurn ? hand.filter(card => (!state.drawn || card.id === state.drawn) && playable(state, card)).map(card => card.id) : [],
    log: state.log, version,
  };
}

export function mountGame(app, db) {
  const load = async () => {
    const row = await db.prepare('SELECT state,version FROM card_game WHERE id=1').get();
    return { state: row?.state ? JSON.parse(row.state) : null, version: Number(row?.version || 0) };
  };
  // Optimistic write: a stale version (double tap, other phone) gets 409 and the client reloads.
  const save = async (state, version) => {
    const result = await db.prepare('UPDATE card_game SET state=?,version=version+1 WHERE id=1 AND version=?').run(JSON.stringify(state), version);
    if (!result.changes) fail('Meja baru saja berubah. Coba lagi.', 409);
    return version + 1;
  };
  const act = fn => async (req, res) => {
    const { state, version } = await load();
    if (req.body?.version !== undefined && Number(req.body.version) !== version) fail('Meja baru saja berubah. Coba lagi.', 409);
    const next = fn(state, req);
    res.json(view(next, await save(next, version), req.user));
  };
  app.get('/api/game', async (req, res) => { const { state, version } = await load(); res.json(view(state, version, req.user)); });
  app.post('/api/game/new', act((state, req) => {
    if (state?.status === 'playing' && req.body?.restart !== true) fail('Ronde ini masih berjalan.', 409);
    return newMatch(state);
  }));
  app.post('/api/game/play', act((state, req) => { if (!state) fail('Belum ada permainan.', 409); return play(state, req.user, req.body); }));
  app.post('/api/game/draw', act((state, req) => { if (!state) fail('Belum ada permainan.', 409); return draw(state, req.user); }));
  app.post('/api/game/pass', act((state, req) => { if (!state) fail('Belum ada permainan.', 409); return pass(state, req.user); }));
}
