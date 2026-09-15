import { Hono } from "hono";
import type { Context } from "hono";
import type { Env, User, DnsRecordInput } from "../types";
import { ALLOWED_RECORD_TYPES as RECORD_TYPES } from "../types";
import {
  authMiddleware,
  emailVerifiedMiddleware,
  adminMiddleware,
} from "../middleware/auth";
import {
  getDomainNames,
  getBannedPrefixes,
  getMaxSubdomains,
  getMaxRecords,
  getZoneIdForDomain,
  isDnsLiveRead,
  getOwnerApprovalDeadlineHours,
} from "../config";
import {
  getUserSubdomains,
  getSubdomainById,
  findSubdomain,
  countUserSubdomains,
  createSubdomain,
  deleteSubdomain,
  getSubdomainRecords,
  countSubdomainRecords,
  createDnsRecordEntry,
  getDnsRecordById,
  getDnsRecordByCfId,
  updateDnsRecordEntry,
  deleteDnsRecordEntry,
  deleteAllRecordsForSubdomain,
  getAllSubdomains,
  getAllUsers,
  approveSubdomain,
  rejectSubdomain,
  getPendingSubdomains,
  findUserById,
  createOwnerApproval,
  getPendingApprovalByTarget,
  findApprovedOwnedAncestor,
  enumerateAncestorFqdns,
  getOwnerApprovalById,
  getOwnerApprovalsByApplicant,
  getOwnerApprovalsByApprover,
  getApprovalsByTargetFqdn,
  setOwnerApprovalStatus,
} from "../db/queries";
import { mirrorSyncRow } from "../services/mirror";
import {
  approveOwnerApproval,
  rejectOwnerApproval,
  expireOwnerApproval,
  isOwnerApprovalExpired,
} from "../services/owner-approval";
import {
  createDnsRecord as cfCreateDnsRecord,
  updateDnsRecord as cfUpdateDnsRecord,
  deleteDnsRecord as cfDeleteDnsRecord,
  listAllZoneRecords as cfListAllZoneRecords,
  hasDnsRecordsForFqdn as cfHasDnsRecordsForFqdn,
  deleteDnsRecordsByFqdn as cfDeleteDnsRecordsByFqdn,
} from "../services/cloudflare";
import {
  getActiveAccounts,
  resolveZoneIdAndTokenFromAccounts,
} from "../services/cloudflare-accounts";
import {
  sendEmail,
  buildApprovalEmail,
  buildRejectionEmail,
  buildNewRequestNotifyEmail,
  buildDeletionNoticeEmail,
  buildUserDeletedAdminEmail,
  buildOwnerApprovalRequestEmail,
  buildApprovedSubdomainRemovedToApproverEmail,
} from "../services/email";

type Variables = { user: User };

const api = new Hono<{ Bindings: Env; Variables: Variables }>();

// 所有 API 路由需要认证
api.use("/*", authMiddleware, emailVerifiedMiddleware);

// 从用户绑定的多账户解析目标域名的 Zone ID 与对应 token（多账户支持）
async function resolveCfAccount(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  domain: string,
): Promise<{ zoneId: string; token: string; error?: string }> {
  const user = c.get("user");
  const activeAccounts = await getActiveAccounts(c.env.DB, c.env, user.id);
  if (activeAccounts.length === 0) {
    return {
      zoneId: "",
      token: "",
      error: "没有可用的 Cloudflare 账户，请先在账户管理中添加",
    };
  }
  const resolved = await resolveZoneIdAndTokenFromAccounts(
    activeAccounts,
    domain,
  );
  if (!resolved) {
    return { zoneId: "", token: "", error: "域名配置错误，无法获取 Zone ID" };
  }
  return resolved;
}

// ==================== 用户信息 ====================

api.get("/me", (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    github_username: user.github_username,
    avatar_url: user.avatar_url,
    email: user.email,
    is_admin: !!user.is_admin,
    created_at: user.created_at,
  });
});

// ==================== 域名列表 ====================

api.get("/domains", (c) => {
  const domains = getDomainNames(c.env);
  return c.json({
    domains,
    max_subdomains: getMaxSubdomains(c.env),
    max_records: getMaxRecords(c.env),
    banned_prefixes: getBannedPrefixes(c.env),
    allowed_record_types: RECORD_TYPES,
  });
});

// ==================== 子域名管理 ====================

// 获取用户的子域名列表
api.get("/subdomains", async (c) => {
  const user = c.get("user");
  const subdomains = await getUserSubdomains(c.env, user.id);
  return c.json({ subdomains });
});

