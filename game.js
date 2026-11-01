import { randomInt } from 'node:crypto';

// Kartu Snoomy: two-player shedding card games. Match the flavour or the value, empty your hand first.
// Four modes share one engine:
// - snoomy: the original Snoomy rules (Tukar Kartu, stacking +2/+4, playing same-value cards together).
// - klasik: the classic rules (0–9, Lewati, Balik, +2, Ganti Rasa, +4; a draw card is drawn at once, no stacking).
// - balik: double-sided cards; Bolak-balik flips every card to the dark side with harsher cards (+5, Lewati Semua,
//   Ambil Sampai Warna) and back again. You see the other side of your partner's cards.
// - ganas ("Tanpa Ampun"): +2/+4/+6/+10 stack onto any equal or bigger draw, no playable card means drawing until
//   one fits, 7 and 0 swap hands, Buang Semua discards a whole flavour, and 25 cards in hand loses the round.
// One shared match at a time, stored as JSON with an optimistic version.
export const PLAYERS = ['Moreno', 'Cahya'];
export const FLAVORS = ['matcha', 'stroberi', 'taro', 'vanila'];
export const DARK = ['kopi', 'anggur', 'jeruk', 'laut'];
export const MODES = ['snoomy', 'klasik', 'balik', 'ganas'];
export const MODE_NAME = { snoomy: 'Kartu Snoomy', klasik: 'Klasik', balik: 'Bolak-balik', ganas: 'Tanpa Ampun' };
const FLAVOR_NAME = { matcha: 'Matcha', stroberi: 'Stroberi', taro: 'Taro', vanila: 'Vanila', kopi: 'Kopi', anggur: 'Anggur', jeruk: 'Jeruk', laut: 'Laut' };
const VALUE_NAME = { plus1: '+1', plus2: '+2', cplus4: '+4', plus5: '+5', skip: 'Lewati', skipall: 'Lewati Semua', reverse: 'Balik', swap: 'Tukar Kartu',
  flip: 'Bolak-balik', discard: 'Buang Semua', wild: 'Ganti Rasa', plus4: '+4', wild2: 'Ganti Rasa +2', wildcolor: 'Ambil Sampai Warna',
  wrev4: 'Balik +4', plus6: '+6', plus10: '+10', roulette: 'Rolet Warna' };
// How many cards each draw card gives.
export const DRAWS = { plus1: 1, plus2: 2, cplus4: 4, plus4: 4, wild2: 2, plus5: 5, wrev4: 4, plus6: 6, plus10: 10 };
const HAND = 7, MERCY = 25;
const other = user => PLAYERS.find(p => p !== user);
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const say = (state, who, text) => { state.log = [...state.log, { who, text }].slice(-8); };
const modeOf = state => state.mode || 'snoomy';
// The face of a card that counts right now: double-sided cards show their light or dark side.
export const face = (state, card) => card.light ? card[state.side || 'light'] : card;
const label = (state, card) => { const c = face(state, card); return c.f === null ? VALUE_NAME[c.v] : `${FLAVOR_NAME[c.f]} ${VALUE_NAME[c.v] || c.v}`; };
const colours = state => state.side === 'dark' ? DARK : FLAVORS;

