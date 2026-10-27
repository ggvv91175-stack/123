/**
 * SQLite 建库脚本：读取 sql/init.sql 并执行（幂等，可重复执行）
 * 用法：npm run db:init
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// 复用后端 .env 的数据库文件配置
const envPath = path.join(__dirname, '..', '.env');
const envFile = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

const dbFile = path.resolve(env.DB_FILE || './data/campus_xianyu.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const sqlFile = path.join(__dirname, '..', 'sql', 'init.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

const db = new Database(dbFile);
db.exec(sql);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);
console.log(`[db:init] database: ${dbFile}`);
console.log(`[db:init] tables (${tables.length}): ${tables.join(', ')}`);
db.close();
console.log('[db:init] done.');