// 注册新子域名（提交审核）
api.post("/subdomains", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ subdomain: string; domain: string }>();

  const { subdomain, domain } = body;

  if (!subdomain || !domain) {
    return c.json({ error: "请提供子域名和域名" }, 400);
  }

  // 验证域名是否在可用列表中
  const domainNames = getDomainNames(c.env);
  if (!domainNames.includes(domain.toLowerCase())) {
    return c.json({ error: "该域名不可用" }, 400);
  }

  // 验证子域名格式
  const subdomainLower = subdomain.toLowerCase().trim();
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(subdomainLower)) {
    return c.json(
      {
        error:
          "子域名格式无效，仅允许小写字母、数字和连字符，且不能以连字符开头或结尾",
      },
      400,
    );
  }

  if (subdomainLower.length < 2) {
    return c.json({ error: "子域名长度至少为 2 个字符" }, 400);
  }

  // 检查是否为禁止的前缀
  const bannedPrefixes = getBannedPrefixes(c.env);
  if (bannedPrefixes.includes(subdomainLower)) {
    return c.json({ error: "该子域名前缀已被禁止使用" }, 400);
  }

  // 检查用户配额（pending + approved 计数）
  const currentCount = await countUserSubdomains(c.env, user.id);
  const maxSubs = getMaxSubdomains(c.env);
  if (currentCount >= maxSubs) {
    return c.json({ error: `您已达到子域名数量上限 (${maxSubs})` }, 400);
  }

  // 检查子域名是否已被占用（本系统数据库）
  const existing = await findSubdomain(c.env, subdomainLower, domain);
  if (existing) {
    return c.json({ error: "该子域名已被注册" }, 409);
  }

  // —— 递归占用拦截 + 上级所有权审批 ——
  const fqdn = `${subdomainLower}.${domain}`;
  // 目标 fqdn 的所有“真祖先”（不含自身）。例：d.c.b.example.org → [b.example.org, c.b.example.org]
  const ancestors = enumerateAncestorFqdns(fqdn, domain);

  // 占用拦截（递归）：目标 fqdn 及其每一级祖先整条链上，任一层在 CF 已有解析配置
  // → 该链之下的任意深度都不允许再申请（保护既有的层级使用权，逐级类推）。
  // CF 查询失败则回退仅按 DB 判断。
  try {
    const acc = await resolveCfAccount(c, domain);
    if (!acc.error) {
      const chain = [fqdn, ...ancestors];
      for (const cand of chain) {
        if (await cfHasDnsRecordsForFqdn(acc.token, acc.zoneId, cand)) {
          return c.json(
            {
              error: `子域名链 ${cand} 名下已存在 DNS 解析配置（该层或更上层已被占用），不允许在其下申请`,
              code: "occupied-chain",
            },
            409,
          );
        }
      }
    }
  } catch (err) {
    console.error(
      `[audit] CF DNS occupation check failed: ${(err as Error).message}`,
    );
  }

  // 上级所有权审批：目标子域名存在“被拥有的真祖先”（某层已被批准），且该祖先不属于申请人本人
  // → 由最近被拥有的祖先的所有者审批（邮件含同意/驳回按钮，超时自动驳回），通过后才正式建立。
  // 若最近被拥有的祖先即申请人本人所有（即“拥有二级域名者可申请其下三级”）→ 无需外部同意，走正常流程。
  if (ancestors.length > 0) {
    const ownerAnc = await findApprovedOwnedAncestor(c.env, ancestors);
    if (ownerAnc && ownerAnc.user_id !== user.id) {
      // 幂等：同一目标 fqdn 已有待审批申请时直接提示，不重复发邮件
      const existing = await getPendingApprovalByTarget(c.env, fqdn);
      if (existing) {
        return c.json(
          {
            error: `该子域名使用权归 ${ownerAnc.subdomain}.${ownerAnc.domain} 所有者所有，审批请求已发送，请等待其处理`,
            code: "pending-owner-approval",
          },
          409,
        );
      }
      const owner = await findUserById(c.env, ownerAnc.user_id);
      const token =
        crypto.randomUUID().replace(/-/g, "") +
        crypto.randomUUID().replace(/-/g, "");
      const hours = getOwnerApprovalDeadlineHours(c.env);
      const deadline = new Date(Date.now() + hours * 3600_000).toISOString();
      const approval = await createOwnerApproval(c.env, {
        targetFqdn: fqdn,
        baseFqdn: `${ownerAnc.subdomain}.${ownerAnc.domain}`,
        approverUserId: ownerAnc.user_id,
        applicantUserId: user.id,
        token,
        deadlineAt: deadline,
      });
      // write-through：镜像侧新增该审批行（best-effort，失败静默，日级 cron 回补）
      await mirrorSyncRow(c.env, "owner_approvals", approval.id).catch(
        () => {},
      );

      if (owner?.email) {
        const url = new URL(c.req.url);
        const siteName = c.env.SITE_NAME || "Sub Domain Hub";
        const approveUrl = `${url.origin}/decide-approval?token=${token}&action=approve`;
        const rejectUrl = `${url.origin}/decide-approval?token=${token}&action=reject`;
        const mail = buildOwnerApprovalRequestEmail(
          owner.github_username,
          user.github_username,
          fqdn,
          `${ownerAnc.subdomain}.${ownerAnc.domain}`,
          approveUrl,
          rejectUrl,
          hours,
          siteName,
          url.origin,
        );
        mail.to = owner.email;
        await sendEmail(c.env, mail).catch(() => {});
      }
      return c.json(
        {
          message: `该子域名使用权归 ${ownerAnc.subdomain}.${ownerAnc.domain} 所有者所有，需其同意；审批请求已发送，${hours} 小时内未处理将自动驳回`,
          code: "owner-approval-requested",
        },
        201,
      );
    }
  }

  // 无上级所有者（或申请人本人即上层所有者）→ 直接创建子域名（状态为 pending，走管理员审核）
  const newSubdomain = await createSubdomain(
    c.env,
    user.id,
    subdomainLower,
    domain,
  );

  // write-through：该行增量推到镜像（best-effort，失败静默，由日级 cron 回补）
  await mirrorSyncRow(c.env, "subdomains", newSubdomain.id).catch(() => {});

  // 尝试通知管理员
  try {
    const url = new URL(c.req.url);
    const siteName = c.env.SITE_NAME || "SubDomain Hub";
    const notifyEmail = buildNewRequestNotifyEmail(
      user.github_username,
      subdomainLower,
      domain,
      siteName,
      url.origin,
    );
    const adminList = await getAllUsers(c.env);
    // 优先发给已绑定邮箱的管理员
    const adminsWithEmail = adminList.filter((u) => u.is_admin && u.email);
    for (const admin of adminsWithEmail) {
      notifyEmail.to = admin.email!;
      await sendEmail(c.env, notifyEmail).catch(() => {});
    }
    // 若没有带邮箱的管理员，回退发送到配置的联系邮箱，确保通知必达
    if (adminsWithEmail.length === 0 && c.env.ADMIN_CONTACT_EMAIL) {
      notifyEmail.to = c.env.ADMIN_CONTACT_EMAIL;
      await sendEmail(c.env, notifyEmail).catch(() => {});
    }
  } catch {
    // 邮件通知失败不影响主流程
  }

  return c.json(
    {
      subdomain: newSubdomain,
      message: "子域名申请已提交，请等待管理员审核",
    },
    201,
  );
});

