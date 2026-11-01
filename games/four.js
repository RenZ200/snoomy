// Empat Sejajar: drop discs into a 7×6 frame; four in a row (across, down or diagonal) wins.
// The loser starts the next round; after a draw the other player starts.
export const PLAYERS = ['Moreno', 'Cahya'];
export const ROWS = 6, COLS = 7;
const other = user => PLAYERS.find(p => p !== user);
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
const say = (state, who, text) => { state.log = [...state.log, { who, text }].slice(-8); };

export function newMatch(previous, rand) {
  const wins = previous?.wins || { Moreno: 0, Cahya: 0 };
  const starter = previous?.winner ? other(previous.winner) : previous?.starter ? other(previous.starter) : PLAYERS[rand(2)];
  const state = { status: 'playing', round: (previous?.round || 0) + 1, board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    turn: starter, starter, moves: 0, last: null, line: null, winner: null, wins, log: [] };
  say(state, null, `Ronde ${state.round} dimulai. ${starter} jalan duluan.`);
  return state;
}

// The cells of a line of four or more through (row, col), or null.
export function line(board, row, col) {
  const who = board[row][col];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [[row, col]];
    for (const step of [1, -1]) {
      for (let r = row + dr * step, c = col + dc * step; board[r]?.[c] === who; r += dr * step, c += dc * step) cells.push([r, c]);
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

export function drop(state, user, col) {
  if (state.status !== 'playing') fail('Permainan sudah selesai. Mulai ronde baru.', 409);
  if (state.turn !== user) fail(`Sekarang giliran ${state.turn}.`, 409);
  if (!Number.isInteger(col) || col < 0 || col >= COLS) fail('Kolom tidak valid.');
  const row = state.board.findLastIndex(cells => !cells[col]);
  if (row < 0) fail('Kolom itu sudah penuh.');
  state.board[row][col] = user;
  state.moves += 1;
  state.last = { row, col, who: user, n: state.moves };
  const won = line(state.board, row, col);
  if (won) {
    state.status = 'finished'; state.winner = user; state.line = won; state.wins = { ...state.wins, [user]: state.wins[user] + 1 };
    say(state, user, `${user} menyusun empat sejajar dan menang ♡`);
  } else if (state.moves === ROWS * COLS) {
    state.status = 'finished';
    say(state, null, 'Papan penuh. Seri!');
  } else state.turn = other(user);
  return state;
}

export function act(state, user, body) {
  if (body.action === 'drop') return drop(state, user, Number(body.col));
  fail('Aksi tidak dikenal.');
}

export function view(state, version, user) {
  const rival = other(user);
  if (!state) return { status: 'none', you: user, opponent: rival, wins: { Moreno: 0, Cahya: 0 }, version };
  return { status: state.status, round: state.round, you: user, opponent: rival, turn: state.turn, winner: state.winner, wins: state.wins,
    board: state.board, last: state.last, line: state.line, moves: state.moves, log: state.log, version };
}