function shuffle(cards, rand) {
  for (let i = cards.length - 1; i > 0; i--) { const j = rand(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}
function cardsOf(spec) {
  const out = [];
  for (const [colours, values, wilds] of spec) {
    for (const f of colours) for (const [v, n] of values) for (let i = 0; i < n; i++) out.push({ f, v });
    for (const [v, n] of wilds) for (let i = 0; i < n; i++) out.push({ f: null, v });
  }
  return out;
}
const numbers = (from, copies) => Array.from({ length: 10 - from }, (_, i) => [String(i + from), copies]);

export function buildDeck(mode = 'snoomy', rand = randomInt) {
  let faces;
  if (mode === 'klasik') faces = cardsOf([[FLAVORS, [['0', 1], ...numbers(1, 2), ['skip', 2], ['reverse', 2], ['plus2', 2]], [['wild', 4], ['plus4', 4]]]]);
  else if (mode === 'ganas') faces = cardsOf([[FLAVORS, [...numbers(0, 2), ['plus2', 3], ['cplus4', 2], ['skip', 3], ['skipall', 2], ['reverse', 3], ['discard', 3]], [['wrev4', 8], ['plus6', 4], ['plus10', 4], ['roulette', 8]]]]);
  else if (mode === 'balik') {
    // Every card has a light side and a randomly paired dark side.
    const light = cardsOf([[FLAVORS, [...numbers(1, 2), ['plus1', 2], ['reverse', 2], ['skip', 2], ['flip', 2]], [['wild', 4], ['wild2', 4]]]]);
    const dark = shuffle(cardsOf([[DARK, [...numbers(1, 2), ['plus5', 2], ['reverse', 2], ['skipall', 2], ['flip', 2]], [['wild', 4], ['wildcolor', 4]]]]), rand);
    return light.map((card, i) => ({ id: `c${i + 1}`, light: card, dark: dark[i] }));
  } else faces = cardsOf([[FLAVORS, [...numbers(1, 2), ['plus2', 2], ['skip', 2], ['swap', 1]], [['wild', 4], ['plus4', 4]]]]);
  return faces.map((card, i) => ({ id: `c${i + 1}`, ...card }));
}

// Draws cards; ganas loses the round at 25 cards. Returns the cards drawn.
function drawCards(state, user, count, rand, until) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (!state.draw.length) {
      const top = state.discard.pop();
      state.draw = shuffle(state.discard, rand);
      state.discard = top ? [top] : [];
    }
    const card = state.draw.pop();
    if (!card) break;
    state.hands[user].push(card);
    drawn.push(card);
    if (until?.(card)) break;
  }
  if (modeOf(state) === 'ganas' && state.hands[user].length >= MERCY && state.status === 'playing') finish(state, other(user), `${user} memegang ${state.hands[user].length} kartu. Tanpa ampun: kalah ronde ini.`);
  return drawn;
}
function finish(state, winner, text) {
  state.status = 'finished'; state.winner = winner; state.wins = { ...state.wins, [winner]: state.wins[winner] + 1 };
  if (text) say(state, null, text);
  say(state, winner, `${winner} menang ronde ini ♡`);
}

export function newMatch(previous, rand = randomInt, mode) {
  mode = MODES.includes(mode) ? mode : previous?.mode || 'snoomy';
  const draw = shuffle(buildDeck(mode, rand), rand);
  const hands = { Moreno: draw.splice(-HAND), Cahya: draw.splice(-HAND) };
  const state = { mode, side: 'light', status: 'playing', round: (previous?.round || 0) + 1, draw, discard: [], hands, flavor: null, turn: null, drawn: null,
    penalty: 0, penaltyType: null, winner: null, wins: previous?.wins || { Moreno: 0, Cahya: 0 }, log: [] };
  // The first face-up card is always a plain number.
  const index = draw.findLastIndex(card => /^\d$/.test(face(state, card).v));
  const [top] = draw.splice(index, 1);
  state.discard.push(top);
  state.flavor = face(state, top).f;
  state.turn = previous?.winner ? other(previous.winner) : PLAYERS[rand(2)];
  say(state, null, `${MODE_NAME[mode]} · ronde ${state.round} dimulai. ${state.turn} jalan duluan.`);
  return state;
}

export function playable(state, card) {
  const c = face(state, card), top = face(state, state.discard.at(-1));
  if (state.penalty) {
    // snoomy: +2 answers +2 or +4, +4 only +4. ganas: any draw card at least as big as the last one.
    if (modeOf(state) === 'ganas') return (DRAWS[c.v] || 0) >= state.penaltyLast;
    return c.v === 'plus4' || (state.penaltyType === 'plus2' && c.v === 'plus2');
  }
  return c.f === null || c.f === state.flavor || c.v === top.v;
}

function mine(state, user) {
  if (state.status !== 'playing') fail('Permainan sudah selesai. Mulai ronde baru.', 409);
  if (state.turn !== user) fail(`Sekarang giliran ${state.turn}.`, 409);
}