// ==================== 上级所有权审批（前端待审批面板） ====================
// 普通用户入口：GET 我的待审批列表（含我发起的请求 + 我作为所有权者待处理/已处理的请求）。
// POST approve/reject 由当前登录用户作为审批人执行；超时请求在前端显示为由系统按超时自动驳回，
// 此处再次以服务端时间为准校验（与邮件链接 /decide-approval 行为一致）。
api.get("/owner-approvals", async (c) => {
  const user = c.get("user");
  const requester = await getOwnerApprovalsByApplicant(c.env, user.id);
  const approver = await getOwnerApprovalsByApprover(c.env, user.id);
  // 附带申请人/审批人用户名，前端面板直接展示（同库内小量 N+1，可接受）
  const requesterRows = requester.map((a) => ({
    ...a,
    applicant_github_name: user.github_username,
  }));
  const approverRows: Array<Record<string, unknown>> = [];
  for (const a of approver) {
    const applicant = await findUserById(c.env, a.applicant_user_id);
    approverRows.push({
      ...a,
      applicant_github_name:
        applicant?.github_username || `用户#${a.applicant_user_id}`,
    });
  }
  return c.json({ requester: requesterRows, approver: approverRows });
});

// 前端面板的「同意」——仅审批人本人可操作
api.post("/owner-approvals/:id/approve", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);
  const approval = await getOwnerApprovalById(c.env, id);
  if (!approval) return c.json({ error: "该审批请求不存在" }, 404);
  if (approval.approver_user_id !== user.id)
    return c.json({ error: "您不是该请求的审批人" }, 403);
  if ((approval.status as string) !== "pending")
    return c.json({ error: "该请求已被处理" }, 409);
  if (isOwnerApprovalExpired(approval)) {
    await expireOwnerApproval(c.env, approval, new URL(c.req.url).origin);
    return c.json({ error: "该请求已超时，已自动驳回" }, 409);
  }
  const r = await approveOwnerApproval(
    c.env,
    approval,
    new URL(c.req.url).origin,
  );
  return c.json(
    r.dupe
      ? { message: "子域名已存在，审批已标记为同意" }
      : { message: "已同意，子域名已开通并纳入您的审批" },
  );
});

