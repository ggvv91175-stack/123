/**
 * 测试账号预置脚本（SQLite 版）
 * 用法：npm run seed:accounts（需先执行 npm run db:init）
 *
 * 预置三个账号（幂等 upsert，可重复执行）：
 *   1. admin / admin123              管理员
 *   2. 20211231245 / abc12345        学生·已认证（含一条"已通过"认证记录）
 *   3. 20211231246 / abc12345        学生·未认证
 *
 * 说明：bcrypt 哈希含随机盐，故在脚本内实时生成，保证库中零明文密码。
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// 复用后端 .env 的数据库文件配置
const envPath = path.join(__dirname, '..', '.env');
const envFile = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const dbFile = path.resolve(env.DB_FILE || './data/campus_xianyu.db');

const ACCOUNTS = [
  {
    studentNo: 'admin',
    password: 'admin123',
    nickname: '平台管理员',
    role: 'admin',
    isCertified: 1,
    college: null,
  },
  {
    studentNo: '20211231245',
    password: 'abc12345',
    nickname: '张三（已认证）',
    role: 'student',
    isCertified: 1,
    college: '计算机学院',
  },
  {
    studentNo: '20211231246',
    password: 'abc12345',
    nickname: '李四（未认证）',
    role: 'student',
    isCertified: 0,
    college: null,
  },
];

function main() {
  if (!fs.existsSync(dbFile)) {
    console.error(`[seed] 数据库文件不存在：${dbFile}，请先执行 npm run db:init`);
    process.exit(1);
  }
  const db = new Database(dbFile);
  console.log(`[seed] database: ${dbFile}`);

  const upsertUser = db.prepare(
    `INSERT INTO "user" (student_no, password_hash, nickname, college, role, status, is_certified)
     VALUES (?, ?, ?, ?, ?, '正常', ?)
     ON CONFLICT(student_no) DO UPDATE SET
       password_hash = excluded.password_hash,
       nickname      = excluded.nickname,
       college       = excluded.college,
       role          = excluded.role,
       status        = '正常',
       is_certified  = excluded.is_certified`,
  );
  const findUser = db.prepare(
    `SELECT id FROM "user" WHERE student_no = ? AND is_deleted = 0`,
  );
  const findApprovedAuth = db.prepare(
    `SELECT id FROM real_auth WHERE user_id = ? AND status = '已通过' AND is_deleted = 0 LIMIT 1`,
  );
  const insertAuth = db.prepare(
    `INSERT INTO real_auth (user_id, student_no, college, proof_images, status, reviewer_id, review_time)
     VALUES (?, ?, ?, ?, '已通过', 1, datetime('now','localtime'))`,
  );

  const runAll = db.transaction(() => {
    for (const acc of ACCOUNTS) {
      const hash = bcrypt.hashSync(acc.password, 10);
      // 学号唯一，存在则更新资料与密码哈希，不存在则插入
      upsertUser.run(acc.studentNo, hash, acc.nickname, acc.college, acc.role, acc.isCertified);
      console.log(`[seed] upsert user ${acc.studentNo} (${acc.role})`);

      // 已认证学生补一条"已通过"的认证记录（若尚无）
      if (acc.isCertified === 1 && acc.role === 'student') {
        const user = findUser.get(acc.studentNo);
        if (user && !findApprovedAuth.get(user.id)) {
          insertAuth.run(
            user.id,
            acc.studentNo,
            acc.college || '计算机学院',
            JSON.stringify(['https://example.com/proof/student-card.jpg']),
          );
          console.log(`[seed] add approved real_auth for ${acc.studentNo}`);
        }
      }
    }
  });
  runAll();

  db.close();
  console.log('[seed] done.');
}

main();
