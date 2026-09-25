PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sessions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 token_hash TEXT NOT NULL UNIQUE, user_name TEXT NOT NULL,
 expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS login_attempts (
 user_name TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS schedules (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner TEXT NOT NULL CHECK(owner IN ('Moreno','Cahya')),
 day INTEGER NOT NULL CHECK(day BETWEEN 1 AND 7),
 start TEXT NOT NULL, end TEXT NOT NULL CHECK(end > start),
 course TEXT NOT NULL, lecturer TEXT NOT NULL DEFAULT '', room TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL, deadline TEXT NOT NULL,
 assignee TEXT NOT NULL CHECK(assignee IN ('Moreno','Cahya','Berdua')),
 priority TEXT NOT NULL CHECK(priority IN ('Rendah','Sedang','Tinggi')),
 done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1))
);

CREATE TABLE IF NOT EXISTS budget_records (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kind TEXT NOT NULL CHECK(kind IN ('transaction','limit','reminder','goal')),
 data TEXT NOT NULL,
 created_by TEXT NOT NULL CHECK(created_by IN ('Moreno','Cahya'))
);

CREATE TABLE IF NOT EXISTS google_connections (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT NOT NULL UNIQUE, tokens TEXT NOT NULL, calendar_id TEXT NOT NULL DEFAULT '', last_synced BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS google_states (
 id INTEGER PRIMARY KEY AUTOINCREMENT, state_hash TEXT NOT NULL UNIQUE, browser_hash TEXT NOT NULL, session_hash TEXT NOT NULL, user_name TEXT NOT NULL, verifier TEXT NOT NULL, expires BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS google_maps (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('schedule','task')), local_id INTEGER NOT NULL, event_id TEXT NOT NULL, baseline TEXT NOT NULL, UNIQUE(user_name,kind,local_id), UNIQUE(user_name,event_id)
);
CREATE TABLE IF NOT EXISTS google_lock (id INTEGER PRIMARY KEY, owner TEXT NOT NULL DEFAULT '', expires BIGINT NOT NULL DEFAULT 0);
INSERT INTO google_lock(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