// 前端面板的「驳回」——仅审批人本人可操作
api.post("/owner-approvals/:id/reject", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);
  const approval = await getOwnerApprovalById(c.env, id);
  if (!approval) return c.json({ error: "该审批请求不存在" }, 404);
  if (approval.approver_user_id !== user.id)
    return c.json({ error: "您不是该请求的审批人" }, 403);
  if ((approval.status as string) !== "pending")
    return c.json({ error: "该请求已被处理" }, 409);
  if (isOwnerApprovalExpired(approval)) {
    await expireOwnerApproval(c.env, approval, new URL(c.req.url).origin);
    return c.json({ error: "该请求已超时，已自动驳回" }, 409);
  }
  await rejectOwnerApproval(c.env, approval, new URL(c.req.url).origin);
  return c.json({ message: "已驳回该申请" });
});

// 删除子域名
api.delete("/subdomains/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);

  const subdomain = await getSubdomainById(c.env, id);
  if (!subdomain) {
    return c.json({ error: "子域名不存在" }, 404);
  }

  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "无权操作此子域名" }, 403);
  }

  // 已审核通过：先精确回收该子域名名下全部 DNS 解析（只限本 FQDN，绝不误删他人项目）
  // 目的：删除权限的同时确保解析一并失效，不会出现“权限已删但解析仍生效”的残留。
  if (subdomain.status === "approved") {
    const acc = await resolveCfAccount(c, subdomain.domain);
    if (acc.error) {
      console.error(
        `[audit] delete: cannot resolve CF account for ${subdomain.domain}: ${acc.error}`,
      );
    } else {
      try {
        await cfDeleteDnsRecordsByFqdn(
          acc.token,
          acc.zoneId,
          `${subdomain.subdomain}.${subdomain.domain}`,
        );
      } catch (err) {
        // CF 实时整组删除失败 → 回退按 DB 记录逐个删除，尽量回收
        console.error(
          `[audit] delete: CF fqdn cleanup failed: ${(err as Error).message}, fallback to DB`,
        );
        const records = await deleteAllRecordsForSubdomain(c.env, subdomain.id);
        for (const record of records) {
          try {
            await cfDeleteDnsRecord(acc.token, acc.zoneId, record.cf_record_id);
          } catch (e) {
            console.error(
              `Failed to delete CF record ${record.cf_record_id}:`,
              e,
            );
          }
        }
      }
      // 无论成败都清空 DB 记录缓存（子域名删除本身有级联，此处显式清理使权限即时失效）
      await deleteAllRecordsForSubdomain(c.env, subdomain.id);
    }
  }

  await deleteSubdomain(c.env, id);

  // write-through：镜像侧删除该行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(c.env, "subdomains", id).catch(() => {});

  // 已审批赋予他人的子域被删除 → 折叠关联审批记录 + 通知二级域名持有人（父级拥有者）
  await foldApprovalAndNotify(
    c,
    `${subdomain.subdomain}.${subdomain.domain}`,
    "该子域持有人（获准使用人）",
  ).catch(() => {});

  // 通知管理员：用户已删除该子域名及其 DNS 解析
  try {
    const url = new URL(c.req.url);
    const siteName = c.env.SITE_NAME || "SubDomain Hub";
    const notifyAdmin = buildUserDeletedAdminEmail(
      user.github_username,
      subdomain.subdomain,
      subdomain.domain,
      siteName,
      url.origin,
    );
    const admins = await getAllUsers(c.env);
    const adminsWithEmail = admins.filter((u) => u.is_admin && u.email);
    for (const admin of adminsWithEmail) {
      notifyAdmin.to = admin.email!;
      await sendEmail(c.env, notifyAdmin).catch(() => {});
    }
    if (adminsWithEmail.length === 0 && c.env.ADMIN_CONTACT_EMAIL) {
      notifyAdmin.to = c.env.ADMIN_CONTACT_EMAIL;
      await sendEmail(c.env, notifyAdmin).catch(() => {});
    }
  } catch {
    // 通知失败不影响删除主流程
  }

  return c.json({ success: true });
});

