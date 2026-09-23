import { createHash, randomBytes } from 'node:crypto';

const hash = token => createHash('sha256').update(token || '').digest('hex');
export function createAuth(db) {
  return {
    async attempt(user, now = Date.now()) {
      const row = await db.prepare(`INSERT INTO login_attempts(user_name,count,expires) VALUES(?,1,?)
        ON CONFLICT(user_name) DO UPDATE SET
        count=CASE WHEN login_attempts.expires<=? THEN 1 ELSE login_attempts.count+1 END,
        expires=CASE WHEN login_attempts.expires<=? THEN ? ELSE login_attempts.expires END
        RETURNING count`).get(user,now+300000,now,now,now+300000);
      return row.count <= 8;
    },
    reset: user => db.prepare('DELETE FROM login_attempts WHERE user_name=?').run(user),
    async create(user) {
      const token = randomBytes(32).toString('hex');
      await db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
      await db.prepare('INSERT INTO sessions(token_hash,user_name,expires) VALUES(?,?,?)').run(hash(token),user,Date.now()+86400000);
      return token;
    },
    async find(token) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
      const row = await db.prepare('SELECT user_name,expires FROM sessions WHERE token_hash=?').get(hash(token));
      return row && row.expires>Date.now() ? {user:row.user_name} : undefined;
    },
    remove: token => db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)),
  };
}
