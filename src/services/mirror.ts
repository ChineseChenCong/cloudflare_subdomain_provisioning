/**
 * mirror.ts — 写时增量推（write-through）服务
 *
 * 目标（STORAGE.md）：`没写入 → 读只走镜像、不碰 D1；一有写入 → 立即把该行增量拉到镜像，
 * 读回退才回 D1`。D1 始终为唯一写主与回退源。
 *
 * 策略：**单行 reconcile**。写函数提交 D1 后，调用方以 (表, 主键值) 触发 `mirrorSyncRow`：
 *  - 先从 D1 回读该行的权威数据（1 次 SELECT，仅在“已发生写”的情况下才发生，不违反
 *    “空闲零 D1 读”）；
 *  - 对每个启用且已配置的镜像（`DB_QUERY_ORDER` 中的 mysql / custom-sqlite）：
 *      D1 有该行 → DELETE 旧行 + INSERT 新行；D1 无该行 → DELETE 镜像旧行（清残留）。
 *  - **best-effort**：任一镜像失败只记 `[audit]`，绝不抛出、绝不阻塞写、绝不反向回写 D1。
 *
 * 一致性兜底：未覆盖/漏推/半成功的情况由 cron 全量同步（syncD1ToMirrors）周期自愈，
 * 最终一致、无数据丢失（D1 是权威）。
 *
 * 复合主键表（email_send_log 的 user_id+send_date）：mirrorSyncRow 不支持单值键，
 * 调用方应跳过或由日级 cron 对齐（写仍完全落在 D1，安全性不受影响）。
 */
import type { Env } from '../types';
import { getStorageOrder, sqliteExec, mysqlExec } from '../db/provider';

/** 各业务表主键（与迁移 0001–0007 对齐）。单列主键用于按行 reconcile。 */
const PK: Record<string, string> = {
  users: 'id',
  subdomains: 'id',
  dns_records: 'id',
  cloudflare_accounts: 'id',
  user_email_verifications: 'id',
  email_domain_whitelist: 'id',
  system_settings: 'key',
  announcements: 'id',
  friend_links: 'id',
  owner_approvals: 'id',
  email_send_log: 'user_id,send_date',
};

/** 返回启用且已配置的 SQL 镜像后端（按 DB_QUERY_ORDER 顺序）。 */
function activeMirrors(env: Env): string[] {
  return getStorageOrder(env).filter((b) => b === 'mysql' || b === 'custom-sqlite');
}

/**
 * 单行 reconcile：D1 权威行 → 推送到全部启用镜像。
 * keyVal 为单列主键值，或复合主键数组（与 PK 逗号列一一对应）。
 * 永不抛出。
 */
export async function mirrorSyncRow(
  env: Env,
  table: string,
  keyVal: unknown | unknown[]
): Promise<void> {
  const pk = PK[table];
  if (!pk) return; // 未知表：跳过，靠 cron 对齐
  const mirrors = activeMirrors(env);
  if (mirrors.length === 0) return; // 无镜像 → no-op

  const isComposite = pk.includes(',');
  if (isComposite && !Array.isArray(keyVal)) return; // 复合主键必须传数组
  if (!isComposite && Array.isArray(keyVal)) return; // 单列主键不能传数组

  let row: Record<string, unknown> | null = null;
  try {
    if (isComposite) {
      const cols = pk.split(',');
      const wheres = cols.map((c) => `"${c}" = ?`).join(' AND ');
      row = await env.DB.prepare(`SELECT * FROM "${table}" WHERE ${wheres}`)
        .bind(...(keyVal as unknown[]))
        .first<Record<string, unknown>>();
    } else {
      row = await env.DB.prepare(`SELECT * FROM "${table}" WHERE "${pk}" = ?`)
        .bind(keyVal)
        .first<Record<string, unknown>>();
    }
  } catch (err) {
    console.error(`[audit] mirrorSyncRow 读取 D1 ${table}#${pk}=${keyVal} 失败: ${(err as Error).message}`);
    return;
  }

  for (const backend of mirrors) {
    try {
      if (backend === 'mysql') await syncRowToMysql(env, table, pk, keyVal, row);
      else await syncRowToSqlite(env, table, pk, keyVal, row);
    } catch (err) {
      console.error(`[audit] mirrorSyncRow ${backend}.${table}#${keyVal} 失败: ${(err as Error).message}`);
    }
  }
}

/** MySQL：DELETE by PK（支持复合主键）+ 有行则 INSERT。 */
async function syncRowToMysql(
  env: Env,
  table: string,
  pk: string,
  keyVal: unknown | unknown[],
  row: Record<string, unknown> | null
): Promise<void> {
  const pkCols = pk.split(',');
  const where = pkCols.map((c) => `\`${c}\` = ?`).join(' AND ');
  const args = Array.isArray(keyVal) ? [...keyVal] : [keyVal];
  const del = await mysqlExec(env, `DELETE FROM \`${table}\` WHERE ${where}`, args);
  if (!del) throw new Error('DELETE 镜像行失败');
  if (!row) return;
  const cols = Object.keys(row);
  const colList = cols.map((c) => `\`${c}\``).join(',');
  const placeholders = cols.map(() => '?').join(',');
  const insertArgs = cols.map((c) => row[c]);
  const ok = await mysqlExec(env, `INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`, insertArgs);
  if (!ok) throw new Error('INSERT 镜像行失败');
}

/** 自定义 SQLite：DELETE by PK（支持复合主键）+ 有行则 INSERT（两条语句一批评次）。 */
async function syncRowToSqlite(
  env: Env,
  table: string,
  pk: string,
  keyVal: unknown | unknown[],
  row: Record<string, unknown> | null
): Promise<void> {
  const pkCols = pk.split(',');
  const where = pkCols.map((c) => `"${c}" = ?`).join(' AND ');
  const args = Array.isArray(keyVal) ? [...keyVal] : [keyVal];
  const statements: { sql: string; args: unknown[] }[] = [
    { sql: `DELETE FROM "${table}" WHERE ${where}`, args },
  ];
  if (row) {
    const cols = Object.keys(row);
    const colList = cols.map((c) => `"${c}"`).join(',');
    statements.push({
      sql: `INSERT INTO "${table}" (${colList}) VALUES (${cols.map(() => '?').join(',')})`,
      args: cols.map((c) => row[c]),
    });
  }
  const ok = await sqliteExec(env, statements);
  if (!ok) throw new Error('SQLite 镜像写失败');
}