/**
 * 删除已审批赋予他人的子域时联动：折叠关联审批记录（置 status='deleted'，
 * 前端「已处理」区自动隐藏该记录，保留审计）+ 邮件通知二级域名持有人（父级拥有者/审批人）。
 * 非被审批子域（owner_approvals 无记录）时是 no-op，不影响普通删除。
 */
async function foldApprovalAndNotify(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  fqdn: string,
  removedBy: string,
): Promise<void> {
  try {
    const approvals = await getApprovalsByTargetFqdn(c.env, fqdn);
    if (approvals.length === 0) return;
    const active = approvals.find(
      (a) => a.status === "approved" || a.status === "pending",
    );
    // 折叠：把关联审批记录置 deleted（保留审计，前端「已处理」区自动隐藏）
    for (const a of approvals) {
      if (a.status === "approved" || a.status === "pending") {
        await setOwnerApprovalStatus(c.env, a.id, "deleted");
      }
    }
    // 通知二级域名持有人 = 父级拥有者（审批人）
    if (!active) return;
    const approver = await findUserById(c.env, active.approver_user_id);
    if (!approver?.email) return;
    const siteName = c.env.SITE_NAME || "SubDomain Hub";
    const url = new URL(c.req.url);
    const email = buildApprovedSubdomainRemovedToApproverEmail(
      approver.github_username,
      fqdn,
      active.base_fqdn,
      removedBy,
      siteName,
      url.origin,
    );
    email.to = approver.email;
    email.toName = approver.github_username;
    await sendEmail(c.env, email).catch(() => {});
  } catch (err) {
    console.error(
      `[audit] foldApprovalAndNotify error: ${(err as Error).message}`,
    );
  }
}

// ==================== DNS 记录管理 ====================

/**
 * DNS 记录读取：开启 `DNS_LIVE_READ` 时优先从 Cloudflare 实时查（节省 D1 读额度），
 * 任何 CF 查询失败自动回退 D1；返回的记录 `id` 即 CF 记录 id（写/删以 CF id 定位）。
 */
async function readRecordsForSubdomain(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  subdomainId: number,
  fullName: string,
): Promise<any[]> {
  if (!isDnsLiveRead(c.env)) {
    return getSubdomainRecords(c.env, subdomainId);
  }
  const dotIndex = fullName.indexOf(".");
  const domain = dotIndex >= 0 ? fullName.slice(dotIndex + 1) : fullName;
  const acc = await resolveCfAccount(c, domain);
  if (acc.error) {
    return getSubdomainRecords(c.env, subdomainId);
  }
  try {
    const zoneRecords = await cfListAllZoneRecords(acc.token, acc.zoneId);
    const prefix = fullName + ".";
    return zoneRecords
      .filter((r) => r.name === fullName || r.name.endsWith(prefix))
      .map((r) => ({
        id: r.id,
        cf_record_id: r.id,
        record_type: r.type,
        name: r.name,
        content: r.content,
        ttl: r.ttl,
        priority: r.priority ?? null,
        proxied: r.proxied,
        comment: r.comment ?? null,
      }));
  } catch (err) {
    console.error(
      `[audit] DNS live read failed, fallback to DB: ${(err as Error).message}`,
    );
    return getSubdomainRecords(c.env, subdomainId);
  }
}

// 获取子域名的 DNS 记录
api.get("/subdomains/:id/records", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);

  const subdomain = await getSubdomainById(c.env, id);
  if (!subdomain) {
    return c.json({ error: "子域名不存在" }, 404);
  }

  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "无权查看此子域名" }, 403);
  }

  if (subdomain.status !== "approved") {
    return c.json({ error: "子域名尚未通过审核，无法管理 DNS 记录" }, 403);
  }

  const fullName = `${subdomain.subdomain}.${subdomain.domain}`;
  const records = await readRecordsForSubdomain(c, subdomain.id, fullName);
  return c.json({
    records,
    subdomain: fullName,
    max_records: getMaxRecords(c.env),
    current_count: records.length,
  });
});

// 构建完整 DNS 名称
function buildFullName(
  name: string,
  subdomain: string,
  domain: string,
): string {
  const cleanName = name.trim().toLowerCase();
  const baseFqdn = `${subdomain}.${domain}`;

  if (!cleanName || cleanName === "@") {
    return baseFqdn;
  }
  return `${cleanName}.${baseFqdn}`;
}

