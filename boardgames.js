import { randomInt } from 'node:crypto';
import * as ludo from './games/ludo.js';
import * as four from './games/four.js';
import * as snakes from './games/snakes.js';

// Ludo, Empat Sejajar and Ular Tangga. Like Kartu Snoomy there is one shared match per game, stored as JSON in
// board_games with an optimistic version: a double tap or a move from the other phone gets 409 and the client reloads.
export const BOARD_GAMES = { ludo, four, snakes };
const fail = (message, status = 400) => { const e = Error(message); e.status = status; throw e; };
// Enough to show every game's status in the picker and to remind whose turn it is.
const brief = (row, user) => {
  const state = row?.state ? JSON.parse(row.state) : null, version = Number(row?.version || 0);
  return state
    ? { status: state.status, round: state.round, turn: state.turn, winner: state.winner, wins: state.wins, version, yourTurn: state.status === 'playing' && state.turn === user }
    : { status: 'none', version };
};

export function mountBoardGames(app, db) {
  const rules = name => Object.hasOwn(BOARD_GAMES, name) ? BOARD_GAMES[name] : fail('Permainan tidak ditemukan.', 404);
  const load = async name => {
    const row = await db.prepare('SELECT state,version FROM board_games WHERE name=?').get(name);
    return { state: row?.state ? JSON.parse(row.state) : null, version: Number(row?.version || 0) };
  };
  const save = async (name, state, version) => {
    const result = await db.prepare('UPDATE board_games SET state=?,version=version+1 WHERE name=? AND version=?').run(JSON.stringify(state), name, version);
    if (!result.changes) fail('Papan baru saja berubah. Coba lagi.', 409);
    return version + 1;
  };
  const act = fn => async (req, res) => {
    const game = rules(req.params.name);
    const { state, version } = await load(req.params.name);
    if (req.body?.version !== undefined && Number(req.body.version) !== version) fail('Papan baru saja berubah. Coba lagi.', 409);
    const next = fn(game, state, req);
    res.json(game.view(next, await save(req.params.name, next, version), req.user));
  };

  app.get('/api/games', async (req, res) => {
    const [rows, cards] = await Promise.all([
      db.prepare('SELECT name,state,version FROM board_games').all(),
      db.prepare('SELECT state,version FROM card_game WHERE id=1').get(),
    ]);
    const games = { cards: brief(cards, req.user) };
    for (const name of Object.keys(BOARD_GAMES)) games[name] = brief(rows.find(row => row.name === name), req.user);
    res.json({ you: req.user, games });
  });
  app.get('/api/games/:name', async (req, res) => {
    const game = rules(req.params.name);
    const { state, version } = await load(req.params.name);
    res.json(game.view(state, version, req.user));
  });
  app.post('/api/games/:name/new', act((game, state, req) => {
    if (state?.status === 'playing' && req.body?.restart !== true) fail('Ronde ini masih berjalan.', 409);
    return game.newMatch(state, randomInt);
  }));
  app.post('/api/games/:name/move', act((game, state, req) => {
    if (!state) fail('Belum ada permainan.', 409);
    return game.act(state, req.user, req.body || {}, randomInt);
  }));
}
