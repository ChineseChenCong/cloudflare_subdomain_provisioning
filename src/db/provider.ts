/**
 * provider.ts — 存储后端路由与客户端（STORAGE.md 的实施）
 *
 * 职责：
 *  - 按 `DB_QUERY_ORDER` 选择活动查询后端：`mysql` → `custom-sqlite` → `d1`（缺省 `d1`）。
 *  - MySQL 走 Cloudflare Hyperdrive binding（Worker 无法原生 TCP，Hyperdrive 提供连接池与
 *    内网安全通道），运行时动态加载 `mysql2`；未安装/连不上时自动回退下一后端。
 *  - 提供「自定义 SQLite（Turso/libsql over HTTP）」只读查询客户端。
 *  - 提供「S3 / R2 兼容」SigV4 客户端（PUT/GET），用于**整库快照灾备**（S3 不是 SQL 库，不做实时查询）。
 *  - D1 仍为缺省与最终兜底。
 *
 * 设计约束（与 STORAGE.md 一致）：
 *  - 缺省/未配置时行为 == 现状（纯 D1），不回退、不改变任何线上行为。
 *  - 回退只读，不做破坏性写；绝不双写制造不一致。
 *  - 全量快照低频执行（手动/定时，非每请求），避免浪费 D1 读额度。
 *
 * 注：本文件为自洽模块（tsc 通过、默认关闭）。逐查询改造（把 queries.ts 的
 * DB 入口统一走 provider 的读回退链）按 STORAGE.md 规划作为**独立 commit** 实施，
 * 以便单独 `tsc` + `deploy --dry-run` 验证后再上线。
 */
import type { Env } from '../types';

export type StorageBackend = 'mysql' | 'custom-sqlite' | 'd1';

/** 解析 DB_QUERY_ORDER 为规范化后端列表（仅保留合法项；空/缺省视作 d1） */
export function getStorageOrder(env: Env): StorageBackend[] {
  const raw = (env.DB_QUERY_ORDER || 'd1').trim();
  if (!raw) return ['d1'];
  const seen: StorageBackend[] = [];
  for (const tok of raw.split(',')) {
    const t = tok.trim().toLowerCase();
    if ((t === 'mysql' || t === 'custom-sqlite' || t === 'd1') && !seen.includes(t)) seen.push(t);
  }
  if (seen.length === 0) return ['d1'];
  return seen;
}

/** MySQL（Hyperdrive）是否已配置（Hyperdrive 连接串非空） */
export function isMysqlConfigured(env: Env): boolean {
  return !!(env.HYPERDRIVE?.connectionString);
}

/** 是否等于「未启用任何扩展后端」——此时一切走 D1，与现状完全等价 */
export function isStorageDefault(env: Env): boolean {
  const o = getStorageOrder(env);
  return o.length === 1 && o[0] === 'd1';
}

/** 自定义 SQLite 是否已配置（URL 非空） */
export function isCustomSqliteConfigured(env: Env): boolean {
  return !!(env.CUSTOM_SQLITE_URL && env.CUSTOM_SQLITE_URL.trim());
}

/** S3/R2 快照是否已配置（桶名非空） */
export function isS3SnapshotConfigured(env: Env): boolean {
  return !!(env.S3_BACKUP_BUCKET && env.S3_BACKUP_BUCKET.trim());
}

/** 后端健康探测（轻量只读，不耗额度） */
export async function storageHealthCheck(env: Env, backend: StorageBackend): Promise<boolean> {
  try {
    if (backend === 'mysql') {
      if (!isMysqlConfigured(env)) return false;
      const rows = await mysqlSelect(env, 'SELECT 1 AS ok', []);
      return Array.isArray(rows) && rows.length > 0;
    }
    if (backend === 'custom-sqlite') {
      if (!isCustomSqliteConfigured(env)) return false;
      const rows = await sqliteSelect(env, 'SELECT 1 AS ok', []);
      return Array.isArray(rows) && rows.length > 0;
    }
    // d1
    const r = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return r != null;
  } catch {
    return false;
  }
}

/** 选择第一个健康的活动后端（按 DB_QUERY_ORDER）；全都不健康则回退 d1 兜底 */
export async function pickHealthyBackend(env: Env): Promise<{ backend: StorageBackend; healthy: boolean }> {
  const order = getStorageOrder(env);
  for (const b of order) {
    if (await storageHealthCheck(env, b)) return { backend: b, healthy: true };
  }
  return { backend: 'd1', healthy: false };
}