// 创建 DNS 记录
api.post("/subdomains/:id/records", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<DnsRecordInput>();

  const subdomain = await getSubdomainById(c.env, id);
  if (!subdomain) {
    return c.json({ error: "子域名不存在" }, 404);
  }

  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "无权操作此子域名" }, 403);
  }

  if (subdomain.status !== "approved") {
    return c.json({ error: "子域名尚未通过审核" }, 403);
  }

  // 验证记录类型
  if (!RECORD_TYPES.includes(body.type as any)) {
    return c.json(
      { error: `不支持的记录类型，允许: ${RECORD_TYPES.join(", ")}` },
      400,
    );
  }

  // 验证内容
  if (!body.content || !body.content.trim()) {
    return c.json({ error: "记录内容不能为空" }, 400);
  }

  // 验证 A 记录的 IP 格式
  if (body.type === "A") {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(body.content)) {
      return c.json({ error: "A 记录需要有效的 IPv4 地址" }, 400);
    }
  }

  // 验证 AAAA 记录的 IPv6 格式
  if (body.type === "AAAA") {
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    if (!ipv6Regex.test(body.content)) {
      return c.json({ error: "AAAA 记录需要有效的 IPv6 地址" }, 400);
    }
  }

  // MX 记录需要 priority
  if (
    body.type === "MX" &&
    (body.priority === undefined || body.priority === null)
  ) {
    return c.json({ error: "MX 记录需要设置优先级" }, 400);
  }

  // 检查记录数量限制
  const currentCount = await countSubdomainRecords(c.env, subdomain.id);
  const maxRecords = getMaxRecords(c.env);
  if (currentCount >= maxRecords) {
    return c.json({ error: `已达到 DNS 记录数量上限 (${maxRecords})` }, 400);
  }

  // 构建完整名称
  const fullName = buildFullName(
    body.name || "@",
    subdomain.subdomain,
    subdomain.domain,
  );

  // 从用户绑定的账户解析 Zone ID 与对应 token（多账户）
  const acc = await resolveCfAccount(c, subdomain.domain);
  if (acc.error) {
    return c.json({ error: acc.error }, 500);
  }

  try {
    // 在 Cloudflare 创建 DNS 记录
    const cfRecord = await cfCreateDnsRecord(acc.token, acc.zoneId, {
      type: body.type,
      name: body.name || "@",
      content: body.content.trim(),
      ttl: body.ttl || 1,
      priority: body.priority,
      proxied: body.proxied ?? false,
      fullName,
    });

    // 保存到数据库
    const record = await createDnsRecordEntry(
      c.env,
      subdomain.id,
      cfRecord.id,
      body.type,
      body.name || "@",
      body.content.trim(),
      body.ttl || 1,
      body.priority ?? null,
      body.proxied ?? false,
      body.comment ?? null,
    );

    // write-through：镜像侧新增该 DNS 记录行（best-effort，失败静默，日级 cron 回补）
    await mirrorSyncRow(c.env, "dns_records", record.id).catch(() => {});

    return c.json({ record }, 201);
  } catch (err: any) {
    return c.json({ error: `创建 DNS 记录失败: ${err.message}` }, 500);
  }
});