export function play(state, user, { card: id, cards, flavor, call } = {}, rand = randomInt) {
  mine(state, user);
  const mode = modeOf(state);
  // Only the Snoomy rules allow several cards with the same number or symbol in one move.
  const ids = Array.isArray(cards) && cards.length ? cards : [id];
  if (ids.length > 12 || new Set(ids).size !== ids.length) fail('Pilihan kartunya tidak valid.');
  if (ids.length > 1 && mode !== 'snoomy') fail('Di mode ini kartu dimainkan satu per satu.');
  const hand = state.hands[user];
  const chosen = ids.map(cardId => hand.find(c => c.id === cardId));
  if (chosen.some(c => !c)) fail('Kartu itu tidak ada di tanganmu.');
  const [card] = chosen, c = face(state, card);
  if (state.drawn && state.drawn !== card.id) fail('Setelah ambil kartu, kamu hanya bisa memainkan kartu yang baru diambil atau lewat.');
  if (!playable(state, card)) {
    if (!state.penalty) fail('Kartu itu belum cocok. Samakan rasa atau angkanya.');
    fail(mode === 'ganas' ? `Balas dengan kartu tambah minimal +${state.penaltyLast}, atau ambil ${state.penalty} kartu.` : state.penaltyType === 'plus4' ? '+4 hanya bisa dibalas dengan +4.' : '+2 hanya bisa dibalas dengan +2 atau +4.');
  }
  if (chosen.some(x => face(state, x).v !== c.v)) fail('Kartu yang ditumpuk harus punya angka atau simbol yang sama.');
  const wild = c.f === null;
  if (wild && !colours(state).includes(flavor)) fail('Pilih rasa yang baru.');
  const rival = other(user), count = chosen.length;
  for (const x of chosen) { hand.splice(hand.indexOf(x), 1); state.discard.push(x); }
  state.flavor = wild ? flavor : face(state, chosen.at(-1)).f;
  state.drawn = null;
  const played = count > 1 ? `${count} kartu sekaligus: ${chosen.map(x => label(state, x)).join(' + ')}` : label(state, card);
  say(state, user, wild ? `${user} memainkan ${played} → ${FLAVOR_NAME[flavor]}.` : `${user} memainkan ${played}.`);
  // Buang Semua: every other card of that flavour goes too.
  if (c.v === 'discard') {
    const same = hand.filter(x => face(state, x).f === c.f);
    for (const x of same) { hand.splice(hand.indexOf(x), 1); state.discard.splice(state.discard.length - 1, 0, x); }
    if (same.length) say(state, user, `${user} membuang ${same.length} kartu ${FLAVOR_NAME[c.f]} lagi.`);
  }
  if (!hand.length) { finish(state, user); return state; }

  let again = false;
  const draws = DRAWS[c.v];
  if (draws && mode === 'snoomy') {
    state.penalty = (state.penalty || 0) + draws * count;
    state.penaltyType = c.v;
    say(state, rival, `${rival} harus ambil ${state.penalty} kartu atau membalas.`);
  } else if (draws && mode === 'ganas') {
    state.penalty = (state.penalty || 0) + draws;
    state.penaltyType = c.v; state.penaltyLast = draws;
    say(state, rival, `${rival} harus ambil ${state.penalty} kartu atau membalas dengan +${draws} ke atas.`);
  } else if (draws) {
    // Classic draw cards: the other player draws at once and misses the turn.
    drawCards(state, rival, draws, rand);
    again = true;
    say(state, rival, `${rival} ambil ${draws} kartu dan kehilangan giliran.`);
  }
  // With two players, Balik and Lewati Semua work like Lewati.
  if (['skip', 'reverse', 'skipall'].includes(c.v)) { again = true; say(state, rival, `${rival} kehilangan giliran.`); }
  if (c.v === 'swap') {
    for (let i = 0; i < count && hand.length && state.hands[rival].length; i++) {
      const give = rand(hand.length), take = rand(state.hands[rival].length);
      [hand[give], state.hands[rival][take]] = [state.hands[rival][take], hand[give]];
    }
    say(state, user, `${user} dan ${rival} bertukar ${count > 1 ? `${count} kartu` : 'satu kartu'} acak.`);
  }
  if (mode === 'ganas' && (c.v === '7' || c.v === '0')) {
    [state.hands[user], state.hands[rival]] = [state.hands[rival], state.hands[user]];
    say(state, user, `${user} dan ${rival} bertukar seluruh kartu!`);
  }
  if (c.v === 'wildcolor' || c.v === 'roulette') {
    const got = drawCards(state, rival, 60, rand, x => face(state, x).f === flavor);
    again = true;
    say(state, rival, `${rival} ambil ${got.length} kartu sampai dapat ${FLAVOR_NAME[flavor]}.`);
  }
  if (c.v === 'flip') {
    state.side = state.side === 'dark' ? 'light' : 'dark';
    const turned = face(state, state.discard.at(-1));
    // A wild on the new side keeps a random flavour of that side.
    state.flavor = turned.f ?? colours(state)[rand(4)];
    say(state, user, `Semua kartu dibalik ke sisi ${state.side === 'dark' ? 'gelap 🌙' : 'terang ☀️'}.`);
  }
  if (state.status !== 'playing') return state;
  // After 7/0 the hands have swapped, so look the hand up again.
  const left = state.hands[user].length;
  if (left === 1 && !call) { say(state, user, `${user} lupa bilang “Satu lagi ♡”, ambil 2 kartu.`); drawCards(state, user, 2, rand); }
  else if (left === 1) say(state, user, `${user}: “Satu lagi ♡”`);
  if (state.status === 'playing') state.turn = again ? user : rival;
  return state;
}

