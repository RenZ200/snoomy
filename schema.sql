PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
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
