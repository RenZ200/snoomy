// Ular Tangga: race from 1 to 100. Ladders lift you up, snakes slide you down. A 6 earns another roll.
// A roll past 100 bounces back by the extra steps; landing exactly on 100 wins.
export const PLAYERS = ['Moreno', 'Cahya'];
export const GOAL = 100;
export const LADDERS = { 3: 22, 8: 30, 28: 55, 36: 44, 51: 72, 58: 77, 71: 92, 80: 99 };
export const SNAKES = { 17: 4, 32: 10, 47: 26, 62: 18, 74: 53, 88: 69, 95: 56, 97: 78 };
const other = user => PLAYERS.find(p => p !== user);
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const say = (state, who, text) => { state.log = [...state.log, { who, text }].slice(-8); };

export function newMatch(previous, rand) {
  const wins = previous?.wins || { Moreno: 0, Cahya: 0 };
  const turn = previous?.winner ? other(previous.winner) : PLAYERS[rand(2)];
  const state = { status: 'playing', round: (previous?.round || 0) + 1, turn, positions: { Moreno: 0, Cahya: 0 }, dice: null, rolls: 0,
    last: null, winner: null, wins, log: [] };
  say(state, null, `Ronde ${state.round} dimulai. ${turn} lempar dadu duluan.`);
  return state;
}

export function roll(state, user, rand) {
  if (state.status !== 'playing') fail('Permainan sudah selesai. Mulai ronde baru.', 409);
  if (state.turn !== user) fail(`Sekarang giliran ${state.turn}.`, 409);
  const value = rand(6) + 1, from = state.positions[user];
  let to = from + value;
  const bounced = to > GOAL;
  if (bounced) to = GOAL - (to - GOAL);
  const end = LADDERS[to] || SNAKES[to] || to;
  const via = LADDERS[to] ? 'ladder' : SNAKES[to] ? 'snake' : null;
  state.positions[user] = end;
  state.dice = value; state.rolls += 1;
  state.last = { who: user, roll: value, from, to, end, via, bounced, n: state.rolls };
  say(state, user, `${user} dapat ${value} → petak ${to}${bounced ? ' (memantul)' : ''}.`);
  if (via === 'ladder') say(state, user, `Naik tangga ke ${end}!`);
  if (via === 'snake') say(state, user, `Digigit ular, turun ke ${end}.`);
  if (end === GOAL) {
    state.status = 'finished'; state.winner = user; state.wins = { ...state.wins, [user]: state.wins[user] + 1 };
    say(state, user, `${user} sampai di 100 dan menang ♡`);
  } else if (value === 6) say(state, user, `${user} dapat 6, lempar lagi.`);
  else state.turn = other(user);
  return state;
}

export function act(state, user, body, rand) {
  if (body.action === 'roll') return roll(state, user, rand);
  fail('Aksi tidak dikenal.');
}

export function view(state, version, user) {
  const rival = other(user);
  if (!state) return { status: 'none', you: user, opponent: rival, wins: { Moreno: 0, Cahya: 0 }, version };
  return { status: state.status, round: state.round, you: user, opponent: rival, turn: state.turn, winner: state.winner, wins: state.wins,
    positions: state.positions, dice: state.dice, rolls: state.rolls, last: state.last, log: state.log, version,
    canRoll: state.status === 'playing' && state.turn === user };
}
