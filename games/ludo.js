// Ludo for two. Moreno plays matcha from the top-left yard, Cahya stroberi from the bottom-right one; four tokens each.
// A 6 brings a token out and earns another roll, and so do capturing and bringing a token home. Three 6s in a row
// forfeit the turn. Tokens need the exact number to get home. Start and star squares are safe from capture.
export const PLAYERS = ['Moreno', 'Cahya'];
export const START = { Moreno: 1, Cahya: 27 };
export const SAFE = [1, 9, 14, 22, 27, 35, 40, 48];
// Progress of a token: -1 in the yard, 0 its start square, 1..50 further along the 52-square loop,
// 51..55 its own home column, 56 home.
export const BASE = -1, LAST = 50, HOME = 56;
const other = user => PLAYERS.find(p => p !== user);
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const say = (state, who, text) => { state.log = [...state.log, { who, text }].slice(-8); };

// Index on the shared loop, or null while in the yard, the home column or home.
export const square = (user, progress) => progress >= 0 && progress <= LAST ? (START[user] + progress) % 52 : null;
export function target(progress, roll) {
  if (progress === BASE) return roll === 6 ? 0 : null;
  const next = progress + roll;
  return progress < HOME && next <= HOME ? next : null;
}
export const movable = (state, user, roll) => state.tokens[user].flatMap((progress, index) => target(progress, roll) === null ? [] : [index]);

export function newMatch(previous, rand) {
  const wins = previous?.wins || { Moreno: 0, Cahya: 0 };
  const turn = previous?.winner ? other(previous.winner) : PLAYERS[rand(2)];
  const state = { status: 'playing', round: (previous?.round || 0) + 1, turn, phase: 'roll', dice: null, sixes: 0, rolls: 0,
    tokens: { Moreno: [BASE, BASE, BASE, BASE], Cahya: [BASE, BASE, BASE, BASE] }, movable: [], last: null, winner: null, wins, log: [] };
  say(state, null, `Ronde ${state.round} dimulai. ${turn} lempar dadu duluan.`);
  return state;
}

function mine(state, user) {
  if (state.status !== 'playing') fail('Permainan sudah selesai. Mulai ronde baru.', 409);
  if (state.turn !== user) fail(`Sekarang giliran ${state.turn}.`, 409);
}
function endTurn(state, user) {
  state.turn = other(user); state.sixes = 0; state.phase = 'roll'; state.movable = [];
}

function moveToken(state, user, index) {
  const roll = state.dice, rival = other(user);
  const from = state.tokens[user][index], to = target(from, roll);
  state.tokens[user][index] = to;
  const at = square(user, to), captured = [];
  if (at !== null && !SAFE.includes(at)) {
    state.tokens[rival].forEach((progress, i) => {
      if (square(rival, progress) === at) { captured.push({ token: i, from: progress }); state.tokens[rival][i] = BASE; }
    });
  }
  state.last = { ...state.last, token: index, from, to, captured };
  state.phase = 'roll'; state.movable = [];
  if (from === BASE) say(state, user, `${user} mengeluarkan bidak baru.`);
  else if (to === HOME) say(state, user, `${user} membawa satu bidak pulang ♡`);
  if (captured.length) say(state, user, `${user} memakan ${captured.length > 1 ? `${captured.length} bidak` : 'bidak'} ${rival}! Balik ke kandang.`);
  if (state.tokens[user].every(progress => progress === HOME)) {
    state.status = 'finished'; state.winner = user; state.wins = { ...state.wins, [user]: state.wins[user] + 1 };
    say(state, user, `${user} menang ronde ini ♡`);
    return state;
  }
  if (roll === 6 || captured.length || to === HOME) say(state, user, `${user} lempar lagi.`);
  else endTurn(state, user);
  return state;
}

export function roll(state, user, rand) {
  mine(state, user);
  if (state.phase !== 'roll') fail('Pilih dulu bidak yang mau jalan.', 409);
  const value = rand(6) + 1;
  state.dice = value; state.rolls += 1; state.sixes = value === 6 ? state.sixes + 1 : 0;
  state.last = { who: user, roll: value, n: state.rolls, token: null, from: null, to: null, captured: [] };
  if (state.sixes === 3) {
    say(state, user, `${user} dapat 6 tiga kali berturut-turut, gilirannya hangus.`);
    endTurn(state, user);
    return state;
  }
  const options = movable(state, user, value);
  if (!options.length) {
    say(state, user, `${user} dapat ${value}, belum ada bidak yang bisa jalan.`);
    endTurn(state, user);
    return state;
  }
  // Only one real choice (one token, or tokens all on the same spot): move it at once.
  if (new Set(options.map(index => state.tokens[user][index])).size === 1) return moveToken(state, user, options[0]);
  state.phase = 'move'; state.movable = options;
  say(state, user, `${user} dapat ${value}.`);
  return state;
}

export function move(state, user, index) {
  mine(state, user);
  if (state.phase !== 'move') fail('Lempar dadu dulu.', 409);
  if (!state.movable.includes(index)) fail('Bidak itu tidak bisa jalan dengan angka ini.');
  return moveToken(state, user, index);
}

export function act(state, user, body, rand) {
  if (body.action === 'roll') return roll(state, user, rand);
  if (body.action === 'move') return move(state, user, Number(body.token));
  fail('Aksi tidak dikenal.');
}

export function view(state, version, user) {
  const rival = other(user);
  if (!state) return { status: 'none', you: user, opponent: rival, wins: { Moreno: 0, Cahya: 0 }, version };
  const yourTurn = state.status === 'playing' && state.turn === user;
  return {
    status: state.status, round: state.round, you: user, opponent: rival, turn: state.turn, winner: state.winner, wins: state.wins,
    phase: state.phase, dice: state.dice, rolls: state.rolls, tokens: state.tokens, last: state.last, log: state.log, version,
    canRoll: yourTurn && state.phase === 'roll', movable: yourTurn && state.phase === 'move' ? state.movable : [],
  };
}