/**
 * MySQL（经 Cloudflare Hyperdrive 连接池）只读查询。
 * Worker 无法原生建立 TCP 连接，MySQL 需通过 Hyperdrive binding（`env.HYPERDRIVE.connectionString`，
 * 形如 `mysql://user:pass@host:port/db`）提供连接池与内网安全通道。
 * 运行时用**非字面量动态 import** 加载 `mysql2`：未安装该依赖或连接失败时捕获并返回 null（自动回退下一后端），
 * 因此 tsc 不依赖 `mysql2` 是否已安装；部署启用 MySQL 时需安装 mysql2 并配置 Hyperdrive（见 STORAGE.md）。
 * 参数：args 为位置参数数组（MySQL 的 `?` 占位与 D1/libsql 的 `?` 一致，可直接复用）。
 */
export async function mysqlSelect(env: Env, sql: string, args: unknown[]): Promise<unknown[] | null> {
  if (!isMysqlConfigured(env)) return null;
  try {
    const spec = 'mysql2/promise'; // 非字面量 → 不做静态解析，缺失不阻塞 tsc
    const mysql2: any = await (import(spec as string));
    const conn = await mysql2.createConnection(env.HYPERDRIVE!.connectionString);
    try {
      const [rows] = await conn.query(sql, args);
      return Array.isArray(rows) ? (rows as unknown[]) : null;
    } finally {
      await conn.end().catch(() => {});
    }
  } catch {
    return null;
  }
}

/**
 * 自定义 SQLite（Turso/libsql over HTTP）只读查询。
 * 采用 libsql HTTP 接口：POST `<url>`，Body `{"statements":[{"sql":...,"args":[...]}]}`，
 * `Authorization: Bearer <TOKEN>`。返回行数组；失败/未配置返回 null（由调用方回退）。
 * 参数：args 为位置参数数组（libsql 用 `?1..?n` 或按实现支持的位置占位）。
 */
export async function sqliteSelect(
  env: Env,
  sql: string,
  args: unknown[]
): Promise<unknown[] | null> {
  if (!isCustomSqliteConfigured(env)) return null;
  const url = env.CUSTOM_SQLITE_URL!.trim();
  const token = env.CUSTOM_SQLITE_TOKEN || env.CUSTOM_SQLITE_JWT || '';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        statements: [{ sql, args }],
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    // libsql HTTP 返回形如 [{ results:{ columns:[...], rows:[...] } }]
    const res = Array.isArray(data) ? data[0]?.results : data?.results;
    if (!res?.rows) return null;
    const cols: string[] = res.columns;
    return res.rows.map((r: unknown[]) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  } catch {
    return null;
  }
}

// ==================== S3 / R2（SigV4）客户端 ====================
// 仅用于整库快照的 PUT 与恢复的 GET。AWS Signature V4；兼容 R2 与大多数 S3 兼容服务。

function toAmzDate(d: Date): { x: string; short: string } {
  const iso = d.toISOString();
  return {
    x: iso.replace(/[:-]|\.\d{3}/g, ''),
    short: iso.slice(0, 10).replace(/-/g, ''),
  };
}

function hexEncode(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: string | ArrayBuffer | Uint8Array, data: string): Promise<Uint8Array> {
  const keyBuf: ArrayBuffer | Uint8Array =
    typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function sha256(data: string | ArrayBuffer): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return hexEncode(await crypto.subtle.digest('SHA-256', buf));
}

