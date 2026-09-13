import { Hono } from 'hono';
import type { Env, User } from '../types';
import { authMiddleware } from '../middleware/auth';
import { getSubdomainById, getDnsRecordById, updateDnsRecordEntry } from '../db/queries';
import {
  getActiveAccounts,
  updateDnsRecordWithAccount,
  resolveZoneIdAndTokenFromAccounts,
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
    // 获取用户的活跃 Cloudflare 账户（不再依赖全局 CF_API_TOKEN）
    const activeAccounts = await getActiveAccounts(c.env.DB, c.env, user.id);

    if (activeAccounts.length === 0) {
      return c.json({ error: '没有可用的 Cloudflare 账户，请先在账户管理中添加' }, 400);
    }

    // 从用户绑定的账户中解析 Zone ID 和对应的 token
    const resolved = await resolveZoneIdAndTokenFromAccounts(activeAccounts, subdomain.domain);
    if (!resolved) {
      return c.json({ error: `无法解析域名 ${subdomain.domain} 的 Zone ID，请检查账户权限` }, 400);
    }

    const { zoneId, token: accountToken } = resolved;

    await updateDnsRecordWithAccount(
      accountToken,
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

  const targetRecords = body.record_ids && body.record_ids.length > 0
    ? supportedRecords.filter(r => body.record_ids!.includes(r.id))
    : supportedRecords;

  if (targetRecords.length === 0) {
    return c.json({ error: '没有可操作的记录' }, 400);
  }

  try {
    // 获取用户的活跃 Cloudflare 账户
    const activeAccounts = await getActiveAccounts(c.env.DB, c.env, user.id);

    if (activeAccounts.length === 0) {
      return c.json({ error: '没有可用的 Cloudflare 账户，请先在账户管理中添加' }, 400);
    }

    // 从用户绑定的账户中解析 Zone ID 和对应的 token
    const resolved = await resolveZoneIdAndTokenFromAccounts(activeAccounts, subdomain.domain);
    if (!resolved) {
      return c.json({ error: `无法解析域名 ${subdomain.domain} 的 Zone ID，请检查账户权限` }, 400);
    }

    const { zoneId, token: accountToken } = resolved;

    let successCount = 0;
    let failCount = 0;

    for (const record of targetRecords) {
      try {
        await updateDnsRecordWithAccount(
          accountToken,
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
      } catch (err) {
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

export default proxied;