// 更新 DNS 记录
api.put("/subdomains/:id/records/:recordId", async (c) => {
  const user = c.get("user");
  const subId = parseInt(c.req.param("id"), 10);
  const recordIdRaw = c.req.param("recordId");
  const body = await c.req.json<DnsRecordInput>();

  const subdomain = await getSubdomainById(c.env, subId);
  if (!subdomain) {
    return c.json({ error: "子域名不存在" }, 404);
  }

  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "无权操作此子域名" }, 403);
  }

  if (subdomain.status !== "approved") {
    return c.json({ error: "子域名尚未通过审核" }, 403);
  }

  const existingRecord = isDnsLiveRead(c.env)
    ? await getDnsRecordByCfId(c.env, subdomain.id, recordIdRaw)
    : await getDnsRecordById(c.env, parseInt(recordIdRaw, 10));
  if (!existingRecord || existingRecord.subdomain_id !== subdomain.id) {
    return c.json({ error: "DNS 记录不存在" }, 404);
  }

  // 验证记录类型
  if (!RECORD_TYPES.includes(body.type as any)) {
    return c.json({ error: `不支持的记录类型` }, 400);
  }

  if (!body.content || !body.content.trim()) {
    return c.json({ error: "记录内容不能为空" }, 400);
  }

  const fullName = buildFullName(
    body.name || "@",
    subdomain.subdomain,
    subdomain.domain,
  );

  const acc = await resolveCfAccount(c, subdomain.domain);
  if (acc.error) {
    return c.json({ error: acc.error }, 500);
  }

  try {
    const cfRecord = await cfUpdateDnsRecord(
      acc.token,
      acc.zoneId,
      existingRecord.cf_record_id,
      {
        type: body.type,
        name: body.name || "@",
        content: body.content.trim(),
        ttl: body.ttl || 1,
        priority: body.priority,
        proxied: body.proxied ?? false,
        fullName,
      },
    );

    await updateDnsRecordEntry(
      c.env,
      existingRecord.id,
      cfRecord.id,
      body.type,
      body.name || "@",
      body.content.trim(),
      body.ttl || 1,
      body.priority ?? null,
      body.proxied ?? false,
      body.comment ?? null,
    );

    // write-through：镜像侧更新该 DNS 记录行（best-effort，失败静默，日级 cron 回补）
    await mirrorSyncRow(c.env, "dns_records", existingRecord.id).catch(
      () => {},
    );

    const updated = await getDnsRecordById(c.env, existingRecord.id);
    return c.json({ record: updated });
  } catch (err: any) {
    return c.json({ error: `更新 DNS 记录失败: ${err.message}` }, 500);
  }
});

// 删除 DNS 记录
api.delete("/subdomains/:id/records/:recordId", async (c) => {
  const user = c.get("user");
  const subId = parseInt(c.req.param("id"), 10);
  const recordIdRaw = c.req.param("recordId");

  const subdomain = await getSubdomainById(c.env, subId);
  if (!subdomain) {
    return c.json({ error: "子域名不存在" }, 404);
  }

  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "无权操作此子域名" }, 403);
  }

  const record = isDnsLiveRead(c.env)
    ? await getDnsRecordByCfId(c.env, subdomain.id, recordIdRaw)
    : await getDnsRecordById(c.env, parseInt(recordIdRaw, 10));
  if (!record || record.subdomain_id !== subdomain.id) {
    return c.json({ error: "DNS 记录不存在" }, 404);
  }

  const acc = await resolveCfAccount(c, subdomain.domain);
  if (acc.error) {
    return c.json({ error: acc.error }, 500);
  }

  try {
    await cfDeleteDnsRecord(acc.token, acc.zoneId, record.cf_record_id);
  } catch (err: any) {
    console.error(`Failed to delete CF record:`, err);
  }

  await deleteDnsRecordEntry(c.env, record.id);

  // write-through：镜像侧删除该 DNS 记录行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(c.env, "dns_records", record.id).catch(() => {});

  return c.json({ success: true });
});

// ==================== 管理员接口 ====================

api.get("/admin/subdomains", adminMiddleware, async (c) => {
  const subdomains = await getAllSubdomains(c.env);
  return c.json({ subdomains });
});

api.get("/admin/pending", adminMiddleware, async (c) => {
  const pending = await getPendingSubdomains(c.env);
  return c.json({ subdomains: pending });
});

api.get("/admin/users", adminMiddleware, async (c) => {
  const users = await getAllUsers(c.env);
  return c.json({ users });
});

// 管理员审核通过
api.post("/admin/subdomains/:id/approve", adminMiddleware, async (c) => {
  const admin = c.get("user");
  const id = parseInt(c.req.param("id") || "0", 10);

  const subdomain = await getSubdomainById(c.env, id);
  if (!subdomain) {
    return c.json({ error: "子域名不存在" }, 404);
  }

  if (subdomain.status !== "pending") {
    return c.json({ error: "该子域名不在待审核状态" }, 400);
  }

  await approveSubdomain(c.env, id, admin.id);

  // write-through：镜像侧更新该行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(c.env, "subdomains", id).catch(() => {});

  // 发送通知邮件给用户
  try {
    const owner = await findUserById(c.env, subdomain.user_id);
    if (owner?.email) {
      const url = new URL(c.req.url);
      const siteName = c.env.SITE_NAME || "SubDomain Hub";
      const email = buildApprovalEmail(
        subdomain.subdomain,
        subdomain.domain,
        siteName,
        url.origin,
      );
      email.to = owner.email;
      email.toName = owner.github_username;
      await sendEmail(c.env, email).catch(() => {});
    }
  } catch {
    // 不影响主流程
  }

  return c.json({ success: true, message: "已通过审核" });
});