export function draw(state, user, rand = randomInt) {
  mine(state, user);
  if (state.penalty) {
    const owed = state.penalty;
    state.penalty = 0; state.penaltyType = null; state.penaltyLast = 0;
    say(state, user, `${user} ambil ${owed} kartu dan kehilangan giliran.`);
    drawCards(state, user, owed, rand);
    if (state.status === 'playing') state.turn = other(user);
    return state;
  }
  if (state.drawn) fail('Kamu sudah ambil kartu. Mainkan kartunya atau lewat.');
  // Tanpa Ampun: keep drawing until a card fits.
  const drawn = modeOf(state) === 'ganas' ? drawCards(state, user, 200, rand, card => playable(state, card)) : drawCards(state, user, 1, rand);
  if (state.status !== 'playing') return state;
  const card = drawn.at(-1);
  if (card && playable(state, card)) { state.drawn = card.id; say(state, user, `${user} ambil ${drawn.length} kartu.`); }
  else { state.turn = other(user); say(state, user, `${user} ambil ${drawn.length} kartu dan lewat.`); }
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
  if (!state) return { status: 'none', mode: 'snoomy', you: user, opponent: rival, wins: { Moreno: 0, Cahya: 0 }, version };
  const shown = card => ({ id: card.id, ...face(state, card) });
  const hand = state.hands[user].map(shown);
  const yourTurn = state.status === 'playing' && state.turn === user;
  const flipSide = state.side === 'dark' ? 'light' : 'dark';
  return {
    mode: modeOf(state), side: state.side || 'light',
    status: state.status, round: state.round, you: user, opponent: rival, turn: state.turn, winner: state.winner, wins: state.wins,
    hand, opponentCount: state.hands[rival].length, drawCount: state.draw.length, top: shown(state.discard.at(-1)), flavor: state.flavor,
    // Double-sided cards: the back of your partner's cards is their other side, as at a real table.
    opponentBacks: modeOf(state) === 'balik' ? state.hands[rival].map(card => card[flipSide]) : null,
    drawn: yourTurn ? state.drawn : null, penalty: state.penalty || 0, penaltyType: state.penaltyType || null, penaltyLast: state.penaltyLast || 0,
    playable: yourTurn ? state.hands[user].filter(card => (!state.drawn || card.id === state.drawn) && playable(state, card)).map(card => card.id) : [],
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
    if (req.body?.mode !== undefined && !MODES.includes(req.body.mode)) fail('Mode permainan tidak dikenal.');
    return newMatch(state, randomInt, req.body?.mode);
  }));
  app.post('/api/game/play', act((state, req) => { if (!state) fail('Belum ada permainan.', 409); return play(state, req.user, req.body); }));
  app.post('/api/game/draw', act((state, req) => { if (!state) fail('Belum ada permainan.', 409); return draw(state, req.user); }));
  app.post('/api/game/pass', act((state, req) => { if (!state) fail('Belum ada permainan.', 409); return pass(state, req.user); }));
}