async function signingKey(secret: string, dateShort: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmac(`AWS4${secret}`, dateShort);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

/** 发起一次带 SigV4 签名的 S3 请求。返回 Response（非 2xx 时调用方自行处理）。 */
export async function s3Request(
  env: Env,
  method: 'PUT' | 'GET' | 'DELETE',
  key: string,
  body?: ArrayBuffer | string | null
): Promise<Response> {
  const bucket = env.S3_BACKUP_BUCKET;
  if (!bucket) throw new Error('S3_BACKUP_BUCKET 未配置');
  const access = env.S3_ACCESS_KEY || '';
  const secret = env.S3_SECRET_KEY || '';
  const region = env.S3_REGION || 'auto';
  const endpoint = (env.S3_ENDPOINT || '').trim();
  const pathStyle = (env.S3_USE_PATH_STYLE || '').trim().toLowerCase() === 'true';
  const now = new Date();
  const { x: xAmzDate, short: dateShort } = toAmzDate(now);

  // 构造 URL：endpoint 缺省时用 AWS 标准 `https://{bucket}.s3.{region}.amazonaws.com`
  let host: string;
  let canonicalPath: string;
  if (endpoint) {
    const u = new URL(endpoint.endsWith('/') ? endpoint : endpoint + '/');
    if (pathStyle) {
      host = u.host;
      canonicalPath = `/${bucket}/${key}`;
    } else {
      host = `${bucket}.${u.host}`;
      canonicalPath = `/${key}`;
    }
  } else {
    host = `${bucket}.s3.${region}.amazonaws.com`;
    canonicalPath = `/${key}`;
  }
  const payload = body ? await sha256(typeof body === 'string' ? body : body) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payload}\n` + `x-amz-date:${xAmzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `${method}\n${canonicalPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${payload}`;
  const scope = `${dateShort}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${xAmzDate}\n${scope}\n${await sha256(canonicalRequest)}`;
  const keyMaterial = await signingKey(secret, dateShort, region, 's3');
  const signature = hexEncode(await hmac(keyMaterial, stringToSign));
  const auth = `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const scheme = endpoint && new URL(endpoint).protocol ? new URL(endpoint).protocol : 'https:';
  const url = `${scheme}//${host}${canonicalPath}`;
  return fetch(url, {
    method,
    headers: {
      host,
      'x-amz-date': xAmzDate,
      'x-amz-content-sha256': payload,
      authorization: auth,
      ...(body ? { 'content-type': 'application/octet-stream' } : {}),
    },
    body: body as BodyInit | null,
  });
}

/**
 * 整库快照上传到 S3（灾备副本）。入参为「已序列化的整库数据」。
 * 低频调用（手动/定时），不要把整库 dump 放进每次请求，否则会耗 D1 读额度。
 * 成功后记录快照时间（返回布尔）。
 */
export async function uploadSnapshotToS3(
  env: Env,
  snapshotJson: string,
  snapshotKey: string
): Promise<boolean> {
  if (!isS3SnapshotConfigured(env)) return false;
  const resp = await s3Request(env, 'PUT', snapshotKey, snapshotJson);
  return resp.ok;
}

/** 从 S3 读取指定快照（用于恢复校验）。 */
export async function downloadSnapshotFromS3(env: Env, snapshotKey: string): Promise<string | null> {
  if (!isS3SnapshotConfigured(env)) return null;
  const resp = await s3Request(env, 'GET', snapshotKey);
  if (!resp.ok) return null;
  return resp.text();
}

/** 从 D1 导出整库为 JSON 快照（仅供低频备份；会读 D1，注意额度）。返回 JSON 字符串或 null。 */
export async function exportD1Snapshot(env: Env): Promise<string | null> {
  const tables = ['users', 'subdomains', 'dns_records', 'cloudflare_accounts', 'announcements', 'friend_links', 'system_settings', 'owner_approvals', 'user_email_verifications', 'email_send_log'];
  const out: Record<string, unknown[]> = {};
  try {
    for (const t of tables) {
      const r = await env.DB.prepare(`SELECT * FROM ${t}`).all<Record<string, unknown>>();
      out[t] = r.results || [];
    }
  } catch (err) {
    console.error(`[audit] exportD1Snapshot failed: ${(err as Error).message}`);
    return null;
  }
  return JSON.stringify({ exported_at: new Date().toISOString(), tables: out });
}

/**
 * libsql HTTP 批量写执行（镜像同步写入用）。
 * 与 sqliteSelect 同一 HTTP 端点，POST `{"statements":[...]}`，每项 `{sql, args}`。
 * 成功（HTTP 2xx）返回 true；未配置/失败返回 false。
 */
export async function sqliteExec(
  env: Env,
  statements: { sql: string; args?: unknown[] }[]
): Promise<boolean> {
  if (!isCustomSqliteConfigured(env) || statements.length === 0) return false;
  const url = env.CUSTOM_SQLITE_URL!.trim();
  const token = env.CUSTOM_SQLITE_TOKEN || env.CUSTOM_SQLITE_JWT || '';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ statements }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * MySQL（Hyperdrive）写执行（镜像同步写入用）。`?` 位置占位，arg 数组。
 * 失败/未配置返回 false；默认单条（无事务）。
 */
export async function mysqlExec(env: Env, sql: string, args: unknown[] = []): Promise<boolean> {
  if (!isMysqlConfigured(env)) return false;
  try {
    const spec = 'mysql2/promise'; // 非字面量 → 不做静态解析，缺失不阻塞 tsc
    const mysql2: any = await (import(spec as string));
    const conn = await mysql2.createConnection(env.HYPERDRIVE!.connectionString);
    try {
      await conn.query(sql, args);
      return true;
    } finally {
      await conn.end().catch(() => {});
    }
  } catch {
    return false;
  }
}
