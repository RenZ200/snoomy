import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter } from '../database.js';
import { createAuth } from '../auth.js';

test('PostgreSQL schema and adapter execute real SQL with constraints, IDs and CRUD', async () => {
  const engine = new PGlite();
  const db = postgresAdapter({
    query: async (sql, args) => { const r=await engine.query(sql,args); return {rows:r.rows,rowCount:r.affectedRows ?? r.rows.length}; },
    end: () => engine.close(),
  });
  try {
    await engine.exec(readFileSync(new URL('../schema-postgres.sql',import.meta.url),'utf8'));
    const authA=createAuth(db), authB=createAuth(db);
    const token=await authA.create('Moreno');
    assert.equal((await authB.find(token)).user,'Moreno');
    assert.equal(await authB.find('invalid'),undefined);
    const attempts=await Promise.all(Array.from({length:9},()=>authA.attempt('Cahya')));
    assert.equal(attempts.filter(Boolean).length,8);
    await authB.reset('Cahya');assert.equal(await authA.attempt('Cahya'),true);
    await authB.remove(token);assert.equal(await authA.find(token),undefined);
    const s = await db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run('Moreno',3,'08:00','09:00',"L'art <script>",'','A');
    assert.equal(s.changes,1);assert.equal(s.lastInsertRowid,1);
    assert.equal((await db.prepare('SELECT * FROM schedules WHERE id=?').get(1)).course,"L'art <script>");
    assert.equal((await db.prepare('UPDATE schedules SET day=?,start=?,end=?,course=?,lecturer=?,room=? WHERE id=?').run(4,'09:00','10:00','Math','','B',1)).changes,1);
    assert.equal((await db.prepare('SELECT * FROM schedules ORDER BY day,start').all())[0].end,'10:00');
    await assert.rejects(db.prepare('INSERT INTO schedules(owner,day,start,end,course) VALUES(?,?,?,?,?)').run('Other',1,'08:00','09:00','No'));
    await assert.rejects(db.prepare('INSERT INTO schedules(owner,day,start,end,course) VALUES(?,?,?,?,?)').run('Cahya',1,'10:00','09:00','No'));
    const t=await db.prepare('INSERT INTO tasks(title,deadline,assignee,priority) VALUES(?,?,?,?)').run('Study','2026-09-24','Berdua','Tinggi');
    assert.equal(t.lastInsertRowid,1);
    await db.prepare('UPDATE tasks SET title=?,deadline=?,assignee=?,priority=?,done=? WHERE id=?').run('Study together','2026-09-25','Cahya','Sedang',1,1);
    assert.equal((await db.prepare('SELECT * FROM tasks ORDER BY done,deadline,id DESC').all())[0].done,1);
    assert.equal((await db.prepare('DELETE FROM tasks WHERE id=?').run(1)).changes,1);
    assert.equal((await db.prepare('DELETE FROM tasks WHERE id=?').run(1)).changes,0);
    assert.equal((await db.prepare('DELETE FROM schedules WHERE id=?').run(1)).changes,1);
  } finally { await db.close(); }
});