// 管理员审核拒绝
api.post("/admin/subdomains/:id/reject", adminMiddleware, async (c) => {
  const admin = c.get("user");
  const id = parseInt(c.req.param("id") || "0", 10);
  const body = await c.req.json<{ reason: string }>();

  if (!body.reason || !body.reason.trim()) {
    return c.json({ error: "请填写拒绝原因" }, 400);
  }

  const subdomain = await getSubdomainById(c.env, id);
  if (!subdomain) {
    return c.json({ error: "子域名不存在" }, 404);
  }

  if (subdomain.status !== "pending") {
    return c.json({ error: "该子域名不在待审核状态" }, 400);
  }

  await rejectSubdomain(c.env, id, admin.id, body.reason.trim());

  // write-through：镜像侧更新该行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(c.env, "subdomains", id).catch(() => {});

  // 发送通知邮件给用户
  try {
    const owner = await findUserById(c.env, subdomain.user_id);
    if (owner?.email) {
      const url = new URL(c.req.url);
      const siteName = c.env.SITE_NAME || "SubDomain Hub";
      const email = buildRejectionEmail(
        subdomain.subdomain,
        subdomain.domain,
        body.reason.trim(),
        siteName,
        url.origin,
      );
      email.to = owner.email;
      email.toName = owner.github_username;
      await sendEmail(c.env, email).catch(() => {});
    }
  } catch {
    // 不影响主流程
  }

  return c.json({ success: true, message: "已拒绝" });
});

// 管理员删除子域名
api.delete("/admin/subdomains/:id", adminMiddleware, async (c) => {
  const id = parseInt(c.req.param("id") || "0", 10);

  // 读取可选删除理由（DELETE 可携 JSON body，前端可填理由）
  let reason = "";
  const ct = c.req.header("content-type") || "";
  if (ct.toLowerCase().includes("application/json")) {
    try {
      const b = (await c.req.json()) as { reason?: string };
      reason = (b.reason || "").trim();
    } catch {
      // 无 body 或解析失败则不填理由
    }
  }

  const subdomain = await getSubdomainById(c.env, id);
  if (!subdomain) {
    return c.json({ error: "子域名不存在" }, 404);
  }

  // 精确回收该子域名名下全部 DNS 解析（只限本 FQDN，不误删他人项目）。
  // 目的：移除权限的同时一并撤销解析，防止“删除后解析仍生效”。
  if (subdomain.status === "approved") {
    const acc = await resolveCfAccount(c, subdomain.domain);
    if (acc.error) {
      console.error(
        `[audit] admin delete: cannot resolve CF account for ${subdomain.domain}: ${acc.error}`,
      );
    } else {
      try {
        await cfDeleteDnsRecordsByFqdn(
          acc.token,
          acc.zoneId,
          `${subdomain.subdomain}.${subdomain.domain}`,
        );
      } catch (err) {
        console.error(
          `[audit] admin delete: CF fqdn cleanup failed: ${(err as Error).message}, fallback to DB`,
        );
        const records = await deleteAllRecordsForSubdomain(c.env, subdomain.id);
        for (const record of records) {
          try {
            await cfDeleteDnsRecord(acc.token, acc.zoneId, record.cf_record_id);
          } catch (e) {
            console.error(
              `Failed to delete CF record ${record.cf_record_id}:`,
              e,
            );
          }
        }
      }
      await deleteAllRecordsForSubdomain(c.env, subdomain.id);
    }
  }

  await deleteSubdomain(c.env, id);

  // write-through：镜像侧删除该行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(c.env, "subdomains", id).catch(() => {});

  // 已审批赋予他人的子域被删除 → 折叠关联审批记录 + 通知二级域名持有人（父级拥有者）
  await foldApprovalAndNotify(
    c,
    `${subdomain.subdomain}.${subdomain.domain}`,
    "管理员",
  ).catch(() => {});

  // 邮件通知该子域名所属用户（含删除理由）
  try {
    const owner = await findUserById(c.env, subdomain.user_id);
    if (owner?.email) {
      const url = new URL(c.req.url);
      const siteName = c.env.SITE_NAME || "SubDomain Hub";
      const email = buildDeletionNoticeEmail(
        subdomain.subdomain,
        subdomain.domain,
        reason || "管理员未填写原因",
        siteName,
        url.origin,
      );
      email.to = owner.email;
      email.toName = owner.github_username;
      await sendEmail(c.env, email).catch(() => {});
    }
  } catch {
    // 通知失败不影响删除主流程
  }

  return c.json({ success: true, reason: reason || null });
});

export default api;
