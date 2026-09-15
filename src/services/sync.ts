/**
 * sync.ts — D1 → 镜像后端（MySQL / 自定义 SQLite）自动同步
 *
 * 由 Worker Scheduled 处理器（cron）低频触发，离线于任何请求路径，不耗每次请求的 D1 额度。
 * 规则（对齐 STORAGE.md）：
 *  - 只推送 `DB_QUERY_ORDER` 中启用、且已配置的 MySQL / custom-sqlite 镜像；d1 本身不是镜像，跳过。
 *  - 未配置任何镜像（默认纯 D1）时本服务为 no-op，线上行为与现状完全一致。
 *  - 全表替换策略（DELETE 全部 + 重灌本次 D1 快照），表级 try/catch，单表失败不影响其余表。
 *  - 纯只读消费 D1（SELECT），写仅作用于镜像，绝不反向回写 D1。
 */
import type { Env } from '../types';
import { getStorageOrder, sqliteExec, mysqlExec } from '../db/provider';

/** 需保持 D1 / 各镜像一致的业务表全集（与迁移 0001–0007 对齐）。 */
const SYNC_TABLES = [
  'users',
  'subdomains',
  'dns_records',
  'cloudflare_accounts',
  'user_email_verifications',
  'email_domain_whitelist',
  'system_settings',
  'announcements',
  'friend_links',
  'email_send_log',
  'owner_approvals',
];

/** 从 D1 读取某表全部行。失败返回 null（整库导出任一失败则本次同步中止，不产生半桶镜像）。 */
async function readD1Table(
  env: Env,
  table: string
): Promise<{ columns: string[]; rows: unknown[][] } | null> {
  try {
    const r = await env.DB.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>();
    const results = r.results || [];
    const columns = results.length > 0 ? Object.keys(results[0]) : [];
    const rows = results.map((row) => columns.map((c) => row[c] as unknown));
    return { columns, rows };
  } catch {
    return null;
  }
}

/**
 * 全库同步：读 D1 快照 → 逐表替换到每个已配置且启用的 SQL 镜像。
 * 返回本次处理结果摘要。
 */
export async function syncD1ToMirrors(
  env: Env
): Promise<{ backends: string[]; tables: string[]; failed: string[] }> {
  const order = getStorageOrder(env);
  const actives = order.filter((b) => b === 'mysql' || b === 'custom-sqlite');
  if (actives.length === 0) return { backends: [], tables: [], failed: [] }; // 无镜像，no-op

  // 1) 读 D1 快照（全部表先读完，任一出错即中止，避免半桶镜像）
  const snap: Record<string, { columns: string[]; rows: unknown[][] }> = {};
  for (const t of SYNC_TABLES) {
    const data = await readD1Table(env, t);
    if (!data) {
      console.error(`[audit] syncD1ToMirrors: 读取 D1 表 ${t} 失败，本次同步中止`);
      return { backends: actives, tables: [], failed: [t] };
    }
    snap[t] = data;
  }

  const failed: string[] = [];
  for (const backend of actives) {
    for (const t of SYNC_TABLES) {
      const { columns, rows } = snap[t];
      const ok = backend === 'mysql' ? await replaceMysql(env, t, columns, rows) : await replaceSqlite(env, t, columns, rows);
      if (!ok) failed.push(`${backend}:${t}`);
    }
  }
  return { backends: actives, tables: SYNC_TABLES, failed };
}

/** MySQL 全表替换：DELETE 后一次性多行 INSERT（? 位置占位）。 */
async function replaceMysql(
  env: Env,
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<boolean> {
  try {
    if (!(await mysqlExec(env, `DELETE FROM \`${table}\``))) return false;
    if (rows.length === 0) return true;
    const colList = columns.map((c) => `\`${c}\``).join(',');
    const valueTuples = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const sql = `INSERT INTO \`${table}\` (${colList}) VALUES ${valueTuples}`;
    return await mysqlExec(env, sql, rows.flat());
  } catch {
    return false;
  }
}

/** 自定义 SQLite 全表替换：单条 DELETE + 每条一行 INSERT，整体一批发送（libsql HTTP）。 */
async function replaceSqlite(
  env: Env,
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<boolean> {
  try {
    const statements: { sql: string; args: unknown[] }[] = [{ sql: `DELETE FROM "${table}"`, args: [] }];
    for (const row of rows) {
      const colList = columns.map((c) => `"${c}"`).join(',');
      statements.push({ sql: `INSERT INTO "${table}" (${colList}) VALUES (${columns.map(() => '?').join(',')})`, args: row });
    }
    if (statements.length === 0) return true;
    return await sqliteExec(env, statements);
  } catch {
    return false;
  }
}
