// 上级所有权审批 —— 决策与落地的共享逻辑
// 供两类入口复用，保证行为完全一致：
//   1) 邮件「同意/驳回」链接 → index.ts GET /decide-approval
//   2) 普通用户前端审批面板 → api.ts POST /owner-approvals/:id/{approve,reject}
// 统一处理：超时自动驳回(expired)、驳回(rejected)、同意(approved，创建子域名并置为已批准)。
import type { Env, OwnerApproval } from "../types";
import {
  setOwnerApprovalStatus,
  findSubdomain,
  createSubdomain,
  approveSubdomain,
  findUserById,
} from "../db/queries";
import { sendEmail, buildOwnerApprovalResultEmail } from "./email";
import { mirrorSyncRow } from "./mirror";

export type OwnerApprovalAction = "approve" | "reject";

/** 是否已超时（超过 deadline_at 仍未处理的 pending 请求） */
export function isOwnerApprovalExpired(a: OwnerApproval): boolean {
  return new Date(a.deadline_at).getTime() < Date.now();
}

/** 拆分目标 FQDN 得到 注册域名(baseDomain) 与 目标子域前缀(targetSub)，与开通流程一致 */
export function splitOwnerApprovalTarget(a: OwnerApproval): {
  baseDomain: string;
  targetSub: string;
} {
  const baseDomain = a.base_fqdn.slice(a.base_fqdn.indexOf(".") + 1);
  const targetSub = a.target_fqdn.slice(0, a.target_fqdn.indexOf(baseDomain));
  return { baseDomain, targetSub: targetSub.replace(/\.$/, "") };
}

/** 通知申请人最终结果（同意/驳回/超时） */
async function notifyApplicant(
  env: Env,
  a: OwnerApproval,
  result: "approved" | "rejected" | "expired",
  siteUrl: string,
): Promise<void> {
  const applicant = await findUserById(env, a.applicant_user_id);
  if (!applicant || !applicant.email) return;
  const siteName = env.SITE_NAME || "SubDomain Hub";
  const mail = buildOwnerApprovalResultEmail(
    applicant.github_username,
    a.target_fqdn,
    a.base_fqdn,
    result,
    siteName,
    siteUrl,
  );
  mail.to = applicant.email;
  await sendEmail(env, mail).catch(() => {});
}

/** 超时自动驳回（仅对 pending 且已超时生效；已处理或未超时返回 false 不做任何改动） */
export async function expireOwnerApproval(
  env: Env,
  a: OwnerApproval,
  siteUrl: string,
): Promise<boolean> {
  if ((a.status as string) !== "pending" || !isOwnerApprovalExpired(a))
    return false;
  await setOwnerApprovalStatus(env, a.id, "expired");
  // write-through：镜像侧同步该审批行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(env, "owner_approvals", a.id).catch(() => {});
  await notifyApplicant(env, a, "expired", siteUrl);
  return true;
}

/** 驳回申请 */
export async function rejectOwnerApproval(
  env: Env,
  a: OwnerApproval,
  siteUrl: string,
): Promise<void> {
  await setOwnerApprovalStatus(env, a.id, "rejected");
  // write-through：镜像侧同步该审批行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(env, "owner_approvals", a.id).catch(() => {});
  await notifyApplicant(env, a, "rejected", siteUrl);
}

/**
 * 同意申请：创建目标子域名并置为已批准（所有权者已同意），再通知申请人。
 * 若目标子域名已存在（如已被占用），则仅将该审批标记为同意，返回 dupe=true，不重复创建。
 */
export async function approveOwnerApproval(
  env: Env,
  a: OwnerApproval,
  siteUrl: string,
): Promise<{ dupe: boolean }> {
  const { baseDomain, targetSub } = splitOwnerApprovalTarget(a);
  const exists = await findSubdomain(env, targetSub, baseDomain);
  if (exists) {
    await setOwnerApprovalStatus(env, a.id, "approved");
    // write-through：镜像侧同步该审批行（best-effort，失败静默，日级 cron 回补）
    await mirrorSyncRow(env, "owner_approvals", a.id).catch(() => {});
    await notifyApplicant(env, a, "approved", siteUrl);
    return { dupe: true };
  }
  const created = await createSubdomain(
    env,
    a.applicant_user_id,
    targetSub,
    baseDomain,
  );
  await approveSubdomain(env, created.id, a.approver_user_id);
  await setOwnerApprovalStatus(env, a.id, "approved");
  // write-through：镜像侧同步新建/更新行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(env, "subdomains", created.id).catch(() => {});
  await mirrorSyncRow(env, "owner_approvals", a.id).catch(() => {});
  await notifyApplicant(env, a, "approved", siteUrl);
  return { dupe: false };
}
