import { Hono } from 'hono';
import type { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';
import { getSubdomainById, getDnsRecordById, updateDnsRecordEntry } from '../db/queries';
import {
  getDefaultAccount,
  getActiveAccounts,
  updateDnsRecordWithAccount,
} from '../services/cloudflare-accounts';

type Variables = { user: User };

const proxied = new Hono<{ Bindings: Env; Variables: Variables }>();

proxied.use('/*', authMiddleware);

// 切换 DNS 记录的代理状态
proxied.put('/records/:recordId/proxied', async (c) => {
  const user = c.get('user');
  const recordId = parseInt(c.req.param('recordId'), 10);
  const body = await c.req.json<{ proxied: boolean }>();

  if (typeof body.proxied !== 'boolean') {
    return c.json({ error: '请提供 proxied 状态' }, 400);
  }

  // 获取 DNS 记录
  const record = await getDnsRecordById(c.env.DB, recordId);
  if (!record) {
    return c.json({ error: 'DNS 记录不存在' }, 404);
  }

  // 获取子域名
  const subdomain = await getSubdomainById(c.env.DB, record.subdomain_id);
  if (!subdomain) {
    return c.json({ error: '子域名不存在' }, 404);
  }

  // 权限检查
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: '无权操作此 DNS 记录' }, 403);
  }

  // 检查子域名状态
  if (subdomain.status !== 'approved') {
    return c.json({ error: '子域名尚未通过审核' }, 403);
  }

  // 检查记录类型是否支持代理
  if (!['A', 'AAAA', 'CNAME'].includes(record.record_type)) {
    return c.json({ error: '仅 A、AAAA、CNAME 记录支持代理开关' }, 400);
  }

  try {
    // 获取 Cloudflare 账户
    const activeAccounts = await getActiveAccounts(c.env.DB, user.id);

    if (activeAccounts.length === 0) {
      return c.json({ error: '没有可用的 Cloudflare 账户' }, 400);
    }

    // 尝试使用活跃账户更新
    let lastError: Error | null = null;

    for (const { token } of activeAccounts) {
      try {
        const zoneId = await getZoneIdForDomain(token, subdomain.domain);
        if (!zoneId) {
          continue;
        }

        await updateDnsRecordWithAccount(
          token,
          zoneId,
          record.cf_record_id,
          {
            type: record.record_type,
            name: record.name,
            content: record.content,
            ttl: record.ttl,
            priority: record.priority ?? undefined,
            proxied: body.proxied,
          }
        );

        // 更新本地数据库
        await updateDnsRecordEntry(
          c.env.DB,
          record.id,
          record.cf_record_id,
          record.record_type,
          record.name,
          record.content,
          record.ttl,
          record.priority,
          body.proxied,
          record.comment
        );

        return c.json({
          success: true,
          proxied: body.proxied,
          message: body.proxied ? '已开启代理（黄色云朵）' : '已关闭代理（灰色云朵）',
        });
      } catch (err) {
        lastError = err as Error;
        continue;
      }
    }

    throw lastError || new Error('更新失败');
  } catch (err: any) {
    return c.json({ error: `切换代理状态失败: ${err.message}` }, 500);
  }
});

// 批量切换 DNS 记录的代理状态
proxied.put('/subdomains/:subdomainId/records/proxied', async (c) => {
  const user = c.get('user');
  const subdomainId = parseInt(c.req.param('subdomainId'), 10);
  const body = await c.req.json<{ proxied: boolean; record_ids?: number[] }>();

  if (typeof body.proxied !== 'boolean') {
    return c.json({ error: '请提供 proxied 状态' }, 400);
  }

  // 获取子域名
  const subdomain = await getSubdomainById(c.env.DB, subdomainId);
  if (!subdomain) {
    return c.json({ error: '子域名不存在' }, 404);
  }

  // 权限检查
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: '无权操作此子域名' }, 403);
  }

  // 检查子域名状态
  if (subdomain.status !== 'approved') {
    return c.json({ error: '子域名尚未通过审核' }, 403);
  }

  // 获取所有 DNS 记录
  const { getSubdomainRecords, updateDnsRecordEntry } = await import('../db/queries');
  const records = await getSubdomainRecords(c.env.DB, subdomainId);

  // 筛选支持代理的记录
  const supportedRecords = records.filter(r => ['A', 'AAAA', 'CNAME'].includes(r.record_type));

  if (body.record_ids && body.record_ids.length > 0) {
    const targetRecords = supportedRecords.filter(r => body.record_ids!.includes(r.id));
    if (targetRecords.length === 0) {
      return c.json({ error: '没有找到可操作的记录' }, 400);
    }
  }

  const targetRecords = body.record_ids && body.record_ids.length > 0
    ? supportedRecords.filter(r => body.record_ids!.includes(r.id))
    : supportedRecords;

  if (targetRecords.length === 0) {
    return c.json({ error: '没有可操作的记录' }, 400);
  }

  try {
    // 获取 Cloudflare 账户
    const activeAccounts = await getActiveAccounts(c.env.DB, user.id);

    if (activeAccounts.length === 0) {
      return c.json({ error: '没有可用的 Cloudflare 账户' }, 400);
    }

    let successCount = 0;
    let failCount = 0;

    for (const record of targetRecords) {
      let updated = false;

      for (const { token } of activeAccounts) {
        try {
          const zoneId = await getZoneIdForDomain(token, subdomain.domain);
          if (!zoneId) {
            continue;
          }

          await updateDnsRecordWithAccount(
            token,
            zoneId,
            record.cf_record_id,
            {
              type: record.record_type,
              name: record.name,
              content: record.content,
              ttl: record.ttl,
              priority: record.priority ?? undefined,
              proxied: body.proxied,
            }
          );

          await updateDnsRecordEntry(
            c.env.DB,
            record.id,
            record.cf_record_id,
            record.record_type,
            record.name,
            record.content,
            record.ttl,
            record.priority,
            body.proxied,
            record.comment
          );

          successCount++;
          updated = true;
          break;
        } catch (err) {
          continue;
        }
      }

      if (!updated) {
        failCount++;
      }
    }

    return c.json({
      success: true,
      success_count: successCount,
      fail_count: failCount,
      message: `成功更新 ${successCount} 条记录${failCount > 0 ? `，${failCount} 条失败` : ''}`,
    });
  } catch (err: any) {
    return c.json({ error: `批量切换失败: ${err.message}` }, 500);
  }
});

async function getZoneIdForDomain(apiToken: string, domain: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}&status=active`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = (await response.json()) as {
      success: boolean;
      result: Array<{ id: string; name: string }>;
    };

    if (data.success && data.result.length > 0) {
      return data.result[0].id;
    }
  } catch (err) {
    console.error(`Failed to resolve zone ID for ${domain}:`, err);
  }

  return null;
}

export default proxied;
