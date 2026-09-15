import type { DnsRecordInput } from '../types';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

interface CfApiResponse<T = unknown> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

export interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  priority?: number;
  proxied: boolean;
  comment?: string;
}

function headers(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

export async function createDnsRecord(
  apiToken: string,
  zoneId: string,
  record: DnsRecordInput & { fullName?: string }
): Promise<CfDnsRecord> {
  const body: Record<string, unknown> = {
    type: record.type,
    name: record.fullName || record.name,
    content: record.content,
    ttl: record.ttl || 1,
    proxied: record.proxied ?? false,
  };

  if (record.priority !== undefined) {
    body.priority = record.priority;
  }
  if (record.comment) {
    body.comment = record.comment;
  }

  const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: headers(apiToken),
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as CfApiResponse<CfDnsRecord>;
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(', ')}`);
  }
  return data.result;
}

export async function updateDnsRecord(
  apiToken: string,
  zoneId: string,
  recordId: string,
  record: DnsRecordInput & { fullName?: string }
): Promise<CfDnsRecord> {
  const body: Record<string, unknown> = {
    type: record.type,
    name: record.fullName || record.name,
    content: record.content,
    ttl: record.ttl || 1,
    proxied: record.proxied ?? false,
  };

  if (record.priority !== undefined) {
    body.priority = record.priority;
  }
  if (record.comment) {
    body.comment = record.comment;
  }

  const response = await fetch(
    `${CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: 'PUT',
      headers: headers(apiToken),
      body: JSON.stringify(body),
    }
  );

  const data = (await response.json()) as CfApiResponse<CfDnsRecord>;
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(', ')}`);
  }
  return data.result;
}

export async function deleteDnsRecord(
  apiToken: string,
  zoneId: string,
  recordId: string
): Promise<void> {
  const response = await fetch(
    `${CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: 'DELETE',
      headers: headers(apiToken),
    }
  );

  const data = (await response.json()) as CfApiResponse;
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(', ')}`);
  }
}

export async function listDnsRecords(
  apiToken: string,
  zoneId: string,
  nameFilter?: string
): Promise<CfDnsRecord[]> {
  const params = new URLSearchParams({ per_page: '100' });
  if (nameFilter) {
    params.set('name', nameFilter);
  }

  const response = await fetch(
    `${CF_API_BASE}/zones/${zoneId}/dns_records?${params.toString()}`,
    {
      method: 'GET',
      headers: headers(apiToken),
    }
  );

  const data = (await response.json()) as CfApiResponse<CfDnsRecord[]>;
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(', ')}`);
  }
  return data.result;
}

/**
 * 分页拉取某 Zone 下全部 DNS 记录（CF API 每页最多 100 条）。
 * 用于「DNS 实时读取」：当需要某个子域名下的完整记录集时，拉全量后在代码内按
 * 名称前缀过滤，避免依赖 CF `name` 参数的不精确匹配。设置了页数安全上限防止异常死循环。
 */
export async function listAllZoneRecords(
  apiToken: string,
  zoneId: string
): Promise<CfDnsRecord[]> {
  const all: CfDnsRecord[] = [];
  let page = 1;
  const MAX_PAGES = 20; // 安全上限，最多 2000 条
  for (;;) {
    const params = new URLSearchParams({ per_page: '100', page: String(page) });
    const response = await fetch(
      `${CF_API_BASE}/zones/${zoneId}/dns_records?${params.toString()}`,
      {
        method: 'GET',
        headers: headers(apiToken),
      }
    );
    const data = (await response.json()) as CfApiResponse<CfDnsRecord[]>;
    if (!data.success) {
      throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(', ')}`);
    }
    const batch = data.result || [];
    all.push(...batch);
    if (batch.length < 100 || page >= MAX_PAGES) {
      break;
    }
    page += 1;
  }
  return all;
}

/**
 * 判断某个 FQDN（及其子记录）是否已在 Cloudflare 存在解析配置。
 * 范围精确到「名称 == FQDN 或 以 .FQDN 结尾」，不会误判其它子域名。
 */
export async function hasDnsRecordsForFqdn(
  apiToken: string,
  zoneId: string,
  fqdn: string
): Promise<boolean> {
  const records = await listAllZoneRecords(apiToken, zoneId);
  const prefix = fqdn + '.';
  return records.some((r) => r.name === fqdn || r.name.endsWith(prefix));
}

/**
 * 删除某 FQDN 下所有 DNS 记录（范围精确，只删「==FQDN 或以 .FQDN 结尾」的记录），
 * 返回删除条数。用于回收子域名时确保 DNS 解析不再残留，同时绝不误删其它项目记录。
 */
export async function deleteDnsRecordsByFqdn(
  apiToken: string,
  zoneId: string,
  fqdn: string
): Promise<number> {
  const records = await listAllZoneRecords(apiToken, zoneId);
  const prefix = fqdn + '.';
  const mine = records.filter((r) => r.name === fqdn || r.name.endsWith(prefix));
  let deleted = 0;
  for (const r of mine) {
    await deleteDnsRecord(apiToken, zoneId, r.id);
    deleted += 1;
  }
  return deleted;
}

/** 验证 API Token 是否有效 */
export async function verifyToken(apiToken: string): Promise<boolean> {
  const response = await fetch(`${CF_API_BASE}/user/tokens/verify`, {
    headers: headers(apiToken),
  });
  const data = (await response.json()) as CfApiResponse<{ status: string }>;
  return data.success && data.result.status === 'active';
}
