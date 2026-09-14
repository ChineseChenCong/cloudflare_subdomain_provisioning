var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __template = (cooked, raw2) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw2 || cooked.slice()) }));

// src/db/queries.ts
var queries_exports = {};
__export(queries_exports, {
  addEmailDomainToWhitelist: () => addEmailDomainToWhitelist,
  approveSubdomain: () => approveSubdomain,
  countSubdomainRecords: () => countSubdomainRecords,
  countUserSubdomains: () => countUserSubdomains,
  createAnnouncement: () => createAnnouncement,
  createCloudflareAccount: () => createCloudflareAccount,
  createDnsRecordEntry: () => createDnsRecordEntry,
  createEmailVerificationRecord: () => createEmailVerificationRecord,
  createSubdomain: () => createSubdomain,
  deleteAllRecordsForSubdomain: () => deleteAllRecordsForSubdomain,
  deleteAnnouncement: () => deleteAnnouncement,
  deleteCloudflareAccount: () => deleteCloudflareAccount,
  deleteDnsRecordEntry: () => deleteDnsRecordEntry,
  deleteSubdomain: () => deleteSubdomain,
  findSubdomain: () => findSubdomain,
  findUserByGitHubId: () => findUserByGitHubId,
  findUserById: () => findUserById,
  getActiveAnnouncements: () => getActiveAnnouncements,
  getAllAnnouncements: () => getAllAnnouncements,
  getAllSubdomains: () => getAllSubdomains,
  getAllUsers: () => getAllUsers,
  getCloudflareAccountById: () => getCloudflareAccountById,
  getCloudflareAccounts: () => getCloudflareAccounts,
  getDefaultCloudflareAccount: () => getDefaultCloudflareAccount,
  getDnsRecordById: () => getDnsRecordById,
  getEmailDomainWhitelist: () => getEmailDomainWhitelist,
  getFriendLinksFromDb: () => getFriendLinksFromDb,
  getPendingSubdomains: () => getPendingSubdomains,
  getSubdomainById: () => getSubdomainById,
  getSubdomainRecords: () => getSubdomainRecords,
  getSystemSetting: () => getSystemSetting,
  getUserSubdomains: () => getUserSubdomains,
  rejectSubdomain: () => rejectSubdomain,
  removeEmailDomainFromWhitelist: () => removeEmailDomainFromWhitelist,
  setSystemSetting: () => setSystemSetting,
  updateAnnouncement: () => updateAnnouncement,
  updateCloudflareAccount: () => updateCloudflareAccount,
  updateDnsRecordEntry: () => updateDnsRecordEntry,
  updateUserEmail: () => updateUserEmail,
  updateUserEmailVerified: () => updateUserEmailVerified,
  upsertUser: () => upsertUser,
  verifyEmailByToken: () => verifyEmailByToken
});
async function findUserByGitHubId(db, githubId) {
  return db.prepare("SELECT * FROM users WHERE github_id = ?").bind(githubId).first();
}
async function findUserById(db, id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
}
async function upsertUser(db, githubId, githubUsername, avatarUrl, email, isAdmin) {
  await db.prepare(
    `INSERT INTO users (github_id, github_username, avatar_url, email, is_admin)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(github_id) DO UPDATE SET
         github_username = excluded.github_username,
         avatar_url = excluded.avatar_url,
         email = excluded.email,
         is_admin = CASE WHEN excluded.is_admin = 1 THEN 1 ELSE users.is_admin END,
         updated_at = datetime('now')`
  ).bind(githubId, githubUsername, avatarUrl, email, isAdmin ? 1 : 0).run();
  const user = await findUserByGitHubId(db, githubId);
  if (!user) throw new Error("Failed to upsert user");
  return user;
}
async function updateUserEmailVerified(db, userId, emailVerified) {
  await db.prepare(
    `UPDATE users SET email_verified = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(emailVerified ? 1 : 0, userId).run();
}
async function updateUserEmail(db, userId, email) {
  await db.prepare(
    `UPDATE users SET email = ?, email_verified = 0, updated_at = datetime('now') WHERE id = ?`
  ).bind(email, userId).run();
}
async function getUserSubdomains(db, userId) {
  const result = await db.prepare("SELECT * FROM subdomains WHERE user_id = ? ORDER BY created_at DESC").bind(userId).all();
  return result.results;
}
async function getSubdomainById(db, id) {
  return db.prepare("SELECT * FROM subdomains WHERE id = ?").bind(id).first();
}
async function findSubdomain(db, subdomain, domain) {
  return db.prepare("SELECT * FROM subdomains WHERE subdomain = ? AND domain = ?").bind(subdomain, domain).first();
}
async function countUserSubdomains(db, userId) {
  const result = await db.prepare("SELECT COUNT(*) as count FROM subdomains WHERE user_id = ? AND status != ?").bind(userId, "rejected").first();
  return result?.count || 0;
}
async function createSubdomain(db, userId, subdomain, domain) {
  await db.prepare("INSERT INTO subdomains (user_id, subdomain, domain) VALUES (?, ?, ?)").bind(userId, subdomain, domain).run();
  const record = await findSubdomain(db, subdomain, domain);
  if (!record) throw new Error("Failed to create subdomain");
  return record;
}
async function deleteSubdomain(db, id) {
  await db.prepare("DELETE FROM subdomains WHERE id = ?").bind(id).run();
}
async function approveSubdomain(db, id, reviewedBy) {
  await db.prepare(
    `UPDATE subdomains SET status = 'approved', reject_reason = NULL, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`
  ).bind(reviewedBy, id).run();
}
async function rejectSubdomain(db, id, reviewedBy, reason) {
  await db.prepare(
    `UPDATE subdomains SET status = 'rejected', reject_reason = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`
  ).bind(reason, reviewedBy, id).run();
}
async function getPendingSubdomains(db) {
  const result = await db.prepare(
    `SELECT s.*, u.github_username, u.email FROM subdomains s
       JOIN users u ON s.user_id = u.id
       WHERE s.status = 'pending'
       ORDER BY s.created_at ASC`
  ).all();
  return result.results;
}
async function getSubdomainRecords(db, subdomainId) {
  const result = await db.prepare("SELECT * FROM dns_records WHERE subdomain_id = ? ORDER BY record_type, name").bind(subdomainId).all();
  return result.results;
}
async function countSubdomainRecords(db, subdomainId) {
  const result = await db.prepare("SELECT COUNT(*) as count FROM dns_records WHERE subdomain_id = ?").bind(subdomainId).first();
  return result?.count || 0;
}
async function getDnsRecordById(db, id) {
  return db.prepare("SELECT * FROM dns_records WHERE id = ?").bind(id).first();
}
async function createDnsRecordEntry(db, subdomainId, cfRecordId, recordType, name, content, ttl, priority, proxied2, comment) {
  const result = await db.prepare(
    `INSERT INTO dns_records (subdomain_id, cf_record_id, record_type, name, content, ttl, priority, proxied, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(subdomainId, cfRecordId, recordType, name, content, ttl, priority, proxied2 ? 1 : 0, comment).run();
  const id = result.meta.last_row_id;
  const record = await getDnsRecordById(db, id);
  if (!record) throw new Error("Failed to create DNS record entry");
  return record;
}
async function updateDnsRecordEntry(db, id, cfRecordId, recordType, name, content, ttl, priority, proxied2, comment) {
  await db.prepare(
    `UPDATE dns_records SET cf_record_id = ?, record_type = ?, name = ?, content = ?, ttl = ?, priority = ?, proxied = ?, comment = ?, updated_at = datetime('now')
       WHERE id = ?`
  ).bind(cfRecordId, recordType, name, content, ttl, priority, proxied2 ? 1 : 0, comment, id).run();
}
async function deleteDnsRecordEntry(db, id) {
  await db.prepare("DELETE FROM dns_records WHERE id = ?").bind(id).run();
}
async function deleteAllRecordsForSubdomain(db, subdomainId) {
  const records = await getSubdomainRecords(db, subdomainId);
  await db.prepare("DELETE FROM dns_records WHERE subdomain_id = ?").bind(subdomainId).run();
  return records;
}
async function getAllSubdomains(db) {
  const result = await db.prepare(
    `SELECT s.*, u.github_username, u.email FROM subdomains s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC`
  ).all();
  return result.results;
}
async function getAllUsers(db) {
  const result = await db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return result.results;
}
async function getCloudflareAccounts(db, userId) {
  const result = await db.prepare("SELECT * FROM cloudflare_accounts WHERE user_id = ? ORDER BY is_default DESC, created_at DESC").bind(userId).all();
  return result.results;
}
async function getCloudflareAccountById(db, userId, accountId) {
  return db.prepare("SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?").bind(userId, accountId).first();
}
async function getDefaultCloudflareAccount(db, userId) {
  return db.prepare("SELECT * FROM cloudflare_accounts WHERE user_id = ? AND is_default = 1 AND is_active = 1 LIMIT 1").bind(userId).first();
}
async function createCloudflareAccount(db, userId, accountName, encryptedApiToken, zoneId, isDefault) {
  if (isDefault) {
    await db.prepare("UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?").bind(userId).run();
  }
  const result = await db.prepare(
    `INSERT INTO cloudflare_accounts (user_id, account_name, api_token, zone_id, is_active, is_default)
       VALUES (?, ?, ?, ?, 1, ?)`
  ).bind(userId, accountName, encryptedApiToken, zoneId, isDefault ? 1 : 0).run();
  const id = result.meta.last_row_id;
  const account = await getCloudflareAccountById(db, userId, id);
  if (!account) throw new Error("Failed to create cloudflare account");
  return account;
}
async function updateCloudflareAccount(db, userId, accountId, updates) {
  const existing = await getCloudflareAccountById(db, userId, accountId);
  if (!existing) {
    throw new Error("Cloudflare \u8D26\u6237\u4E0D\u5B58\u5728");
  }
  if (updates.is_default) {
    await db.prepare("UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?").bind(userId).run();
  }
  const setParts = [];
  const values = [];
  if (updates.account_name !== void 0) {
    setParts.push("account_name = ?");
    values.push(updates.account_name);
  }
  if (updates.api_token !== void 0) {
    setParts.push("api_token = ?");
    values.push(updates.api_token);
  }
  if (updates.zone_id !== void 0) {
    setParts.push("zone_id = ?");
    values.push(updates.zone_id);
  }
  if (updates.is_active !== void 0) {
    setParts.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }
  if (updates.is_default !== void 0) {
    setParts.push("is_default = ?");
    values.push(updates.is_default ? 1 : 0);
  }
  setParts.push('updated_at = datetime("now")');
  if (setParts.length === 1) {
    return existing;
  }
  values.push(userId, accountId);
  await db.prepare(`UPDATE cloudflare_accounts SET ${setParts.join(", ")} WHERE user_id = ? AND id = ?`).bind(...values).run();
  const updated = await getCloudflareAccountById(db, userId, accountId);
  if (!updated) throw new Error("Failed to update cloudflare account");
  return updated;
}
async function deleteCloudflareAccount(db, userId, accountId) {
  const account = await getCloudflareAccountById(db, userId, accountId);
  if (!account) {
    throw new Error("Cloudflare \u8D26\u6237\u4E0D\u5B58\u5728");
  }
  await db.prepare("DELETE FROM cloudflare_accounts WHERE user_id = ? AND id = ?").bind(userId, accountId).run();
  if (account.is_default) {
    const firstActive = await db.prepare("SELECT id FROM cloudflare_accounts WHERE user_id = ? AND is_active = 1 LIMIT 1").bind(userId).first();
    if (firstActive) {
      await db.prepare("UPDATE cloudflare_accounts SET is_default = 1 WHERE user_id = ? AND id = ?").bind(userId, firstActive.id).run();
    }
  }
}
async function createEmailVerificationRecord(db, userId, email, token) {
  await db.prepare("DELETE FROM user_email_verifications WHERE user_id = ? AND email = ?").bind(userId, email).run();
  const result = await db.prepare(
    `INSERT INTO user_email_verifications (user_id, email, verification_token, is_verified, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))`
  ).bind(userId, email, token).run();
  const id = result.meta.last_row_id;
  return {
    id,
    user_id: userId,
    email,
    verification_token: token,
    is_verified: 0,
    verified_at: null,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function verifyEmailByToken(db, token) {
  const verification2 = await db.prepare("SELECT * FROM user_email_verifications WHERE verification_token = ? AND is_verified = 0").bind(token).first();
  if (!verification2) {
    return null;
  }
  const createdAt = new Date(verification2.created_at).getTime();
  const now = Date.now();
  if (now - createdAt > 24 * 60 * 60 * 1e3) {
    return null;
  }
  await db.prepare(
    `UPDATE user_email_verifications
       SET is_verified = 1, verified_at = datetime('now')
       WHERE id = ?`
  ).bind(verification2.id).run();
  await db.prepare(
    `UPDATE users SET email_verified = 1, email = ?, updated_at = datetime('now')
       WHERE id = ?`
  ).bind(verification2.email, verification2.user_id).run();
  return {
    success: true,
    user_id: verification2.user_id,
    email: verification2.email
  };
}
async function getSystemSetting(db, key) {
  return db.prepare("SELECT * FROM system_settings WHERE key = ?").bind(key).first();
}
async function setSystemSetting(db, key, encryptedValue, description) {
  await db.prepare(
    `INSERT INTO system_settings (key, encrypted_value, description, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         encrypted_value = excluded.encrypted_value,
         description = excluded.description,
         updated_at = excluded.updated_at`
  ).bind(key, encryptedValue, description || null).run();
}
async function getEmailDomainWhitelist(db) {
  const result = await db.prepare("SELECT domain, description FROM email_domain_whitelist WHERE is_enabled = 1 ORDER BY domain ASC").all();
  return result.results;
}
async function addEmailDomainToWhitelist(db, domain, description) {
  await db.prepare(
    `INSERT INTO email_domain_whitelist (domain, description, is_enabled)
       VALUES (?, ?, 1)
       ON CONFLICT(domain) DO UPDATE SET
         description = excluded.description,
         is_enabled = 1`
  ).bind(domain.toLowerCase(), description || null).run();
}
async function removeEmailDomainFromWhitelist(db, domain) {
  await db.prepare("UPDATE email_domain_whitelist SET is_enabled = 0 WHERE domain = ?").bind(domain.toLowerCase()).run();
}
async function getActiveAnnouncements(db) {
  const result = await db.prepare("SELECT * FROM announcements WHERE is_active = 1 ORDER BY is_pinned DESC, sort_order ASC, id ASC").all();
  return result.results;
}
async function getAllAnnouncements(db) {
  const result = await db.prepare("SELECT * FROM announcements ORDER BY is_active DESC, is_pinned DESC, sort_order ASC, id ASC").all();
  return result.results;
}
async function createAnnouncement(db, title, content, createdBy, sortOrder, isPinned) {
  let order = sortOrder;
  if (order === void 0 || Number.isNaN(order)) {
    const max = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM announcements").first();
    order = (max?.m ?? -1) + 1;
  }
  const result = await db.prepare(
    "INSERT INTO announcements (title, content, is_active, is_pinned, sort_order, created_by) VALUES (?, ?, 1, ?, ?, ?)"
  ).bind(title, content, isPinned ? 1 : 0, order, createdBy).run();
  const id = result.meta.last_row_id;
  return db.prepare("SELECT * FROM announcements WHERE id = ?").bind(id).first();
}
async function updateAnnouncement(db, id, updates) {
  const setParts = [];
  const values = [];
  if (updates.title !== void 0) {
    setParts.push("title = ?");
    values.push(updates.title);
  }
  if (updates.content !== void 0) {
    setParts.push("content = ?");
    values.push(updates.content);
  }
  if (updates.is_active !== void 0) {
    setParts.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }
  if (updates.is_pinned !== void 0) {
    setParts.push("is_pinned = ?");
    values.push(updates.is_pinned ? 1 : 0);
  }
  if (updates.sort_order !== void 0 && !Number.isNaN(updates.sort_order)) {
    setParts.push("sort_order = ?");
    values.push(updates.sort_order);
  }
  setParts.push('updated_at = datetime("now")');
  if (setParts.length === 1) return null;
  values.push(id);
  await db.prepare(`UPDATE announcements SET ${setParts.join(", ")} WHERE id = ?`).bind(...values).run();
  return db.prepare("SELECT * FROM announcements WHERE id = ?").bind(id).first();
}
async function deleteAnnouncement(db, id) {
  await db.prepare("DELETE FROM announcements WHERE id = ?").bind(id).run();
  await db.prepare(
    `WITH ranked AS (
         SELECT id,
                ROW_NUMBER() OVER (ORDER BY is_active DESC, is_pinned DESC, sort_order ASC, id ASC) - 1 AS new_sort
         FROM announcements
       )
       UPDATE announcements
       SET sort_order = (SELECT new_sort FROM ranked WHERE ranked.id = announcements.id),
           updated_at = datetime('now')`
  ).run();
}
async function getFriendLinksFromDb(db) {
  const result = await db.prepare("SELECT * FROM friend_links ORDER BY sort_order ASC, id ASC").all();
  return result.results;
}
var init_queries = __esm({
  "src/db/queries.ts"() {
    "use strict";
    __name(findUserByGitHubId, "findUserByGitHubId");
    __name(findUserById, "findUserById");
    __name(upsertUser, "upsertUser");
    __name(updateUserEmailVerified, "updateUserEmailVerified");
    __name(updateUserEmail, "updateUserEmail");
    __name(getUserSubdomains, "getUserSubdomains");
    __name(getSubdomainById, "getSubdomainById");
    __name(findSubdomain, "findSubdomain");
    __name(countUserSubdomains, "countUserSubdomains");
    __name(createSubdomain, "createSubdomain");
    __name(deleteSubdomain, "deleteSubdomain");
    __name(approveSubdomain, "approveSubdomain");
    __name(rejectSubdomain, "rejectSubdomain");
    __name(getPendingSubdomains, "getPendingSubdomains");
    __name(getSubdomainRecords, "getSubdomainRecords");
    __name(countSubdomainRecords, "countSubdomainRecords");
    __name(getDnsRecordById, "getDnsRecordById");
    __name(createDnsRecordEntry, "createDnsRecordEntry");
    __name(updateDnsRecordEntry, "updateDnsRecordEntry");
    __name(deleteDnsRecordEntry, "deleteDnsRecordEntry");
    __name(deleteAllRecordsForSubdomain, "deleteAllRecordsForSubdomain");
    __name(getAllSubdomains, "getAllSubdomains");
    __name(getAllUsers, "getAllUsers");
    __name(getCloudflareAccounts, "getCloudflareAccounts");
    __name(getCloudflareAccountById, "getCloudflareAccountById");
    __name(getDefaultCloudflareAccount, "getDefaultCloudflareAccount");
    __name(createCloudflareAccount, "createCloudflareAccount");
    __name(updateCloudflareAccount, "updateCloudflareAccount");
    __name(deleteCloudflareAccount, "deleteCloudflareAccount");
    __name(createEmailVerificationRecord, "createEmailVerificationRecord");
    __name(verifyEmailByToken, "verifyEmailByToken");
    __name(getSystemSetting, "getSystemSetting");
    __name(setSystemSetting, "setSystemSetting");
    __name(getEmailDomainWhitelist, "getEmailDomainWhitelist");
    __name(addEmailDomainToWhitelist, "addEmailDomainToWhitelist");
    __name(removeEmailDomainFromWhitelist, "removeEmailDomainFromWhitelist");
    __name(getActiveAnnouncements, "getActiveAnnouncements");
    __name(getAllAnnouncements, "getAllAnnouncements");
    __name(createAnnouncement, "createAnnouncement");
    __name(updateAnnouncement, "updateAnnouncement");
    __name(deleteAnnouncement, "deleteAnnouncement");
    __name(getFriendLinksFromDb, "getFriendLinksFromDb");
  }
});

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers2 = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers2.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var escapeRe = /[&<>'"]/;
var stringBufferToString = /* @__PURE__ */ __name(async (buffer, callbacks) => {
  let str = "";
  callbacks ||= [];
  const resolvedBuffer = await Promise.all(buffer);
  for (let i = resolvedBuffer.length - 1; ; i--) {
    str += resolvedBuffer[i];
    i--;
    if (i < 0) {
      break;
    }
    let r = resolvedBuffer[i];
    if (typeof r === "object") {
      callbacks.push(...r.callbacks || []);
    }
    const isEscaped = r.isEscaped;
    r = await (typeof r === "object" ? r.toString() : r);
    if (typeof r === "object") {
      callbacks.push(...r.callbacks || []);
    }
    if (r.isEscaped ?? isEscaped) {
      str += r;
    } else {
      const buf = [str];
      escapeToBuffer(r, buf);
      str = buf[0];
    }
  }
  return raw(str, callbacks);
}, "stringBufferToString");
var escapeToBuffer = /* @__PURE__ */ __name((str, buffer) => {
  const match2 = str.search(escapeRe);
  if (match2 === -1) {
    buffer[0] += str;
    return;
  }
  let escape;
  let index;
  let lastIndex = 0;
  for (index = match2; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34:
        escape = "&quot;";
        break;
      case 39:
        escape = "&#39;";
        break;
      case 38:
        escape = "&amp;";
        break;
      case 60:
        escape = "&lt;";
        break;
      case 62:
        escape = "&gt;";
        break;
      default:
        continue;
    }
    buffer[0] += str.substring(lastIndex, index) + escape;
    lastIndex = index + 1;
  }
  buffer[0] += str.substring(lastIndex, index);
}, "escapeToBuffer");
var resolveCallbackSync = /* @__PURE__ */ __name((str) => {
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return str;
  }
  const buffer = [str];
  const context = {};
  callbacks.forEach((c) => c({ phase: HtmlEscapedCallbackPhase.Stringify, buffer, context }));
  return buffer[0];
}, "resolveCallbackSync");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers2) => {
  return {
    "Content-Type": contentType,
    ...headers2
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers2 = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers2.delete(name);
    } else if (options?.append) {
      headers2.append(name, value);
    } else {
      headers2.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers2) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers2) {
      for (const [k, v] of Object.entries(headers2)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers2) => this.#newResponse(data, arg, headers2), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers2) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers2 && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers2)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers2) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers2)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html2, arg, headers2) => {
    const res = /* @__PURE__ */ __name((html22) => this.#newResponse(html22, arg, setDefaultContentType("text/html; charset=UTF-8", headers2)), "res");
    return typeof html2 === "object" ? resolveCallback(html2, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html2);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers2 = opts.allowHeaders;
      if (!headers2?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers2 = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers2?.length) {
        set("Access-Control-Allow-Headers", headers2.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// node_modules/hono/dist/utils/cookie.js
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var parse = /* @__PURE__ */ __name((cookie, name) => {
  if (name && cookie.indexOf(name) === -1) {
    return {};
  }
  const pairs = cookie.trim().split(";");
  const parsedCookie = {};
  for (let pairStr of pairs) {
    pairStr = pairStr.trim();
    const valueStartPos = pairStr.indexOf("=");
    if (valueStartPos === -1) {
      continue;
    }
    const cookieName = pairStr.substring(0, valueStartPos).trim();
    if (name && name !== cookieName || !validCookieNameRegEx.test(cookieName)) {
      continue;
    }
    let cookieValue = pairStr.substring(valueStartPos + 1).trim();
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
      cookieValue = cookieValue.slice(1, -1);
    }
    if (validCookieValueRegEx.test(cookieValue)) {
      parsedCookie[cookieName] = cookieValue.indexOf("%") !== -1 ? tryDecode(cookieValue, decodeURIComponent_) : cookieValue;
      if (name) {
        break;
      }
    }
  }
  return parsedCookie;
}, "parse");
var _serialize = /* @__PURE__ */ __name((name, value, opt = {}) => {
  let cookie = `${name}=${value}`;
  if (name.startsWith("__Secure-") && !opt.secure) {
    throw new Error("__Secure- Cookie must have Secure attributes");
  }
  if (name.startsWith("__Host-")) {
    if (!opt.secure) {
      throw new Error("__Host- Cookie must have Secure attributes");
    }
    if (opt.path !== "/") {
      throw new Error('__Host- Cookie must have Path attributes with "/"');
    }
    if (opt.domain) {
      throw new Error("__Host- Cookie must not have Domain attributes");
    }
  }
  for (const key of ["domain", "path"]) {
    if (opt[key] && /[;\r\n]/.test(opt[key])) {
      throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
    }
  }
  if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
    if (opt.maxAge > 3456e4) {
      throw new Error(
        "Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration."
      );
    }
    cookie += `; Max-Age=${opt.maxAge | 0}`;
  }
  if (opt.domain && opt.prefix !== "host") {
    cookie += `; Domain=${opt.domain}`;
  }
  if (opt.path) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    if (opt.expires.getTime() - Date.now() > 3456e7) {
      throw new Error(
        "Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future."
      );
    }
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) {
    cookie += "; HttpOnly";
  }
  if (opt.secure) {
    cookie += "; Secure";
  }
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  if (opt.priority) {
    cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
  }
  if (opt.partitioned) {
    if (!opt.secure) {
      throw new Error("Partitioned Cookie must have Secure attributes");
    }
    cookie += "; Partitioned";
  }
  return cookie;
}, "_serialize");
var serialize = /* @__PURE__ */ __name((name, value, opt) => {
  value = encodeURIComponent(value);
  return _serialize(name, value, opt);
}, "serialize");

// node_modules/hono/dist/helper/cookie/index.js
var getCookie = /* @__PURE__ */ __name((c, key, prefix) => {
  const cookie = c.req.raw.headers.get("Cookie");
  if (typeof key === "string") {
    if (!cookie) {
      return void 0;
    }
    let finalKey = key;
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    }
    const obj2 = parse(cookie, finalKey);
    return obj2[finalKey];
  }
  if (!cookie) {
    return {};
  }
  const obj = parse(cookie);
  return obj;
}, "getCookie");
var generateCookie = /* @__PURE__ */ __name((name, value, opt) => {
  let cookie;
  if (opt?.prefix === "secure") {
    cookie = serialize("__Secure-" + name, value, { path: "/", ...opt, secure: true });
  } else if (opt?.prefix === "host") {
    cookie = serialize("__Host-" + name, value, {
      ...opt,
      path: "/",
      secure: true,
      domain: void 0
    });
  } else {
    cookie = serialize(name, value, { path: "/", ...opt });
  }
  return cookie;
}, "generateCookie");
var setCookie = /* @__PURE__ */ __name((c, name, value, opt) => {
  const cookie = generateCookie(name, value, opt);
  c.header("Set-Cookie", cookie, { append: true });
}, "setCookie");
var deleteCookie = /* @__PURE__ */ __name((c, name, opt) => {
  const deletedCookie = getCookie(c, name, opt?.prefix);
  setCookie(c, name, "", { ...opt, maxAge: 0 });
  return deletedCookie;
}, "deleteCookie");

// src/services/github.ts
var GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
var GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
var GITHUB_USER_URL = "https://api.github.com/user";
function getGitHubAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state
  });
  return `${GITHUB_AUTH_URL}?${params.toString()}`;
}
__name(getGitHubAuthUrl, "getGitHubAuthUrl");
async function exchangeCodeForToken(clientId, clientSecret, code) {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code
    })
  });
  const data = await response.json();
  if (data.error || !data.access_token) {
    throw new Error(`GitHub OAuth error: ${data.error || "no access_token"}`);
  }
  return data.access_token;
}
__name(exchangeCodeForToken, "exchangeCodeForToken");
async function getGitHubUser(accessToken) {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "SubDomain-Hub"
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  const user = await response.json();
  return user;
}
__name(getGitHubUser, "getGitHubUser");

// src/routes/auth.ts
init_queries();

// src/middleware/auth.ts
init_queries();
async function getSigningKey(secret) {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
__name(getSigningKey, "getSigningKey");
function base64UrlEncode(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(base64UrlDecode, "base64UrlDecode");
async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}
__name(signJwt, "signJwt");
async function verifyJwt(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const key = await getSigningKey(secret);
    const encoder = new TextEncoder();
    const signature = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(signingInput)
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    );
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJwt, "verifyJwt");
async function authMiddleware(c, next) {
  const token = getCookie(c, "session");
  if (!token) {
    return c.json({ error: "\u672A\u767B\u5F55\uFF0C\u8BF7\u5148\u901A\u8FC7 GitHub \u767B\u5F55" }, 401);
  }
  const env = c.env;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "\u4F1A\u8BDD\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" }, 401);
  }
  const user = await findUserById(env.DB, payload.sub);
  if (!user) {
    return c.json({ error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 401);
  }
  c.set("user", user);
  await next();
}
__name(authMiddleware, "authMiddleware");
async function optionalAuthMiddleware(c, next) {
  const token = getCookie(c, "session");
  if (token) {
    const env = c.env;
    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (payload) {
      const user = await findUserById(env.DB, payload.sub);
      if (user) {
        c.set("user", user);
      }
    }
  }
  await next();
}
__name(optionalAuthMiddleware, "optionalAuthMiddleware");
async function adminMiddleware(c, next) {
  const user = c.get("user");
  if (!user || !user.is_admin) {
    return c.json({ error: "\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650" }, 403);
  }
  await next();
}
__name(adminMiddleware, "adminMiddleware");
async function emailVerifiedMiddleware(c, next) {
  const env = c.env;
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "\u672A\u767B\u5F55" }, 401);
  }
  const verificationRequired = env.EMAIL_VERIFICATION_REQUIRED === "true" || env.EMAIL_VERIFICATION_REQUIRED === "1";
  if (verificationRequired && !user.email_verified) {
    return c.json({
      error: "\u90AE\u7BB1\u672A\u9A8C\u8BC1",
      code: "EMAIL_NOT_VERIFIED",
      email: user.email
    }, 403);
  }
  await next();
}
__name(emailVerifiedMiddleware, "emailVerifiedMiddleware");

// src/config.ts
function getDomainNames(env) {
  if (!env.DOMAINS) return [];
  return env.DOMAINS.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}
__name(getDomainNames, "getDomainNames");
function getBannedPrefixes(env) {
  if (!env.BANNED_PREFIXES) return [];
  return env.BANNED_PREFIXES.split(",").map((p) => p.trim().toLowerCase());
}
__name(getBannedPrefixes, "getBannedPrefixes");
function getMaxSubdomains(env) {
  return parseInt(env.MAX_SUBDOMAINS_PER_USER || "1", 10);
}
__name(getMaxSubdomains, "getMaxSubdomains");
function getMaxRecords(env) {
  return parseInt(env.MAX_RECORDS_PER_SUBDOMAIN || "20", 10);
}
__name(getMaxRecords, "getMaxRecords");
function getAdminUsers(env) {
  if (!env.ADMIN_USERS) return [];
  return env.ADMIN_USERS.split(",").map((u) => u.trim().toLowerCase());
}
__name(getAdminUsers, "getAdminUsers");
function isEmailVerificationRequired(env) {
  return env.EMAIL_VERIFICATION_REQUIRED === "true" || env.EMAIL_VERIFICATION_REQUIRED === "1";
}
__name(isEmailVerificationRequired, "isEmailVerificationRequired");
function getAllowedEmailDomains(env) {
  const whitelist = env.ALLOWED_EMAIL_DOMAINS;
  if (!whitelist || whitelist.trim() === "") {
    return [];
  }
  return whitelist.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}
__name(getAllowedEmailDomains, "getAllowedEmailDomains");
function getBackgroundImage(env) {
  return env.SITE_BACKGROUND_IMAGE || null;
}
__name(getBackgroundImage, "getBackgroundImage");
function getBackgroundOverlay(env) {
  return env.SITE_BACKGROUND_OVERLAY || "";
}
__name(getBackgroundOverlay, "getBackgroundOverlay");
function getSiteLogo(env) {
  return env.SITE_LOGO || null;
}
__name(getSiteLogo, "getSiteLogo");
function getSiteName(env) {
  return env.SITE_NAME || "SubDomain Hub";
}
__name(getSiteName, "getSiteName");
function getSiteBeian(env) {
  return env.SITE_BEIAN || "";
}
__name(getSiteBeian, "getSiteBeian");
function getFriendLinks(env) {
  if (!env.FRIEND_LINKS) return [];
  try {
    const parsed = JSON.parse(env.FRIEND_LINKS);
    if (Array.isArray(parsed)) {
      return parsed.filter((l) => l && l.name && l.url);
    }
    return [];
  } catch {
    return [];
  }
}
__name(getFriendLinks, "getFriendLinks");
function getAdminContactEmail(env) {
  return env.ADMIN_CONTACT_EMAIL || "";
}
__name(getAdminContactEmail, "getAdminContactEmail");

// src/routes/auth.ts
var auth = new Hono2();
auth.get("/github", async (c) => {
  const url = new URL(c.req.url);
  const redirectUri = `${url.origin}/auth/github/callback`;
  const state = crypto.randomUUID();
  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/"
  });
  const authUrl = getGitHubAuthUrl(c.env.GITHUB_CLIENT_ID, redirectUri, state);
  return c.redirect(authUrl);
});
auth.get("/github/callback", async (c) => {
  const { code, state } = c.req.query();
  if (!code || !state) {
    return c.json({ error: "\u7F3A\u5C11\u53C2\u6570" }, 400);
  }
  const savedState = c.req.header("cookie")?.split(";").find((c2) => c2.trim().startsWith("oauth_state="))?.split("=")[1]?.trim();
  if (savedState !== state) {
    return c.json({ error: "State \u6821\u9A8C\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" }, 400);
  }
  try {
    const accessToken = await exchangeCodeForToken(
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET,
      code
    );
    const ghUser = await getGitHubUser(accessToken);
    const adminUsers = getAdminUsers(c.env);
    const isAdmin = adminUsers.includes(ghUser.login.toLowerCase());
    const allowedDomains = getAllowedEmailDomains(c.env);
    if (allowedDomains.length > 0 && ghUser.email) {
      const emailDomain = ghUser.email.split("@")[1]?.toLowerCase();
      if (emailDomain && !allowedDomains.includes(emailDomain)) {
        return c.json({
          error: `\u90AE\u7BB1\u57DF\u540D @${emailDomain} \u4E0D\u5728\u5141\u8BB8\u5217\u8868\u4E2D`,
          allowed_domains: allowedDomains
        }, 403);
      }
    }
    const user = await upsertUser(
      c.env.DB,
      ghUser.id,
      ghUser.login,
      ghUser.avatar_url,
      ghUser.email,
      isAdmin
    );
    const verificationRequired = isEmailVerificationRequired(c.env);
    const now = Math.floor(Date.now() / 1e3);
    const token = await signJwt(
      {
        sub: user.id,
        iat: now,
        exp: now + 7 * 24 * 60 * 60
        // 7 天有效期
      },
      c.env.JWT_SECRET
    );
    deleteCookie(c, "oauth_state", { path: "/" });
    setCookie(c, "session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/"
    });
    if (verificationRequired && !user.email_verified && user.email) {
      return c.redirect("/?view=verify-email");
    }
    return c.redirect("/");
  } catch (err) {
    console.error("OAuth callback error:", err);
    const msg = err?.message || "\u672A\u77E5\u9519\u8BEF";
    const detail = /(key|JWT_SECRET|signature|importKey)/i.test(msg) ? "\u670D\u52A1\u5668 JWT_SECRET \u672A\u6B63\u786E\u914D\u7F6E" : msg;
    return c.json({ error: `\u767B\u5F55\u5931\u8D25\uFF1A${detail}`, hint: "\u68C0\u67E5 GitHub OAuth App \u7684 Authorization callback URL \u662F\u5426\u7CBE\u786E\u5339\u914D\u5F53\u524D\u57DF\u540D" }, 500);
  }
});
auth.get("/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/");
});
var auth_default = auth;

// src/types.ts
var ALLOWED_RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "SRV",
  "CAA"
];

// src/routes/api.ts
init_queries();

// src/services/cloudflare.ts
var CF_API_BASE = "https://api.cloudflare.com/client/v4";
function headers(apiToken) {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json"
  };
}
__name(headers, "headers");
async function createDnsRecord(apiToken, zoneId, record) {
  const body = {
    type: record.type,
    name: record.fullName || record.name,
    content: record.content,
    ttl: record.ttl || 1,
    proxied: record.proxied ?? false
  };
  if (record.priority !== void 0) {
    body.priority = record.priority;
  }
  if (record.comment) {
    body.comment = record.comment;
  }
  const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: headers(apiToken),
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data.result;
}
__name(createDnsRecord, "createDnsRecord");
async function updateDnsRecord(apiToken, zoneId, recordId, record) {
  const body = {
    type: record.type,
    name: record.fullName || record.name,
    content: record.content,
    ttl: record.ttl || 1,
    proxied: record.proxied ?? false
  };
  if (record.priority !== void 0) {
    body.priority = record.priority;
  }
  if (record.comment) {
    body.comment = record.comment;
  }
  const response = await fetch(
    `${CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: "PUT",
      headers: headers(apiToken),
      body: JSON.stringify(body)
    }
  );
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
  return data.result;
}
__name(updateDnsRecord, "updateDnsRecord");
async function deleteDnsRecord(apiToken, zoneId, recordId) {
  const response = await fetch(
    `${CF_API_BASE}/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: "DELETE",
      headers: headers(apiToken)
    }
  );
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(", ")}`);
  }
}
__name(deleteDnsRecord, "deleteDnsRecord");
async function verifyToken(apiToken) {
  const response = await fetch(`${CF_API_BASE}/user/tokens/verify`, {
    headers: headers(apiToken)
  });
  const data = await response.json();
  return data.success && data.result.status === "active";
}
__name(verifyToken, "verifyToken");

// src/services/crypto.ts
var ALGORITHM = "AES-GCM";
var IV_LENGTH = 12;
var TAG_LENGTH = 128;
async function getEncryptionKey(env) {
  if (!env.ENCRYPTION_KEY) {
    return null;
  }
  try {
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(env.ENCRYPTION_KEY);
    const digest = await crypto.subtle.digest("SHA-256", keyMaterial);
    return crypto.subtle.importKey(
      "raw",
      digest,
      "AES-GCM",
      false,
      ["encrypt", "decrypt"]
    );
  } catch (err) {
    console.error("Failed to create encryption key:", err);
    return null;
  }
}
__name(getEncryptionKey, "getEncryptionKey");
async function encryptText(env, plaintext) {
  const key = await getEncryptionKey(env);
  if (!key) {
    console.warn("ENCRYPTION_KEY not configured, data will not be encrypted");
    return plaintext;
  }
  try {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = encoder.encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      encoded
    );
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error("Encryption failed:", err);
    return null;
  }
}
__name(encryptText, "encryptText");
async function decryptText(env, encrypted) {
  const key = await getEncryptionKey(env);
  if (!key) {
    console.warn("ENCRYPTION_KEY not configured, returning data as-is");
    return encrypted;
  }
  try {
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    return null;
  }
}
__name(decryptText, "decryptText");
function generateToken(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateToken, "generateToken");

// src/services/cloudflare-accounts.ts
async function getUserAccounts(db, env, userId) {
  const result = await db.prepare("SELECT * FROM cloudflare_accounts WHERE user_id = ? ORDER BY is_default DESC, created_at DESC").bind(userId).all();
  const accounts2 = [];
  for (const account of result.results) {
    const decrypted = await decryptToken(env, account);
    accounts2.push({
      ...account,
      api_token_decrypted: decrypted || ""
    });
  }
  return accounts2;
}
__name(getUserAccounts, "getUserAccounts");
async function getDefaultAccount(db, env, userId) {
  const result = await db.prepare("SELECT * FROM cloudflare_accounts WHERE user_id = ? AND is_default = 1 AND is_active = 1 LIMIT 1").bind(userId).first();
  if (!result) return null;
  const decrypted = await decryptToken(env, result);
  if (!decrypted) return null;
  return { ...result, api_token: decrypted };
}
__name(getDefaultAccount, "getDefaultAccount");
async function getActiveAccounts(db, env, userId) {
  const result = await db.prepare("SELECT * FROM cloudflare_accounts WHERE user_id = ? AND is_active = 1 ORDER BY is_default DESC, created_at ASC").bind(userId).all();
  const accounts2 = [];
  for (const account of result.results) {
    const decrypted = await decryptToken(env, account);
    if (decrypted) {
      accounts2.push({ account, token: decrypted });
    }
  }
  return accounts2;
}
__name(getActiveAccounts, "getActiveAccounts");
async function createAccount(db, env, userId, accountName, apiToken, zoneId) {
  const isValid = await verifyToken(apiToken);
  if (!isValid) {
    throw new Error("Cloudflare API Token \u65E0\u6548\u6216\u5DF2\u8FC7\u671F");
  }
  const encryptedToken = await encryptText(env, apiToken);
  if (!encryptedToken) {
    throw new Error("\u52A0\u5BC6 API Token \u5931\u8D25");
  }
  let finalZoneId = zoneId;
  if (!finalZoneId && env.DOMAINS) {
    const domains = env.DOMAINS.split(",").map((d) => d.trim()).filter(Boolean);
    if (domains.length > 0) {
      const zoneId2 = await resolveZoneId(apiToken, domains[0]);
      if (zoneId2) {
        finalZoneId = zoneId2;
      }
    }
  }
  const countResult = await db.prepare("SELECT COUNT(*) as count FROM cloudflare_accounts WHERE user_id = ?").bind(userId).first();
  const isDefault = !countResult || countResult.count === 0;
  if (isDefault) {
    await db.prepare("UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?").bind(userId).run();
  }
  const result = await db.prepare(
    `INSERT INTO cloudflare_accounts (user_id, account_name, api_token, zone_id, is_active, is_default)
       VALUES (?, ?, ?, ?, 1, ?)`
  ).bind(userId, accountName, encryptedToken, finalZoneId ?? null, isDefault ? 1 : 0).run();
  const id = result.meta.last_row_id;
  const account = await getAccountById(db, userId, id);
  if (!account) throw new Error("Failed to create account");
  return account;
}
__name(createAccount, "createAccount");
async function updateAccount(db, env, userId, accountId, updates) {
  const existing = await getAccountById(db, userId, accountId);
  if (!existing) {
    throw new Error("\u8D26\u6237\u4E0D\u5B58\u5728");
  }
  if (updates.api_token) {
    const isValid = await verifyToken(updates.api_token);
    if (!isValid) {
      throw new Error("Cloudflare API Token \u65E0\u6548\u6216\u5DF2\u8FC7\u671F");
    }
  }
  if (updates.is_default) {
    await db.prepare("UPDATE cloudflare_accounts SET is_default = 0 WHERE user_id = ?").bind(userId).run();
  }
  const setParts = [];
  const values = [];
  if (updates.account_name !== void 0) {
    setParts.push("account_name = ?");
    values.push(updates.account_name);
  }
  if (updates.api_token !== void 0) {
    const encrypted = await encryptText(env, updates.api_token);
    if (!encrypted) {
      throw new Error("\u52A0\u5BC6 API Token \u5931\u8D25");
    }
    setParts.push("api_token = ?");
    values.push(encrypted);
  }
  if (updates.zone_id !== void 0) {
    setParts.push("zone_id = ?");
    values.push(updates.zone_id);
  }
  if (updates.is_active !== void 0) {
    setParts.push("is_active = ?");
    values.push(updates.is_active ? 1 : 0);
  }
  if (updates.is_default !== void 0) {
    setParts.push("is_default = ?");
    values.push(updates.is_default ? 1 : 0);
  }
  setParts.push('updated_at = datetime("now")');
  if (setParts.length === 1) {
    return existing;
  }
  values.push(userId, accountId);
  await db.prepare(`UPDATE cloudflare_accounts SET ${setParts.join(", ")} WHERE user_id = ? AND id = ?`).bind(...values).run();
  const updated = await getAccountById(db, userId, accountId);
  if (!updated) throw new Error("Failed to update account");
  return updated;
}
__name(updateAccount, "updateAccount");
async function deleteAccount(db, userId, accountId) {
  const account = await getAccountById(db, userId, accountId);
  if (!account) {
    throw new Error("\u8D26\u6237\u4E0D\u5B58\u5728");
  }
  await db.prepare("DELETE FROM cloudflare_accounts WHERE user_id = ? AND id = ?").bind(userId, accountId).run();
  if (account.is_default) {
    const firstActive = await db.prepare("SELECT id FROM cloudflare_accounts WHERE user_id = ? AND is_active = 1 LIMIT 1").bind(userId).first();
    if (firstActive) {
      await db.prepare("UPDATE cloudflare_accounts SET is_default = 1 WHERE user_id = ? AND id = ?").bind(userId, firstActive.id).run();
    }
  }
}
__name(deleteAccount, "deleteAccount");
async function getAccountById(db, userId, accountId) {
  return db.prepare("SELECT * FROM cloudflare_accounts WHERE user_id = ? AND id = ?").bind(userId, accountId).first();
}
__name(getAccountById, "getAccountById");
async function decryptToken(env, account) {
  if (!account.api_token.startsWith("{") && !account.api_token.includes("+") && !account.api_token.includes("/")) {
    return account.api_token;
  }
  return decryptText(env, account.api_token);
}
__name(decryptToken, "decryptToken");
async function resolveZoneId(apiToken, domain) {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}&status=active`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        }
      }
    );
    const data = await response.json();
    if (data.success && data.result.length > 0) {
      return data.result[0].id;
    }
  } catch (err) {
    console.error(`Failed to resolve zone ID for ${domain}:`, err);
  }
  return null;
}
__name(resolveZoneId, "resolveZoneId");
async function resolveZoneIdAndTokenFromAccounts(accounts2, domain) {
  for (const { account, token } of accounts2) {
    if (account.zone_id && account.zone_id.trim() !== "") {
      const matched = await verifyZoneIdForDomain(token, account.zone_id, domain);
      if (matched) {
        return { zoneId: account.zone_id, token };
      }
    }
  }
  for (const { token } of accounts2) {
    const zoneId = await resolveZoneId(token, domain);
    if (zoneId) {
      return { zoneId, token };
    }
  }
  return null;
}
__name(resolveZoneIdAndTokenFromAccounts, "resolveZoneIdAndTokenFromAccounts");
async function verifyZoneIdForDomain(apiToken, zoneId, domain) {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        }
      }
    );
    const data = await response.json();
    return data.success && data.result.name === domain;
  } catch {
    return false;
  }
}
__name(verifyZoneIdForDomain, "verifyZoneIdForDomain");
async function updateDnsRecordWithAccount(apiToken, zoneId, recordId, record) {
  return updateDnsRecord(apiToken, zoneId, recordId, record);
}
__name(updateDnsRecordWithAccount, "updateDnsRecordWithAccount");

// src/services/email.ts
async function sendViaMailChannels(env, options) {
  const fromEmail = env.SMTP_FROM || `noreply@${getDomainFromEnv(env)}`;
  const fromName = env.SMTP_FROM_NAME || env.SITE_NAME || "SubDomain Hub";
  try {
    const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to, name: options.toName || options.to }]
          }
        ],
        from: { email: fromEmail, name: fromName },
        subject: options.subject,
        content: [
          ...options.text ? [{ type: "text/plain", value: options.text }] : [],
          { type: "text/html", value: options.html }
        ]
      })
    });
    if (response.status === 202 || response.ok) {
      return true;
    }
    const bodyText = await response.text().catch(() => "");
    console.error("MailChannels rejected:", response.status, bodyText.slice(0, 500));
    return false;
  } catch (err) {
    console.error("MailChannels send error:", err);
    return false;
  }
}
__name(sendViaMailChannels, "sendViaMailChannels");
async function sendViaSmtpGateway(env, options) {
  const fromEmail = env.SMTP_FROM || env.SMTP_USER || "";
  const fromName = env.SMTP_FROM_NAME || env.SITE_NAME || "SubDomain Hub";
  const endpoint = env.SMTP_HOST;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${env.SMTP_USER}:${env.SMTP_PASS}`)}`
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || ""
      })
    });
    if (response.ok) {
      return true;
    }
    const bodyText = await response.text().catch(() => "");
    console.error("SMTP gateway rejected:", response.status, bodyText.slice(0, 500));
    return false;
  } catch (err) {
    console.error("SMTP gateway send error:", err);
    return false;
  }
}
__name(sendViaSmtpGateway, "sendViaSmtpGateway");
async function sendViaResend(env, options) {
  const fromEmail = env.SMTP_FROM || `noreply@${getDomainFromEnv(env)}`;
  const fromName = env.SMTP_FROM_NAME || env.SITE_NAME || "SubDomain Hub";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || ""
      })
    });
    if (response.ok) {
      return true;
    }
    const bodyText = await response.text().catch(() => "");
    console.error("Resend rejected:", response.status, bodyText.slice(0, 500));
    return false;
  } catch (err) {
    console.error("Resend send error:", err);
    return false;
  }
}
__name(sendViaResend, "sendViaResend");
function getDomainFromEnv(env) {
  const domains = env.DOMAINS?.split(",");
  return domains?.[0]?.trim() || "example.com";
}
__name(getDomainFromEnv, "getDomainFromEnv");
async function sendEmail(env, options) {
  if (env.RESEND_API_KEY) {
    return sendViaResend(env, options);
  }
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return sendViaSmtpGateway(env, options);
  }
  return sendViaMailChannels(env, options);
}
__name(sendEmail, "sendEmail");
function buildApprovalEmail(subdomain, domain, siteName, siteUrl) {
  const fqdn = `${subdomain}.${domain}`;
  return {
    to: "",
    // 由调用方填入
    subject: `\u2705 \u60A8\u7684\u5B50\u57DF\u540D ${fqdn} \u5DF2\u901A\u8FC7\u5BA1\u6838 - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#16a34a;margin:0 0 16px;">\u2705 \u5BA1\u6838\u901A\u8FC7</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    \u606D\u559C\uFF01\u60A8\u7533\u8BF7\u7684\u5B50\u57DF\u540D <strong style="font-family:monospace;background:#f0fdf4;padding:2px 8px;border-radius:4px;">${fqdn}</strong> \u5DF2\u901A\u8FC7\u7BA1\u7406\u5458\u5BA1\u6838\u3002
  </p>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    \u60A8\u73B0\u5728\u53EF\u4EE5\u767B\u5F55\u7BA1\u7406\u9762\u677F\uFF0C\u4E3A\u60A8\u7684\u5B50\u57DF\u540D\u6DFB\u52A0 DNS \u8BB0\u5F55\u4E86\u3002
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${siteUrl}" style="background:#4f46e5;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
      \u524D\u5F80\u7BA1\u7406\u9762\u677F
    </a>
  </div>
  <p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px;">
    \u6B64\u90AE\u4EF6\u7531 ${siteName} \u81EA\u52A8\u53D1\u9001\uFF0C\u8BF7\u52FF\u76F4\u63A5\u56DE\u590D\u3002
  </p>
</div>
</body></html>`,
    text: `\u606D\u559C\uFF01\u60A8\u7684\u5B50\u57DF\u540D ${fqdn} \u5DF2\u901A\u8FC7\u5BA1\u6838\u3002\u8BF7\u767B\u5F55 ${siteUrl} \u7BA1\u7406 DNS \u8BB0\u5F55\u3002`
  };
}
__name(buildApprovalEmail, "buildApprovalEmail");
function buildRejectionEmail(subdomain, domain, reason, siteName, siteUrl) {
  const fqdn = `${subdomain}.${domain}`;
  return {
    to: "",
    subject: `\u274C \u60A8\u7684\u5B50\u57DF\u540D ${fqdn} \u5BA1\u6838\u672A\u901A\u8FC7 - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#dc2626;margin:0 0 16px;">\u274C \u5BA1\u6838\u672A\u901A\u8FC7</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    \u5F88\u62B1\u6B49\uFF0C\u60A8\u7533\u8BF7\u7684\u5B50\u57DF\u540D <strong style="font-family:monospace;background:#fef2f2;padding:2px 8px;border-radius:4px;">${fqdn}</strong> \u672A\u901A\u8FC7\u7BA1\u7406\u5458\u5BA1\u6838\u3002
  </p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="color:#991b1b;font-size:14px;margin:0;"><strong>\u62D2\u7EDD\u539F\u56E0\uFF1A</strong></p>
    <p style="color:#991b1b;font-size:14px;margin:8px 0 0;">${reason}</p>
  </div>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    \u60A8\u53EF\u4EE5\u767B\u5F55\u7BA1\u7406\u9762\u677F\u91CD\u65B0\u7533\u8BF7\u5176\u4ED6\u5B50\u57DF\u540D\u3002
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${siteUrl}" style="background:#4f46e5;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
      \u524D\u5F80\u7BA1\u7406\u9762\u677F
    </a>
  </div>
  <p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px;">
    \u6B64\u90AE\u4EF6\u7531 ${siteName} \u81EA\u52A8\u53D1\u9001\uFF0C\u8BF7\u52FF\u76F4\u63A5\u56DE\u590D\u3002
  </p>
</div>
</body></html>`,
    text: `\u5F88\u62B1\u6B49\uFF0C\u60A8\u7684\u5B50\u57DF\u540D ${fqdn} \u5BA1\u6838\u672A\u901A\u8FC7\u3002\u539F\u56E0\uFF1A${reason}\u3002\u8BF7\u767B\u5F55 ${siteUrl} \u91CD\u65B0\u7533\u8BF7\u3002`
  };
}
__name(buildRejectionEmail, "buildRejectionEmail");
function buildNewRequestNotifyEmail(username, subdomain, domain, siteName, siteUrl) {
  const fqdn = `${subdomain}.${domain}`;
  return {
    to: "",
    subject: `\u{1F4CB} \u65B0\u7684\u5B50\u57DF\u540D\u7533\u8BF7: ${fqdn} - ${siteName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#4f46e5;margin:0 0 16px;">\u{1F4CB} \u65B0\u7684\u5B50\u57DF\u540D\u7533\u8BF7</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    \u7528\u6237 <strong>${username}</strong> \u7533\u8BF7\u4E86\u5B50\u57DF\u540D
    <strong style="font-family:monospace;background:#eef2ff;padding:2px 8px;border-radius:4px;">${fqdn}</strong>\uFF0C
    \u7B49\u5F85\u60A8\u7684\u5BA1\u6838\u3002
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${siteUrl}" style="background:#4f46e5;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
      \u524D\u5F80\u5BA1\u6838
    </a>
  </div>
</div>
</body></html>`,
    text: `\u7528\u6237 ${username} \u7533\u8BF7\u4E86\u5B50\u57DF\u540D ${fqdn}\uFF0C\u8BF7\u767B\u5F55 ${siteUrl} \u5BA1\u6838\u3002`
  };
}
__name(buildNewRequestNotifyEmail, "buildNewRequestNotifyEmail");

// src/routes/api.ts
var api = new Hono2();
api.use("/*", authMiddleware, emailVerifiedMiddleware);
async function resolveCfAccount(c, domain) {
  const user = c.get("user");
  const activeAccounts = await getActiveAccounts(c.env.DB, c.env, user.id);
  if (activeAccounts.length === 0) {
    return { zoneId: "", token: "", error: "\u6CA1\u6709\u53EF\u7528\u7684 Cloudflare \u8D26\u6237\uFF0C\u8BF7\u5148\u5728\u8D26\u6237\u7BA1\u7406\u4E2D\u6DFB\u52A0" };
  }
  const resolved = await resolveZoneIdAndTokenFromAccounts(activeAccounts, domain);
  if (!resolved) {
    return { zoneId: "", token: "", error: "\u57DF\u540D\u914D\u7F6E\u9519\u8BEF\uFF0C\u65E0\u6CD5\u83B7\u53D6 Zone ID" };
  }
  return resolved;
}
__name(resolveCfAccount, "resolveCfAccount");
api.get("/me", (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    github_username: user.github_username,
    avatar_url: user.avatar_url,
    email: user.email,
    is_admin: !!user.is_admin,
    created_at: user.created_at
  });
});
api.get("/domains", (c) => {
  const domains = getDomainNames(c.env);
  return c.json({
    domains,
    max_subdomains: getMaxSubdomains(c.env),
    max_records: getMaxRecords(c.env),
    banned_prefixes: getBannedPrefixes(c.env),
    allowed_record_types: ALLOWED_RECORD_TYPES
  });
});
api.get("/subdomains", async (c) => {
  const user = c.get("user");
  const subdomains = await getUserSubdomains(c.env.DB, user.id);
  return c.json({ subdomains });
});
api.post("/subdomains", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { subdomain, domain } = body;
  if (!subdomain || !domain) {
    return c.json({ error: "\u8BF7\u63D0\u4F9B\u5B50\u57DF\u540D\u548C\u57DF\u540D" }, 400);
  }
  const domainNames = getDomainNames(c.env);
  if (!domainNames.includes(domain.toLowerCase())) {
    return c.json({ error: "\u8BE5\u57DF\u540D\u4E0D\u53EF\u7528" }, 400);
  }
  const subdomainLower = subdomain.toLowerCase().trim();
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomainLower)) {
    return c.json({ error: "\u5B50\u57DF\u540D\u683C\u5F0F\u65E0\u6548\uFF0C\u4EC5\u5141\u8BB8\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u8FDE\u5B57\u7B26\uFF0C\u4E14\u4E0D\u80FD\u4EE5\u8FDE\u5B57\u7B26\u5F00\u5934\u6216\u7ED3\u5C3E" }, 400);
  }
  if (subdomainLower.length < 2) {
    return c.json({ error: "\u5B50\u57DF\u540D\u957F\u5EA6\u81F3\u5C11\u4E3A 2 \u4E2A\u5B57\u7B26" }, 400);
  }
  const bannedPrefixes = getBannedPrefixes(c.env);
  if (bannedPrefixes.includes(subdomainLower)) {
    return c.json({ error: "\u8BE5\u5B50\u57DF\u540D\u524D\u7F00\u5DF2\u88AB\u7981\u6B62\u4F7F\u7528" }, 400);
  }
  const currentCount = await countUserSubdomains(c.env.DB, user.id);
  const maxSubs = getMaxSubdomains(c.env);
  if (currentCount >= maxSubs) {
    return c.json({ error: `\u60A8\u5DF2\u8FBE\u5230\u5B50\u57DF\u540D\u6570\u91CF\u4E0A\u9650 (${maxSubs})` }, 400);
  }
  const existing = await findSubdomain(c.env.DB, subdomainLower, domain);
  if (existing) {
    return c.json({ error: "\u8BE5\u5B50\u57DF\u540D\u5DF2\u88AB\u6CE8\u518C" }, 409);
  }
  const newSubdomain = await createSubdomain(c.env.DB, user.id, subdomainLower, domain);
  try {
    const url = new URL(c.req.url);
    const siteName = c.env.SITE_NAME || "SubDomain Hub";
    const notifyEmail = buildNewRequestNotifyEmail(
      user.github_username,
      subdomainLower,
      domain,
      siteName,
      url.origin
    );
    const adminList = await getAllUsers(c.env.DB);
    const adminsWithEmail = adminList.filter((u) => u.is_admin && u.email);
    for (const admin2 of adminsWithEmail) {
      notifyEmail.to = admin2.email;
      await sendEmail(c.env, notifyEmail).catch(() => {
      });
    }
    if (adminsWithEmail.length === 0 && c.env.ADMIN_CONTACT_EMAIL) {
      notifyEmail.to = c.env.ADMIN_CONTACT_EMAIL;
      await sendEmail(c.env, notifyEmail).catch(() => {
      });
    }
  } catch {
  }
  return c.json({
    subdomain: newSubdomain,
    message: "\u5B50\u57DF\u540D\u7533\u8BF7\u5DF2\u63D0\u4EA4\uFF0C\u8BF7\u7B49\u5F85\u7BA1\u7406\u5458\u5BA1\u6838"
  }, 201);
});
api.delete("/subdomains/:id", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);
  const subdomain = await getSubdomainById(c.env.DB, id);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "\u65E0\u6743\u64CD\u4F5C\u6B64\u5B50\u57DF\u540D" }, 403);
  }
  if (subdomain.status === "approved") {
    const acc = await resolveCfAccount(c, subdomain.domain);
    if (!acc.error) {
      const records = await deleteAllRecordsForSubdomain(c.env.DB, subdomain.id);
      for (const record of records) {
        try {
          await deleteDnsRecord(acc.token, acc.zoneId, record.cf_record_id);
        } catch (err) {
          console.error(`Failed to delete CF record ${record.cf_record_id}:`, err);
        }
      }
    }
  }
  await deleteSubdomain(c.env.DB, id);
  return c.json({ success: true });
});
api.get("/subdomains/:id/records", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);
  const subdomain = await getSubdomainById(c.env.DB, id);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "\u65E0\u6743\u67E5\u770B\u6B64\u5B50\u57DF\u540D" }, 403);
  }
  if (subdomain.status !== "approved") {
    return c.json({ error: "\u5B50\u57DF\u540D\u5C1A\u672A\u901A\u8FC7\u5BA1\u6838\uFF0C\u65E0\u6CD5\u7BA1\u7406 DNS \u8BB0\u5F55" }, 403);
  }
  const records = await getSubdomainRecords(c.env.DB, subdomain.id);
  return c.json({
    records,
    subdomain: `${subdomain.subdomain}.${subdomain.domain}`,
    max_records: getMaxRecords(c.env),
    current_count: records.length
  });
});
function buildFullName(name, subdomain, domain) {
  const cleanName = name.trim().toLowerCase();
  const baseFqdn = `${subdomain}.${domain}`;
  if (!cleanName || cleanName === "@") {
    return baseFqdn;
  }
  return `${cleanName}.${baseFqdn}`;
}
__name(buildFullName, "buildFullName");
api.post("/subdomains/:id/records", async (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json();
  const subdomain = await getSubdomainById(c.env.DB, id);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "\u65E0\u6743\u64CD\u4F5C\u6B64\u5B50\u57DF\u540D" }, 403);
  }
  if (subdomain.status !== "approved") {
    return c.json({ error: "\u5B50\u57DF\u540D\u5C1A\u672A\u901A\u8FC7\u5BA1\u6838" }, 403);
  }
  if (!ALLOWED_RECORD_TYPES.includes(body.type)) {
    return c.json({ error: `\u4E0D\u652F\u6301\u7684\u8BB0\u5F55\u7C7B\u578B\uFF0C\u5141\u8BB8: ${ALLOWED_RECORD_TYPES.join(", ")}` }, 400);
  }
  if (!body.content || !body.content.trim()) {
    return c.json({ error: "\u8BB0\u5F55\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  if (body.type === "A") {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(body.content)) {
      return c.json({ error: "A \u8BB0\u5F55\u9700\u8981\u6709\u6548\u7684 IPv4 \u5730\u5740" }, 400);
    }
  }
  if (body.type === "AAAA") {
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    if (!ipv6Regex.test(body.content)) {
      return c.json({ error: "AAAA \u8BB0\u5F55\u9700\u8981\u6709\u6548\u7684 IPv6 \u5730\u5740" }, 400);
    }
  }
  if (body.type === "MX" && (body.priority === void 0 || body.priority === null)) {
    return c.json({ error: "MX \u8BB0\u5F55\u9700\u8981\u8BBE\u7F6E\u4F18\u5148\u7EA7" }, 400);
  }
  const currentCount = await countSubdomainRecords(c.env.DB, subdomain.id);
  const maxRecords = getMaxRecords(c.env);
  if (currentCount >= maxRecords) {
    return c.json({ error: `\u5DF2\u8FBE\u5230 DNS \u8BB0\u5F55\u6570\u91CF\u4E0A\u9650 (${maxRecords})` }, 400);
  }
  const fullName = buildFullName(body.name || "@", subdomain.subdomain, subdomain.domain);
  const acc = await resolveCfAccount(c, subdomain.domain);
  if (acc.error) {
    return c.json({ error: acc.error }, 500);
  }
  try {
    const cfRecord = await createDnsRecord(acc.token, acc.zoneId, {
      type: body.type,
      name: body.name || "@",
      content: body.content.trim(),
      ttl: body.ttl || 1,
      priority: body.priority,
      proxied: body.proxied ?? false,
      fullName
    });
    const record = await createDnsRecordEntry(
      c.env.DB,
      subdomain.id,
      cfRecord.id,
      body.type,
      body.name || "@",
      body.content.trim(),
      body.ttl || 1,
      body.priority ?? null,
      body.proxied ?? false,
      body.comment ?? null
    );
    return c.json({ record }, 201);
  } catch (err) {
    return c.json({ error: `\u521B\u5EFA DNS \u8BB0\u5F55\u5931\u8D25: ${err.message}` }, 500);
  }
});
api.put("/subdomains/:id/records/:recordId", async (c) => {
  const user = c.get("user");
  const subId = parseInt(c.req.param("id"), 10);
  const recordId = parseInt(c.req.param("recordId"), 10);
  const body = await c.req.json();
  const subdomain = await getSubdomainById(c.env.DB, subId);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "\u65E0\u6743\u64CD\u4F5C\u6B64\u5B50\u57DF\u540D" }, 403);
  }
  if (subdomain.status !== "approved") {
    return c.json({ error: "\u5B50\u57DF\u540D\u5C1A\u672A\u901A\u8FC7\u5BA1\u6838" }, 403);
  }
  const existingRecord = await getDnsRecordById(c.env.DB, recordId);
  if (!existingRecord || existingRecord.subdomain_id !== subdomain.id) {
    return c.json({ error: "DNS \u8BB0\u5F55\u4E0D\u5B58\u5728" }, 404);
  }
  if (!ALLOWED_RECORD_TYPES.includes(body.type)) {
    return c.json({ error: `\u4E0D\u652F\u6301\u7684\u8BB0\u5F55\u7C7B\u578B` }, 400);
  }
  if (!body.content || !body.content.trim()) {
    return c.json({ error: "\u8BB0\u5F55\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const fullName = buildFullName(body.name || "@", subdomain.subdomain, subdomain.domain);
  const acc = await resolveCfAccount(c, subdomain.domain);
  if (acc.error) {
    return c.json({ error: acc.error }, 500);
  }
  try {
    const cfRecord = await updateDnsRecord(
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
        fullName
      }
    );
    await updateDnsRecordEntry(
      c.env.DB,
      recordId,
      cfRecord.id,
      body.type,
      body.name || "@",
      body.content.trim(),
      body.ttl || 1,
      body.priority ?? null,
      body.proxied ?? false,
      body.comment ?? null
    );
    const updated = await getDnsRecordById(c.env.DB, recordId);
    return c.json({ record: updated });
  } catch (err) {
    return c.json({ error: `\u66F4\u65B0 DNS \u8BB0\u5F55\u5931\u8D25: ${err.message}` }, 500);
  }
});
api.delete("/subdomains/:id/records/:recordId", async (c) => {
  const user = c.get("user");
  const subId = parseInt(c.req.param("id"), 10);
  const recordId = parseInt(c.req.param("recordId"), 10);
  const subdomain = await getSubdomainById(c.env.DB, subId);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "\u65E0\u6743\u64CD\u4F5C\u6B64\u5B50\u57DF\u540D" }, 403);
  }
  const record = await getDnsRecordById(c.env.DB, recordId);
  if (!record || record.subdomain_id !== subdomain.id) {
    return c.json({ error: "DNS \u8BB0\u5F55\u4E0D\u5B58\u5728" }, 404);
  }
  const acc = await resolveCfAccount(c, subdomain.domain);
  if (acc.error) {
    return c.json({ error: acc.error }, 500);
  }
  try {
    await deleteDnsRecord(acc.token, acc.zoneId, record.cf_record_id);
  } catch (err) {
    console.error(`Failed to delete CF record:`, err);
  }
  await deleteDnsRecordEntry(c.env.DB, recordId);
  return c.json({ success: true });
});
api.get("/admin/subdomains", adminMiddleware, async (c) => {
  const subdomains = await getAllSubdomains(c.env.DB);
  return c.json({ subdomains });
});
api.get("/admin/pending", adminMiddleware, async (c) => {
  const pending = await getPendingSubdomains(c.env.DB);
  return c.json({ subdomains: pending });
});
api.get("/admin/users", adminMiddleware, async (c) => {
  const users = await getAllUsers(c.env.DB);
  return c.json({ users });
});
api.post("/admin/subdomains/:id/approve", adminMiddleware, async (c) => {
  const admin2 = c.get("user");
  const id = parseInt(c.req.param("id") || "0", 10);
  const subdomain = await getSubdomainById(c.env.DB, id);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.status !== "pending") {
    return c.json({ error: "\u8BE5\u5B50\u57DF\u540D\u4E0D\u5728\u5F85\u5BA1\u6838\u72B6\u6001" }, 400);
  }
  await approveSubdomain(c.env.DB, id, admin2.id);
  try {
    const owner = await findUserById(c.env.DB, subdomain.user_id);
    if (owner?.email) {
      const url = new URL(c.req.url);
      const siteName = c.env.SITE_NAME || "SubDomain Hub";
      const email = buildApprovalEmail(
        subdomain.subdomain,
        subdomain.domain,
        siteName,
        url.origin
      );
      email.to = owner.email;
      email.toName = owner.github_username;
      await sendEmail(c.env, email).catch(() => {
      });
    }
  } catch {
  }
  return c.json({ success: true, message: "\u5DF2\u901A\u8FC7\u5BA1\u6838" });
});
api.post("/admin/subdomains/:id/reject", adminMiddleware, async (c) => {
  const admin2 = c.get("user");
  const id = parseInt(c.req.param("id") || "0", 10);
  const body = await c.req.json();
  if (!body.reason || !body.reason.trim()) {
    return c.json({ error: "\u8BF7\u586B\u5199\u62D2\u7EDD\u539F\u56E0" }, 400);
  }
  const subdomain = await getSubdomainById(c.env.DB, id);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.status !== "pending") {
    return c.json({ error: "\u8BE5\u5B50\u57DF\u540D\u4E0D\u5728\u5F85\u5BA1\u6838\u72B6\u6001" }, 400);
  }
  await rejectSubdomain(c.env.DB, id, admin2.id, body.reason.trim());
  try {
    const owner = await findUserById(c.env.DB, subdomain.user_id);
    if (owner?.email) {
      const url = new URL(c.req.url);
      const siteName = c.env.SITE_NAME || "SubDomain Hub";
      const email = buildRejectionEmail(
        subdomain.subdomain,
        subdomain.domain,
        body.reason.trim(),
        siteName,
        url.origin
      );
      email.to = owner.email;
      email.toName = owner.github_username;
      await sendEmail(c.env, email).catch(() => {
      });
    }
  } catch {
  }
  return c.json({ success: true, message: "\u5DF2\u62D2\u7EDD" });
});
api.delete("/admin/subdomains/:id", adminMiddleware, async (c) => {
  const id = parseInt(c.req.param("id") || "0", 10);
  const subdomain = await getSubdomainById(c.env.DB, id);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.status === "approved") {
    const acc = await resolveCfAccount(c, subdomain.domain);
    if (!acc.error) {
      const records = await deleteAllRecordsForSubdomain(c.env.DB, subdomain.id);
      for (const record of records) {
        try {
          await deleteDnsRecord(acc.token, acc.zoneId, record.cf_record_id);
        } catch (err) {
          console.error(`Failed to delete CF record ${record.cf_record_id}:`, err);
        }
      }
    }
  }
  await deleteSubdomain(c.env.DB, id);
  return c.json({ success: true });
});
var api_default = api;

// node_modules/hono/dist/helper/html/index.js
var html = /* @__PURE__ */ __name((strings, ...values) => {
  const buffer = [""];
  for (let i = 0, len = strings.length - 1; i < len; i++) {
    buffer[0] += strings[i];
    const children = Array.isArray(values[i]) ? values[i].flat(Infinity) : [values[i]];
    for (let i2 = 0, len2 = children.length; i2 < len2; i2++) {
      const child = children[i2];
      if (typeof child === "string") {
        escapeToBuffer(child, buffer);
      } else if (typeof child === "number") {
        ;
        buffer[0] += child;
      } else if (typeof child === "boolean" || child === null || child === void 0) {
        continue;
      } else if (typeof child === "object" && child.isEscaped) {
        if (child.callbacks) {
          buffer.unshift("", child);
        } else {
          const tmp = child.toString();
          if (tmp instanceof Promise) {
            buffer.unshift("", tmp);
          } else {
            buffer[0] += tmp;
          }
        }
      } else if (child instanceof Promise) {
        buffer.unshift("", child);
      } else {
        escapeToBuffer(child.toString(), buffer);
      }
    }
  }
  buffer[0] += strings.at(-1);
  return buffer.length === 1 ? "callbacks" in buffer ? raw(resolveCallbackSync(raw(buffer[0], buffer.callbacks))) : raw(buffer[0]) : stringBufferToString(buffer, buffer.callbacks);
}, "html");

// src/routes/pages.ts
var pages = new Hono2();
pages.use("/*", optionalAuthMiddleware);
pages.get("/", (c) => {
  const user = c.get("user");
  const siteName = getSiteName(c.env);
  const backgroundImage = getBackgroundImage(c.env);
  const backgroundOverlay = getBackgroundOverlay(c.env);
  const siteLogo = getSiteLogo(c.env);
  const beian = getSiteBeian(c.env);
  const friendLinks = getFriendLinks(c.env);
  const adminContactEmail = getAdminContactEmail(c.env);
  return c.html(renderPage({
    siteName,
    user,
    backgroundImage,
    backgroundOverlay,
    siteLogo,
    beian,
    friendLinks,
    adminContactEmail
  }));
});
var _a;
function renderPage({
  siteName,
  user,
  backgroundImage,
  backgroundOverlay,
  siteLogo,
  beian,
  friendLinks,
  adminContactEmail
}) {
  const bgStyle = backgroundImage ? `background-image: url('${backgroundImage}'); background-size: cover; background-position: center; background-attachment: fixed;` : "";
  const overlayStyle = backgroundImage ? `position: relative;` : "";
  const defaultLogoSvg = `<svg viewBox="0 0 64 64" width="38" height="38" xmlns="http://www.w3.org/2000/svg" style="border-radius:12px"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="14" fill="url(#lg)"/><circle cx="32" cy="32" r="14" fill="#fff" opacity=".95"/><g fill="#3b82f6"><circle cx="27" cy="28" r="4"/><circle cx="37" cy="28" r="4"/><circle cx="28" cy="25" r="2.2"/><circle cx="38" cy="25" r="2.2"/><path d="M23 34c2-4 5-3 5-3h8s3-1 5 3l1 4H22z" fill="#2563eb"/><path d="M24 35c1.6-2.6 4-2 4-2h8s2.4-.6 4 2" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/></g></svg>`;
  return html(_a || (_a = __template(['<!DOCTYPE html>\n<html lang="zh-CN" data-theme="dark">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>', `</title>
  <style>
    :root {
      --font-sans: 'Comic Sans MS', 'YouYuan', '\u5E7C\u5706', 'KaiTi', '\u6977\u4F53', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
      --font-mono: 'Comic Sans MS', 'Consolas', 'Courier New', monospace;
      --radius: 16px;
      --radius-sm: 10px;
      --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* ========== \u84DD\u767D\u8272\u7CFB\u4E3B\u9898 ========== */
    [data-theme="dark"] {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --bg-card: #1e293b;
      --bg-hover: #334155;
      --bg-input: #0f172a;
      --border: #334155;
      --border-hover: #475569;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --accent-bg: rgba(59, 130, 246, 0.15);
      --accent-border: rgba(59, 130, 246, 0.4);
      --danger: #ef4444;
      --danger-hover: #f87171;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --success: #22c55e;
      --success-bg: rgba(34, 197, 94, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
      --pending-bg: rgba(139, 92, 246, 0.15);
      --pending: #8b5cf6;
      --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.3);
      --glass-bg: rgba(30, 41, 59, 0.8);
      --bg-image: var(--bg-image-dark);
      --overlay-fallback: rgba(15, 23, 42, 0.7);
    }

    [data-theme="light"] {
      --bg-primary: #eff5ff;
      --bg-secondary: #ffffff;
      --bg-tertiary: #e4efff;
      --bg-card: #ffffff;
      --bg-hover: #e4efff;
      --bg-input: #ffffff;
      --border: #d4e4f8;
      --border-hover: #b3cef6;
      --text-primary: #0b2b4f;
      --text-secondary: #3c5e85;
      --text-muted: #7b9dc2;
      --accent: #1d7dfa;
      --accent-hover: #3b82f6;
      --accent-bg: rgba(29, 125, 250, 0.10);
      --accent-border: rgba(29, 125, 250, 0.32);
      --danger: #d64040;
      --danger-hover: #ef4444;
      --danger-bg: rgba(214, 64, 64, 0.08);
      --success: #14914b;
      --success-bg: rgba(20, 145, 75, 0.08);
      --warning: #d97706;
      --warning-bg: rgba(217, 119, 6, 0.08);
      --pending-bg: rgba(124, 58, 237, 0.08);
      --pending: #7c3aed;
      --shadow: 0 8px 26px rgba(29, 78, 138, 0.10);
      --shadow-sm: 0 4px 12px rgba(29, 78, 138, 0.06);
      --glass-bg: rgba(255, 255, 255, 0.80);
      --overlay-fallback: rgba(230, 243, 255, 0.70);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-sans);
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      transition: background var(--transition), color var(--transition);
      position: relative;
    }

    /* \u80CC\u666F\u56FE\u4E0E\u906E\u7F69 */
    .bg-image-wrapper {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
    }
    .bg-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: blur(2px);
      transform: scale(1.05);
    }
    .bg-overlay {
      position: absolute;
      inset: 0;
      background: `, `;
    }
    a { color: var(--accent); text-decoration: none; transition: all var(--transition); }
    a:hover { color: var(--accent-hover); }

    .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }

    /* ========== \u53EF\u7231\u73BB\u7483\u6001 Header ========== */
    .header {
      background: var(--glass-bg);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid var(--border);
      padding: 16px 0;
      position: sticky;
      top: 0;
      z-index: 100;
      transition: all var(--transition);
    }
    .header .container { display: flex; align-items: center; justify-content: space-between; }
    .logo { 
      font-size: 20px; 
      font-weight: 700; 
      color: var(--text-primary); 
      display: flex; 
      align-items: center; 
      gap: 10px;
      transition: all var(--transition);
    }
    .logo-icon { 
      width: 36px; 
      height: 36px; 
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      border-radius: 12px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: white; 
      font-size: 18px; 
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .logo:hover .logo-icon {
      transform: scale(1.1) rotate(-5deg);
    }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .user-info { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      padding: 8px 14px; 
      background: var(--bg-tertiary); 
      border-radius: var(--radius-sm); 
      border: 1px solid var(--border);
      transition: all var(--transition);
    }
    .user-info:hover {
      border-color: var(--border-hover);
      transform: translateY(-1px);
    }
    .user-avatar { 
      width: 28px; 
      height: 28px; 
      border-radius: 50%; 
      border: 2px solid var(--accent);
      transition: transform 0.3s ease;
    }
    .user-info:hover .user-avatar {
      transform: scale(1.1);
    }
    .user-name { 
      font-size: 14px; 
      font-weight: 500; 
      color: var(--text-primary); 
    }

    /* ========== \u679C\u51BB\u6309\u94AE\u6837\u5F0F ========== */
    .btn { 
      display: inline-flex; 
      align-items: center; 
      justify-content: center; 
      gap: 8px; 
      padding: 12px 24px; 
      border: none; 
      border-radius: var(--radius-sm); 
      font-size: 14px; 
      font-weight: 600; 
      font-family: var(--font-sans); 
      cursor: pointer; 
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      white-space: nowrap; 
      text-decoration: none;
      position: relative;
      overflow: hidden;
    }
    .btn:active {
      transform: scale(0.95);
    }
    .btn:disabled { 
      opacity: 0.5; 
      cursor: not-allowed;
      transform: none !important;
    }
    .btn-primary { 
      background: linear-gradient(135deg, #3b82f6, #2563eb); 
      color: white; 
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    }
    .btn-primary:active {
      transform: scale(0.95) translateY(0);
    }
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }
    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
    }
    .btn-danger:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }
    .btn-success {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
    }
    .btn-success:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
    }
    [data-theme="light"] .btn-primary {
      box-shadow: 0 4px 14px rgba(29, 125, 250, 0.25);
    }
    [data-theme="light"] .btn-primary:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(29, 125, 250, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-secondary {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    [data-theme="light"] .btn-secondary:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgba(29, 78, 138, 0.10);
      transform: translateY(-2px);
    }
    [data-theme="light"] .btn-danger {
      box-shadow: 0 4px 14px rgba(214, 64, 64, 0.25);
    }
    [data-theme="light"] .btn-danger:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(214, 64, 64, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-success {
      box-shadow: 0 4px 14px rgba(20, 145, 75, 0.25);
    }
    [data-theme="light"] .btn-success:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(20, 145, 75, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-github {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    }
    [data-theme="light"] .btn-github:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      transform: translateY(-3px);
    }
    .btn-ghost { 
      background: transparent; 
      color: var(--text-secondary); 
      border: none; 
      padding: 8px; 
      border-radius: var(--radius-sm);
    }
    .btn-ghost:hover { 
      color: var(--text-primary); 
      background: var(--bg-hover);
      transform: scale(1.1);
    }
    .btn-sm { 
      padding: 8px 16px; 
      font-size: 13px; 
    }
    .btn-github { 
      background: linear-gradient(135deg, #24292e, #373e47); 
      color: white; 
      border: none; 
      padding: 14px 32px; 
      font-size: 16px; 
      border-radius: var(--radius);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
    }
    .btn-github:hover { 
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .btn-github:active {
      transform: scale(0.95) translateY(0);
    }

    /* \u679C\u51BB\u52A8\u753B */
    @keyframes jelly {
      0% { transform: scale(1, 1); }
      30% { transform: scale(1.25, 0.75); }
      40% { transform: scale(0.75, 1.25); }
      50% { transform: scale(1.15, 0.85); }
      65% { transform: scale(0.95, 1.05); }
      75% { transform: scale(1.05, 0.95); }
      100% { transform: scale(1, 1); }
    }
    .btn-jelly:active {
      animation: jelly 0.6s ease;
    }

    /* \u70B9\u51FB\u6CE2\u7EB9\u6548\u679C */
    .btn::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }
    .btn:active::after {
      width: 200px;
      height: 200px;
      opacity: 0;
    }

    .theme-toggle { 
      width: 40px; 
      height: 40px; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      cursor: pointer; 
      background: var(--bg-tertiary); 
      border: 1px solid var(--border); 
      color: var(--text-secondary); 
      font-size: 18px; 
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .theme-toggle:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--border-hover);
      transform: rotate(180deg) scale(1.1);
    }
    [data-theme="light"] .theme-toggle:hover {
      background: var(--accent-bg);
      color: var(--accent);
      border-color: var(--accent-border);
    }

    /* ========== \u53EF\u7231\u5361\u7247 ========== */
    .card { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 24px; 
      transition: all var(--transition);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
      opacity: 0;
      transition: opacity var(--transition);
    }
    .card-hover:hover { 
      border-color: var(--border-hover); 
      box-shadow: var(--shadow-sm);
      transform: translateY(-4px);
    }
    .card-hover:hover::before {
      opacity: 1;
    }
    .card:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-sm);
      transform: translateY(-3px);
    }
    [data-theme="light"] .card:hover::before {
      opacity: 1;
    }
    .card-title { 
      font-size: 16px; 
      font-weight: 600; 
      margin-bottom: 16px; 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
    }

    /* ========== \u8868\u5355\u6837\u5F0F ========== */
    .form-group { margin-bottom: 16px; }
    .form-label { 
      display: block; 
      font-size: 13px; 
      font-weight: 600; 
      color: var(--text-secondary); 
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .form-input, .form-select { 
      width: 100%; 
      padding: 12px 16px; 
      background: var(--bg-input); 
      border: 2px solid var(--border); 
      border-radius: var(--radius-sm); 
      color: var(--text-primary); 
      font-size: 14px; 
      font-family: var(--font-sans); 
      transition: all var(--transition); 
      outline: none;
    }
    .form-input:focus, .form-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-bg);
      transform: translateY(-2px);
    }
    [data-theme="light"] .form-input:focus,
    [data-theme="light"] .form-select:focus {
      box-shadow: 0 0 0 6px rgba(29, 125, 250, 0.12);
      transform: translateY(-2px);
      border-color: var(--accent-hover);
    }
    .form-input::placeholder { color: var(--text-muted); }
    .form-select {
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
      padding-right: 38px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 14px;
      position: relative;
    }
    .form-select:hover { border-color: var(--accent-hover); }
    .form-select option { background: var(--bg-card); color: var(--text-primary); padding: 6px 10px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-row-3 { display: grid; grid-template-columns: 140px 1fr 1fr; gap: 12px; }
    .form-inline { display: flex; align-items: flex-end; gap: 8px; }
    .form-inline .form-group { flex: 1; margin-bottom: 0; }
    .subdomain-input-group { display: flex; align-items: center; gap: 0; }
    .subdomain-input-group .form-input { 
      border-radius: var(--radius-sm) 0 0 var(--radius-sm); 
      border-right: none; 
      text-align: right;
    }
    .subdomain-input-group .domain-suffix { 
      padding: 12px 16px; 
      background: var(--bg-tertiary); 
      border: 2px solid var(--border); 
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0; 
      color: var(--text-secondary); 
      font-size: 14px; 
      white-space: nowrap; 
      font-family: var(--font-mono);
      border-left: none;
    }
    textarea.form-input { resize: vertical; min-height: 80px; }

    /* ========== \u8868\u683C ========== */
    .table-wrap { overflow-x: auto; border-radius: var(--radius-sm); }
    table { width: 100%; border-collapse: collapse; }
    th { 
      text-align: left; 
      padding: 12px 16px; 
      font-size: 12px; 
      font-weight: 600; 
      color: var(--text-muted); 
      text-transform: uppercase; 
      letter-spacing: 0.08em;
      border-bottom: 2px solid var(--border);
      background: var(--bg-tertiary);
    }
    td { 
      padding: 14px 16px; 
      font-size: 14px; 
      border-bottom: 1px solid var(--border); 
      color: var(--text-primary); 
      transition: background var(--transition);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { 
      background: var(--bg-hover);
    }
    .mono { 
      font-family: var(--font-mono); 
      font-size: 13px;
      background: var(--bg-tertiary);
      padding: 4px 8px;
      border-radius: 4px;
    }

    /* ========== \u6807\u7B7E ========== */
    .badge { 
      display: inline-flex; 
      align-items: center; 
      gap: 4px;
      padding: 4px 12px; 
      border-radius: 999px; 
      font-size: 12px; 
      font-weight: 600;
      transition: all var(--transition);
    }
    .badge-type { 
      background: var(--accent-bg); 
      color: var(--accent); 
      border: 1px solid var(--accent-border);
    }
    .badge-proxied { 
      background: var(--warning-bg); 
      color: var(--warning);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
    }
    .badge-pending { 
      background: var(--pending-bg); 
      color: var(--pending);
      animation: pulse 2s ease-in-out infinite;
    }
    .badge-approved { 
      background: var(--success-bg); 
      color: var(--success);
    }
    .badge-rejected { 
      background: var(--danger-bg); 
      color: var(--danger);
    }

    /* \u8109\u51B2\u52A8\u753B */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* ========== Hero \u533A\u57DF ========== */
    .hero { 
      text-align: center; 
      padding: 80px 0 60px; 
    }
    .hero h1 { 
      font-size: 52px; 
      font-weight: 800; 
      letter-spacing: -0.03em; 
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      -webkit-background-clip: text; 
      -webkit-text-fill-color: transparent; 
      background-clip: text; 
      margin-bottom: 20px;
      animation: gradientShift 3s ease infinite;
      background-size: 200% 200%;
    }
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .hero p { 
      font-size: 18px; 
      color: var(--text-secondary); 
      max-width: 520px; 
      margin: 0 auto 32px;
      line-height: 1.7;
    }
    .features { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 20px; 
      margin: 48px 0; 
    }
    .feature-card { 
      text-align: center; 
      padding: 32px 20px;
      transition: all var(--transition);
    }
    .feature-card:hover {
      transform: translateY(-8px);
    }
    .feature-icon { 
      font-size: 40px; 
      margin-bottom: 16px;
      display: inline-block;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .feature-card:hover .feature-icon {
      transform: scale(1.2) rotate(-10deg);
    }
    .feature-card h3 { 
      font-size: 16px; 
      font-weight: 600; 
      margin-bottom: 8px; 
    }
    .feature-card p { 
      font-size: 13px; 
      color: var(--text-secondary); 
    }

    /* ========== Dashboard ========== */
    .dashboard { padding: 32px 0; }
    .section { margin-bottom: 32px; }
    .section-header { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      margin-bottom: 20px; 
    }
    .section-title { 
      font-size: 24px; 
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .empty { 
      text-align: center; 
      padding: 64px 20px; 
      color: var(--text-muted); 
    }
    .empty-icon { 
      font-size: 64px; 
      margin-bottom: 16px;
      opacity: 0.5;
    }

    /* ========== \u5B50\u57DF\u540D\u5361\u7247 ========== */
    .subdomain-card { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      padding: 20px 24px; 
      margin-bottom: 12px;
      transition: all var(--transition);
    }
    .subdomain-card:hover {
      transform: translateX(8px);
    }
    .subdomain-info h4 { 
      font-size: 18px; 
      font-weight: 700; 
      font-family: var(--font-mono);
      margin-bottom: 4px;
    }
    .subdomain-info p { 
      font-size: 13px; 
      color: var(--text-secondary); 
      margin-top: 4px;
    }
    .subdomain-actions { 
      display: flex; 
      gap: 8px; 
      align-items: center; 
    }

    .status-note { 
      margin-top: 10px; 
      padding: 12px 16px; 
      border-radius: var(--radius-sm); 
      font-size: 13px; 
      display: flex;
      align-items: center;
      gap: 8px;
      border-left: 3px solid;
    }
    .status-note.pending { 
      background: var(--pending-bg); 
      color: var(--pending);
      border-left-color: var(--pending);
    }
    .status-note.rejected { 
      background: var(--danger-bg); 
      color: var(--danger);
      border-left-color: var(--danger);
    }

    /* ========== DNS \u7BA1\u7406 ========== */
    .dns-header { 
      display: flex; 
      align-items: center; 
      gap: 12px; 
      margin-bottom: 24px; 
    }
    .dns-header h2 { 
      font-size: 24px; 
      font-weight: 700;
    }
    .back-link { 
      display: inline-flex; 
      align-items: center; 
      gap: 6px; 
      color: var(--text-secondary); 
      font-size: 14px;
      font-weight: 500;
      transition: all var(--transition);
    }
    .back-link:hover { 
      color: var(--text-primary);
      transform: translateX(-4px);
    }
    .record-form { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 24px; 
      margin-bottom: 24px;
      transition: all var(--transition);
    }
    .record-form:hover {
      border-color: var(--border-hover);
    }
    .record-form-title { 
      font-size: 14px; 
      font-weight: 600; 
      margin-bottom: 16px; 
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ========== \u4EE3\u7406\u5F00\u5173\u6309\u94AE\uFF08\u9EC4\u8272\u4E91\u6735\uFF09 ========== */
    .proxied-toggle {
      position: relative;
      width: 56px;
      height: 28px;
      background: var(--bg-tertiary);
      border-radius: 999px;
      border: 2px solid var(--border);
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .proxied-toggle.active {
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      border-color: #f59e0b;
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
    }
    .proxied-toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .proxied-toggle.active::after {
      transform: translateX(28px);
    }
    .proxied-toggle:hover {
      transform: scale(1.1);
    }
    .proxied-toggle:active {
      transform: scale(0.95);
    }

    /* \u4EE3\u7406\u72B6\u6001\u6307\u793A\u5668 */
    .proxy-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      transition: all var(--transition);
    }
    .proxy-indicator.proxied {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #92400e;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
    }
    .proxy-indicator.direct {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }

    /* ========== \u7BA1\u7406\u6807\u7B7E\u9875 ========== */
    .tabs { 
      display: flex; 
      gap: 4px; 
      margin-bottom: 20px; 
      border-bottom: 1px solid var(--border); 
      padding-bottom: 0; 
    }
    .tab { 
      padding: 12px 24px; 
      cursor: pointer; 
      font-size: 14px; 
      font-weight: 600; 
      color: var(--text-secondary); 
      border-bottom: 2px solid transparent; 
      transition: all var(--transition); 
      background: none; 
      border-top: none; 
      border-left: none; 
      border-right: none; 
      font-family: var(--font-sans);
      position: relative;
    }
    .tab:hover { 
      color: var(--text-primary); 
      transform: translateY(-2px);
    }
    .tab.active { 
      color: var(--accent); 
      border-bottom-color: var(--accent);
    }
    .tab.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 2px;
      background: var(--accent);
      border-radius: 2px;
    }
    .tab .tab-count { 
      background: var(--danger); 
      color: white; 
      border-radius: 999px; 
      padding: 2px 8px; 
      font-size: 11px; 
      margin-left: 6px;
      animation: pulse 2s ease-in-out infinite;
    }

    /* ========== \u6A21\u6001\u6846 ========== */
    .modal-overlay { 
      position: fixed; 
      inset: 0; 
      background: rgba(0, 0, 0, 0.6); 
      backdrop-filter: blur(8px);
      display: flex; 
      align-items: center; 
      justify-content: center; 
      z-index: 200; 
      opacity: 0; 
      pointer-events: none; 
      transition: opacity 0.3s ease; 
    }
    .modal-overlay.active { 
      opacity: 1; 
      pointer-events: auto; 
    }
    .modal { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 32px; 
      max-width: 480px; 
      width: 90%; 
      box-shadow: var(--shadow); 
      transform: scale(0.9) translateY(20px); 
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .modal-overlay.active .modal { 
      transform: scale(1) translateY(0); 
    }
    .modal h3 { 
      font-size: 20px; 
      font-weight: 700; 
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal p { 
      color: var(--text-secondary); 
      font-size: 14px; 
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .modal-actions { 
      display: flex; 
      gap: 10px; 
      justify-content: flex-end; 
    }

    /* ========== Toast \u901A\u77E5 ========== */
    .toast-container { 
      position: fixed; 
      top: 80px; 
      right: 20px; 
      z-index: 300; 
      display: flex; 
      flex-direction: column; 
      gap: 8px; 
    }
    .toast { 
      padding: 14px 24px; 
      border-radius: var(--radius-sm); 
      font-size: 14px; 
      font-weight: 500; 
      box-shadow: var(--shadow); 
      animation: slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                 slideOutRight 0.4s ease 2.6s forwards; 
      max-width: 380px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast-success { 
      background: linear-gradient(135deg, #22c55e, #16a34a); 
      color: white; 
    }
    .toast-error { 
      background: linear-gradient(135deg, #ef4444, #dc2626); 
      color: white; 
    }
    .toast-info { 
      background: linear-gradient(135deg, #3b82f6, #2563eb); 
      color: white; 
    }
    @keyframes slideInRight { 
      from { transform: translateX(120%); opacity: 0; } 
      to { transform: translateX(0); opacity: 1; } 
    }
    @keyframes slideOutRight { 
      to { opacity: 0; transform: translateX(120%); } 
    }

    /* ========== \u52A0\u8F7D\u52A8\u753B ========== */
    .spinner { 
      display: inline-block; 
      width: 24px; 
      height: 24px; 
      border: 3px solid var(--border); 
      border-top-color: var(--accent); 
      border-radius: 50%; 
      animation: spin 0.8s linear infinite; 
    }
    @keyframes spin { 
      to { transform: rotate(360deg); } 
    }
    .loading-center { 
      display: flex; 
      justify-content: center; 
      padding: 60px; 
    }

    /* ========== \u590D\u9009\u6846 ========== */
    .checkbox-label { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      cursor: pointer; 
      font-size: 14px; 
      color: var(--text-secondary);
      transition: all var(--transition);
    }
    .checkbox-label:hover {
      color: var(--text-primary);
    }
    .checkbox-label input[type="checkbox"] { 
      width: 18px; 
      height: 18px; 
      accent-color: var(--accent);
      cursor: pointer;
    }

    /* ========== \u5BA1\u6838\u5361\u7247 ========== */
    .review-card { 
      border-left: 4px solid var(--pending); 
    }
    .review-card .review-meta { 
      display: flex; 
      gap: 16px; 
      align-items: center; 
      font-size: 13px; 
      color: var(--text-secondary); 
      margin-top: 8px; 
      flex-wrap: wrap;
    }

    /* ========== \u54CD\u5E94\u5F0F ========== */
    @media (max-width: 768px) {
      .hero h1 { font-size: 36px; }
      .features { grid-template-columns: 1fr; }
      .form-row, .form-row-3 { grid-template-columns: 1fr; }
      .subdomain-card { 
        flex-direction: column; 
        gap: 16px; 
        align-items: flex-start; 
      }
      .user-name { display: none; }
      .section-title { font-size: 20px; }
    }

    /* ========== \u6EDA\u52A8\u6761 ========== */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { 
      background: var(--border); 
      border-radius: 4px; 
    }
    ::-webkit-scrollbar-thumb:hover { 
      background: var(--border-hover); 
    }

    /* ========== \u52A8\u753B ========== */
    .fade-in { 
      animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
    }
    @keyframes fadeIn { 
      from { opacity: 0; transform: translateY(12px); } 
      to { opacity: 1; transform: translateY(0); } 
    }

    .jelly {
      animation: jelly 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .bounce-in {
      animation: bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes bounceIn {
      0% { transform: scale(0.8); opacity: 0; }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }

    /* \u6D6E\u52A8\u52A8\u753B */
    .float {
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    /* \u5F39\u8DF3\u52A8\u753B */
    .bounce {
      animation: bounce 2s ease-in-out infinite;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-15px); }
    }

    /* \u6447\u6643\u52A8\u753B */
    .shake:hover {
      animation: shake 0.5s ease;
    }

    /* \u6301\u7EED\u8109\u52A8\u53D1\u5149\uFF08Cloudflare \u52A0\u901F\u56FE\u6807\u7528\uFF0C\u81EA\u52A8\u64AD\u653E\uFF09 */
    .pulse-soft {
      display: inline-block;
      animation: pulseSoft 2.4s ease-in-out infinite;
      filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.5));
    }
    @keyframes pulseSoft {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.18); opacity: 0.75; }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .footer { 
      text-align: center; 
      padding: 40px 0; 
      color: var(--text-muted); 
      font-size: 13px; 
      border-top: 1px solid var(--border); 
      margin-top: 60px; 
    }
    .footer-friendlinks {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .friend-link-label {
      font-weight: 600;
      color: var(--text-secondary);
    }
    .friend-link {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .friend-link:hover {
      color: white;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-color: transparent;
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
    }
    .contact-admin-btn {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      padding: 10px 20px;
    }
    .contact-admin-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(139, 92, 246, 0.4);
      color: #fff;
    }

    /* \u8D26\u6237\u9009\u62E9\u4E0B\u62C9 */
    .account-select {
      position: relative;
    }
    .account-select-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-top: 4px;
      box-shadow: var(--shadow);
      z-index: 50;
      max-height: 200px;
      overflow-y: auto;
    }
    .account-select-item {
      padding: 10px 14px;
      cursor: pointer;
      transition: all var(--transition);
      border-bottom: 1px solid var(--border);
    }
    .account-select-item:last-child {
      border-bottom: none;
    }
    .account-select-item:hover {
      background: var(--bg-hover);
    }
    .account-select-item.active {
      background: var(--accent-bg);
      color: var(--accent);
    }

    /* ========== \u516C\u544A\u6A2A\u5E45 ========== */
    .announcements-container {
      margin-top: 16px;
    }
    .announcement-card {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12));
      border: 1px solid var(--accent-border);
      border-radius: var(--radius);
      padding: 14px 18px;
      margin-bottom: 12px;
      backdrop-filter: blur(8px);
      transition: all var(--transition);
    }
    .announcement-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .announcement-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .announcement-date {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 400;
      margin-left: auto;
    }
    .announcement-content {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.7;
    }
    /* ===== \u516C\u544A\u8F6E\u64AD + \u7F6E\u9876 + \u7F29\u7565\u5C55\u5F00 ===== */
    .announcement-carousel {
      position: relative;
      /* \u4E0D\u80FD here overflow:hidden\uFF0C\u5426\u5219\u5C55\u5F00\u540E\u7684\u5168\u6587\u4F1A\u88AB\u88C1\u526A\uFF1B
         \u7528 visible\uFF0C\u8BA9\u300C\u5C55\u5F00\u300D\u53EF\u81EA\u7136\u6491\u9AD8\u9605\u8BFB\u5168\u6587\u3002\u672A\u5C55\u5F00\u65F6\u5404\u5361\u7247
         \u7F29\u7565\u540C\u9AD8\uFF083 \u884C\uFF09+ min-height \u515C\u5E95\uFF0C\u5207\u6362\u8F6E\u64AD\u4E0D\u4E0A\u4E0B\u8DF3\u52A8\u3002 */
      overflow: visible;
      min-height: 134px;
    }
    /* \u8F6E\u64AD\u5185\u6807\u9898\u5355\u884C\u7701\u7565\uFF0C\u9632\u6B62\u6807\u9898\u6362\u884C\u9020\u6210\u9AD8\u5EA6\u5DEE\u5F02 */
    .announcement-carousel .announcement-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* \u7F29\u7565\u533A\u56FA\u5B9A 3 \u884C\u5360\u4F4D\u9AD8\u5EA6\uFF08\u4E0E -webkit-line-clamp:3 \u4E00\u81F4\uFF0C1.7 \u884C\u9AD8\uFF09\uFF0C
       \u4FDD\u8BC1\u672A\u5C55\u5F00\u65F6\u6BCF\u5F20\u516C\u544A\u5361\u7247\u540C\u9AD8\uFF0C\u5207\u6362\u8F6E\u64AD\u5E73\u7A33 */
    .announcement-carousel .announcement-content.collapsed {
      height: 5.1em;
      overflow: hidden;
      white-space: normal;
    }
    .carousel-slide {
      display: none;
    }
    .carousel-slide.active {
      display: block;
      animation: fadeInUp var(--transition);
    }
    .announcement-card.pinned {
      border-color: var(--accent);
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.18);
    }
    .pin-badge {
      display: inline-block;
      font-size: 10px;
      color: #fff;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 999px;
      padding: 1px 8px;
      margin-left: 6px;
      font-weight: 600;
    }
    .announcement-content.collapsed {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .announcement-toggle-btn {
      margin-top: 6px;
      padding: 2px 12px;
      font-size: 12px;
      cursor: pointer;
      color: var(--accent);
      background: transparent;
      border: 1px solid var(--accent-border);
      border-radius: 999px;
      transition: all var(--transition);
    }
    .announcement-toggle-btn:hover {
      border-color: var(--accent);
      background: rgba(59, 130, 246, 0.1);
    }
    .carousel-dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 8px;
    }
    .carousel-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--text-muted);
      cursor: pointer;
      opacity: 0.5;
      transition: all var(--transition);
    }
    .carousel-dot.active {
      background: var(--accent);
      opacity: 1;
      width: 18px;
    }

    /* \u90AE\u7BB1\u9A8C\u8BC1\u63D0\u793A */
    .verify-banner {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      padding: 16px 20px;
      border-radius: var(--radius);
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    }
    .verify-banner p {
      margin: 0;
      font-size: 14px;
    }
    .verify-banner .btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .verify-banner .btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .verify-banner-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
      flex-wrap: wrap;
    }
    .verify-binder {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .verify-binder .form-input {
      max-width: 300px;
      padding: 9px 14px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.95);
      color: #1f2937;
      border-color: rgba(255, 255, 255, 0.4);
      font-family: var(--font-mono);
    }
    .verify-binder .form-input:focus {
      border-color: #fff;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.25);
      transform: none;
    }
    .verify-banner-row .btn-primary {
      background: #fff;
      color: #2563eb;
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    }
    .verify-banner-row .btn-primary:hover {
      background: #f0f4ff;
      color: #1d4ed8;
      transform: translateY(-2px);
    }

    /* \u591A\u8D26\u6237\u7BA1\u7406\u5361\u7247 */
    .account-card {
      padding: 16px 20px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .account-info {
      flex: 1;
    }
    .account-info h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .account-info p {
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }
    .account-actions {
      display: flex;
      gap: 8px;
    }

    /* \u5F00\u5173\u6837\u5F0F */
    .switch {
      position: relative;
      width: 48px;
      height: 24px;
      background: var(--bg-tertiary);
      border-radius: 999px;
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.3s ease;
      flex-shrink: 0;
    }
    .switch.active {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border-color: #3b82f6;
    }
    .switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: white;
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .switch.active::after {
      transform: translateX(24px);
    }

    /* ========== \u53EF\u7231 UI \u589E\u5F3A ========== */
    /* \u54C1\u724C\u6E10\u53D8\u6587\u5B57 */
    .gradient-text {
      background: linear-gradient(120deg, #60a5fa, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    /* \u7279\u6027\u5361\u7247\u60AC\u6D6E\u8F7B\u5FAE\u4E0A\u6D6E + \u67D4\u548C\u5149\u6655 */
    .feature-card {
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease;
    }
    .feature-card:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 14px 30px rgba(139, 92, 246, 0.18), 0 2px 8px rgba(0,0,0,0.06);
    }
    /* \u4E3B\u8981\u6309\u94AE\u679C\u51BB\u547C\u5438\u5149\u6655\uFF08\u4EC5\u4E3B\u6309\u94AE\uFF0C\u5B89\u5168\u53E0\u52A0\uFF09 */
    .btn-primary.btn-jelly {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      background-size: 200% 200%;
      animation: gradientShift 6s ease infinite;
    }
    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    /* \u9875\u9762\u53F3\u4FA7/\u5E95\u90E8\u53EF\u7231\u7684\u6F02\u6D6E\u88C5\u9970\u6C14\u6CE1 */
    .deco-bubble {
      position: fixed;
      border-radius: 50%;
      pointer-events: none;
      z-index: -1;
      filter: blur(3px);
      opacity: 0.35;
      animation: bubbleFloat 12s ease-in-out infinite;
    }
    @keyframes bubbleFloat {
      0%, 100% { transform: translateY(0) translateX(0); }
      50% { transform: translateY(-26px) translateX(14px); }
    }
    /* \u9762\u677F\u5207\u6362\u6DE1\u5165 */
    .section-header { animation: fadeIn 0.5s ease; }
  </style>
  
  `, `
</head>
<body>
  <!-- \u53EF\u7231\u7684\u6F02\u6D6E\u88C5\u9970\u6C14\u6CE1 -->
  <div class="deco-bubble" style="width:120px;height:120px;top:18%;right:-30px;background:linear-gradient(135deg,#38bdf8,#818cf8);"></div>
  <div class="deco-bubble" style="width:90px;height:90px;bottom:12%;left:-24px;background:linear-gradient(135deg,#f472b6,#a78bfa);animation-delay:-4s;"></div>
  <div class="deco-bubble" style="width:64px;height:64px;top:60%;right:6%;background:linear-gradient(135deg,#34d399,#38bdf8);animation-delay:-8s;"></div>

  <header class="header">
    <div class="container">
      <a href="/" class="logo" onclick="navigate('home'); return false;">
        `, "\n        <span>", `</span>
      </a>
      <div class="header-actions">
        <button class="theme-toggle" onclick="toggleTheme()" title="\u5207\u6362\u4E3B\u9898">
          <span id="theme-icon" style="display:flex;align-items:center;"></span>
        </button>
        <div id="header-user"></div>
      </div>
    </div>
  </header>

  <div id="announcements" class="container announcements-container"></div>

  <main id="app" class="container">
    <div class="loading-center"><div class="spinner"></div></div>
  </main>

  <div class="toast-container" id="toast-container"></div>

  <div class="modal-overlay" id="modal-overlay">
    <div class="modal" id="modal-content">
      <h3 id="modal-title">\u786E\u8BA4</h3>
      <p id="modal-message"></p>
      <div id="modal-body"></div>
      <div class="modal-actions" id="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">\u53D6\u6D88</button>
        <button class="btn btn-danger" id="modal-confirm" onclick="confirmModal()">\u786E\u8BA4</button>
      </div>
    </div>
  </div>

  <script>
    const icons = {
      themeDark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
      themeLight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
      admin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
      pending: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      approved: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      rejected: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      globe: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
      tool: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
      shield: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
      mailbox: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5"></path></svg>',
      clipboard: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
      users: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
      email: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
      cloud: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>',
      key: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>'
    };

    const state = {
      user: `, `,
      domains: [],
      subdomains: [],
      records: [],
      config: {},
      currentSubdomain: null,
      currentView: 'home',
      modalCallback: null,
      editingRecord: null,
      // Admin state
      adminTab: 'pending',
      adminPending: [],
      adminAll: [],
      adminUsers: [],
      adminAnnouncements: [],
      editingAnnouncement: null,
      // Cloudflare accounts
      accounts: [],
      selectedAccount: null,
      // Email verification
      emailVerificationRequired: false,
      allowedEmailDomains: [],
      showVerifyBanner: false,
    };

    // ==================== API ====================
    async function api(path, opts = {}) {
      const res = await fetch('/api' + path, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '\u8BF7\u6C42\u5931\u8D25');
      return data;
    }

    // \u516C\u544A\u63A5\u53E3\uFF08\u6302\u5728\u9876\u5C42 /announcements \u800C\u975E /api\uFF0C\u516C\u5F00\u5217\u8868\u4EE5\u53CA /admin \u7BA1\u7406\u5747\u7528 cookie \u8BA4\u8BC1\uFF09
    async function annApi(path, opts = {}) {
      const res = await fetch('/announcements' + path, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '\u8BF7\u6C42\u5931\u8D25');
      return data;
    }

    // ==================== Toast ====================
    function toast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const el = document.createElement('div');
      el.className = 'toast toast-' + type + ' bounce-in';
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }

    // ==================== Modal ====================
    function showModal(title, message, callback, opts = {}) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-message').textContent = message;
      document.getElementById('modal-body').innerHTML = opts.bodyHtml || '';
      const actions = document.getElementById('modal-actions');
      const confirmBtn = document.getElementById('modal-confirm');
      confirmBtn.textContent = opts.confirmText || '\u786E\u8BA4';
      confirmBtn.className = 'btn ' + (opts.confirmClass || 'btn-danger btn-jelly');
      document.getElementById('modal-overlay').classList.add('active');
      state.modalCallback = callback;
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('active');
      state.modalCallback = null;
    }

    function confirmModal() {
      if (state.modalCallback) state.modalCallback();
      closeModal();
    }

    // ==================== Theme ====================
    function getTheme() { return localStorage.getItem('theme') || 'dark'; }
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      document.getElementById('theme-icon').innerHTML = theme === 'dark' ? icons.themeDark : icons.themeLight;
    }
    function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

    // ==================== Navigation ====================
    function navigate(view, data) {
      state.currentView = view;
      if (data !== undefined) state.currentSubdomain = data;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderHeaderUser() {
      const el = document.getElementById('header-user');
      if (state.user) {
        let adminLink = '';
        if (state.user.is_admin) {
          adminLink = '<a href="#" class="btn btn-ghost btn-sm" onclick="navigate(\\'admin\\'); return false;" style="font-size:13px">' + icons.admin + ' \u7BA1\u7406</a>';
        }
        el.innerHTML = '<div class="user-info">' +
          '<img class="user-avatar" src="' + (state.user.avatar_url || '') + '" alt="">' +
          '<span class="user-name">' + escapeHtml(state.user.github_username) + '</span>' +
          '</div>' + adminLink +
          '<a href="/auth/logout" class="btn btn-ghost btn-sm">\u9000\u51FA</a>';
      } else {
        el.innerHTML = '';
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function statusBadge(status) {
      const map = {
        pending: '<span class="badge badge-pending">' + icons.pending + ' \u5F85\u5BA1\u6838</span>',
        approved: '<span class="badge badge-approved">' + icons.approved + ' \u5DF2\u901A\u8FC7</span>',
        rejected: '<span class="badge badge-rejected">' + icons.rejected + ' \u5DF2\u62D2\u7EDD</span>',
      };
      return map[status] || status;
    }

    // ==================== Landing ====================
    function renderLanding() {
      return '<div class="hero fade-in">' +
        '<h1 class="gradient-text">\u83B7\u53D6\u4F60\u7684\u4E13\u5C5E\u5B50\u57DF\u540D</h1>' +
        '<p>\u901A\u8FC7 GitHub \u767B\u5F55\uFF0C\u7533\u8BF7\u5C5E\u4E8E\u81EA\u5DF1\u7684\u4E8C\u7EA7\u57DF\u540D\uFF0C\u7ECF\u7BA1\u7406\u5458\u5BA1\u6838\u540E\u5373\u53EF\u83B7\u5F97\u5B8C\u6574 DNS \u63A7\u5236\u6743\u3002</p>' +
        '<a href="/auth/github" class="btn btn-github btn-jelly">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.744.083-.729.083-.729 1.205.085 1.838 1.237 1.838 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.776.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.51 11.51 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.652.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.604-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>' +
        '\u4F7F\u7528 GitHub \u767B\u5F55' +
        '</a></div>' +
        '<div class="features">' +
        '<div class="card feature-card card-hover"><div class="feature-icon bounce">' + icons.globe + '</div><h3>\u5B89\u5168\u5206\u914D</h3><p>\u7BA1\u7406\u5458\u5BA1\u6838\u901A\u8FC7\u540E\uFF0C\u5373\u53EF\u83B7\u5F97\u4E13\u5C5E\u5B50\u57DF\u540D</p></div>' +
        '<div class="card feature-card card-hover"><div class="feature-icon float">' + icons.tool + '</div><h3>\u5B8C\u6574 DNS \u63A7\u5236</h3><p>\u652F\u6301 A\u3001AAAA\u3001CNAME\u3001MX\u3001TXT\u3001SRV\u3001CAA \u5168\u7C7B\u578B\u8BB0\u5F55</p></div>' +
        '<div class="card feature-card card-hover"><div class="feature-icon pulse-soft">' + icons.shield + '</div><h3>Cloudflare \u52A0\u901F</h3><p>\u4F9D\u6258 Cloudflare \u5168\u7403\u7F51\u7EDC\uFF0C\u4EAB\u53D7 CDN \u52A0\u901F\u4E0E DDoS \u9632\u62A4</p></div>' +
        '</div>';
    }

    // ==================== Dashboard ====================
    async function loadDashboardData() {
      try {
        const [domainData, subData] = await Promise.all([api('/domains'), api('/subdomains')]);
        state.domains = domainData.domains;
        state.config = {
          max_subdomains: domainData.max_subdomains,
          max_records: domainData.max_records,
          banned_prefixes: domainData.banned_prefixes,
          allowed_record_types: domainData.allowed_record_types,
        };
        state.subdomains = subData.subdomains;
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderDashboard() {
      const subs = state.subdomains;
      const activeSubs = subs.filter(s => s.status !== 'rejected');
      const canCreate = activeSubs.length < state.config.max_subdomains;

      let h = '<div class="dashboard fade-in">';

      // \u90AE\u7BB1\u9A8C\u8BC1\u63D0\u793A
      if (state.showVerifyBanner) {
        h += '<div class="verify-banner bounce-in">' +
          '<div class="verify-banner-row">' +
          (state.user.email
            ? '<p>\u{1F4E7} \u8BF7\u9A8C\u8BC1\u60A8\u7684\u90AE\u7BB1 <b>' + escapeHtml(state.user.email) + '</b> \u4EE5\u4F7F\u7528\u5168\u90E8\u529F\u80FD</p>' +
              '<button class="btn btn-sm" onclick="sendVerificationEmail()">\u53D1\u9001\u9A8C\u8BC1\u90AE\u4EF6</button>'
            : '<p>\u{1F4E7} \u60A8\u8FD8\u6CA1\u6709\u7ED1\u5B9A\u90AE\u7BB1\uFF0C\u8BF7\u5148\u7ED1\u5B9A\u90AE\u7BB1\u540E\u5373\u53EF\u7533\u8BF7\u5B50\u57DF\u540D</p>' +
              '<div class="verify-binder">' +
              '<input type="email" class="form-input" id="bind-email" placeholder="name@' + ((state.allowedEmailDomains && state.allowedEmailDomains[0]) || 'example.com').replace(/\\*/g, '') + '" onkeydown="if(event.key===\\Enter\\'){bindEmail();}" />' +
              '<button class="btn btn-primary btn-sm btn-jelly" onclick="bindEmail()">\u7ED1\u5B9A\u5E76\u53D1\u9001\u9A8C\u8BC1\u90AE\u4EF6</button>' +
              '</div>') +
          '</div>' +
          '</div>';
      }

      if (canCreate) {
        h += '<div class="section">' +
          '<div class="section-header"><h2 class="section-title">\u7533\u8BF7\u5B50\u57DF\u540D</h2></div>' +
          '<div class="card">' +
          '<div class="form-inline">' +
          '<div class="form-group" style="flex:2">' +
          '<label class="form-label">\u5B50\u57DF\u540D</label>' +
          '<div class="subdomain-input-group">' +
          '<input type="text" class="form-input" id="new-subdomain" placeholder="your-name" />' +
          '<select class="form-select domain-suffix" id="new-domain" style="width:auto;border-radius:0 var(--radius-sm) var(--radius-sm) 0;border-left:none;">' +
          state.domains.map(d => '<option value="' + d + '">.' + d + '</option>').join('') +
          '</select></div></div>' +
          '<button class="btn btn-primary btn-jelly" onclick="registerSubdomain()" style="margin-bottom:0;align-self:flex-end;">\u63D0\u4EA4\u7533\u8BF7</button>' +
          '</div>' +
          '<p style="font-size:12px;color:var(--text-muted);margin-top:10px;">\u4EC5\u9650\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u8FDE\u5B57\u7B26\uFF0C\u957F\u5EA6 \u2265 2 \xB7 \u63D0\u4EA4\u540E\u9700\u7BA1\u7406\u5458\u5BA1\u6838</p>' +
          '</div></div>';
      }

      h += '<div class="section"><div class="section-header">' +
        '<h2 class="section-title">\u6211\u7684\u5B50\u57DF\u540D</h2>' +
        '<span style="font-size:13px;color:var(--text-muted)">' + activeSubs.length + ' / ' + state.config.max_subdomains + '</span></div>';

      if (subs.length === 0) {
        h += '<div class="card empty"><div class="empty-icon">' + icons.mailbox + '</div><p>\u8FD8\u6CA1\u6709\u5B50\u57DF\u540D\uFF0C\u5FEB\u53BB\u7533\u8BF7\u4E00\u4E2A\u5427</p></div>';
      } else {
        subs.forEach(sub => {
          const fqdn = sub.subdomain + '.' + sub.domain;
          h += '<div class="card card-hover subdomain-card">' +
            '<div class="subdomain-info">' +
            '<h4>' + escapeHtml(fqdn) + ' ' + statusBadge(sub.status) + '</h4>' +
            '<p>\u521B\u5EFA\u4E8E ' + new Date(sub.created_at).toLocaleDateString('zh-CN') + '</p>';

          if (sub.status === 'pending') {
            h += '<div class="status-note pending" style="display:flex;align-items:center;gap:6px">' + icons.pending + '\u6B63\u5728\u7B49\u5F85\u7BA1\u7406\u5458\u5BA1\u6838\uFF0C\u5BA1\u6838\u901A\u8FC7\u540E\u5373\u53EF\u7BA1\u7406 DNS \u8BB0\u5F55</div>';
          } else if (sub.status === 'rejected') {
            h += '<div class="status-note rejected" style="display:flex;align-items:center;gap:6px">' + icons.rejected + '\u62D2\u7EDD\u539F\u56E0: ' + escapeHtml(sub.reject_reason || '\u672A\u63D0\u4F9B') + '</div>';
          }

          h += '</div><div class="subdomain-actions">';

          if (sub.status === 'approved') {
            h += '<button class="btn btn-primary btn-sm btn-jelly" onclick="openDnsManager(' + sub.id + ')">\u7BA1\u7406 DNS</button>';
          }

          h += '<button class="btn btn-danger btn-sm" onclick="deleteSubdomainConfirm(' + sub.id + ',\\'' + escapeHtml(fqdn) + '\\')">\u5220\u9664</button>' +
            '</div></div>';
        });
      }

      h += '</div></div>';
      return h;
    }

    async function registerSubdomain() {
      const subdomain = document.getElementById('new-subdomain').value.trim().toLowerCase();
      const domain = document.getElementById('new-domain').value;
      if (!subdomain) { toast('\u8BF7\u8F93\u5165\u5B50\u57DF\u540D', 'error'); return; }
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) { toast('\u5B50\u57DF\u540D\u683C\u5F0F\u65E0\u6548', 'error'); return; }
      if (subdomain.length < 2) { toast('\u5B50\u57DF\u540D\u81F3\u5C11 2 \u4E2A\u5B57\u7B26', 'error'); return; }
      if (state.config.banned_prefixes && state.config.banned_prefixes.includes(subdomain)) { toast('\u8BE5\u5B50\u57DF\u540D\u524D\u7F00\u5DF2\u88AB\u7981\u6B62', 'error'); return; }

      try {
        const res = await api('/subdomains', { method: 'POST', body: JSON.stringify({ subdomain, domain }) });
        toast(res.message || '\u7533\u8BF7\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u5BA1\u6838', 'success');
        await loadDashboardData();
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function deleteSubdomainConfirm(id, fqdn) {
      showModal('\u5220\u9664\u5B50\u57DF\u540D', '\u786E\u5B9A\u8981\u5220\u9664 ' + fqdn + ' \u5417\uFF1F\u6240\u6709\u5173\u8054\u7684 DNS \u8BB0\u5F55\u4E5F\u5C06\u88AB\u5220\u9664\u3002', async () => {
        try {
          await api('/subdomains/' + id, { method: 'DELETE' });
          toast('\u5B50\u57DF\u540D\u5DF2\u5220\u9664', 'success');
          await loadDashboardData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== DNS Manager ====================
    async function openDnsManager(subId) {
      state.currentSubdomain = subId;
      state.currentView = 'dns';
      state.editingRecord = null;
      await loadRecords(subId);
      render();
    }

    async function loadRecords(subId) {
      try {
        const data = await api('/subdomains/' + subId + '/records');
        state.records = data.records;
        state.currentSubdomainFqdn = data.subdomain;
        state.currentRecordCount = data.current_count;
        state.maxRecords = data.max_records;
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderDnsManager() {
      const fqdn = state.currentSubdomainFqdn || '';
      const records = state.records || [];
      const types = state.config.allowed_record_types || ['A','AAAA','CNAME','MX','TXT','SRV','CAA'];
      const editing = state.editingRecord;

      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\'dashboard\\'); return false;">\u2190 \u8FD4\u56DE\u5B50\u57DF\u540D\u5217\u8868</a>' +
        '<div class="dns-header"><h2>' + escapeHtml(fqdn) + ' - DNS \u7BA1\u7406</h2></div>' +
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">\u8BB0\u5F55: ' + (state.currentRecordCount||0) + ' / ' + (state.maxRecords||20) +
        ' \xB7 \u540D\u79F0 @ \u6216\u7559\u7A7A = ' + escapeHtml(fqdn) + '\uFF0C\u586B "www" = www.' + escapeHtml(fqdn) + '</p>';

      // Add/edit form
      h += '<div class="record-form">' +
        '<div class="record-form-title" style="display:flex;align-items:center;gap:6px">' + (editing ? icons.edit + '\u7F16\u8F91\u8BB0\u5F55' : icons.plus + '\u6DFB\u52A0\u8BB0\u5F55') + '</div>' +
        '<div class="form-row-3">' +
        '<div class="form-group"><label class="form-label">\u7C7B\u578B</label>' +
        '<select class="form-select" id="rec-type" onchange="onTypeChange()">' +
        types.map(t => '<option value="'+t+'"'+(editing&&editing.record_type===t?' selected':'')+'>'+t+'</option>').join('') +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">\u540D\u79F0</label>' +
        '<input class="form-input" id="rec-name" placeholder="@ \u6216\u5B50\u540D\u79F0" value="'+(editing?escapeHtml(editing.name):'')+'" /></div>' +
        '<div class="form-group"><label class="form-label">\u5185\u5BB9</label>' +
        '<input class="form-input" id="rec-content" placeholder="\u8BB0\u5F55\u503C" value="'+(editing?escapeHtml(editing.content):'')+'" /></div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">TTL</label>' +
        '<select class="form-select" id="rec-ttl">' +
        '<option value="1"'+(editing&&editing.ttl===1?' selected':'')+'>\u81EA\u52A8</option>' +
        '<option value="60"'+(editing&&editing.ttl===60?' selected':'')+'>1 \u5206\u949F</option>' +
        '<option value="300"'+(editing&&editing.ttl===300?' selected':'')+'>5 \u5206\u949F</option>' +
        '<option value="3600"'+(editing&&editing.ttl===3600?' selected':'')+'>1 \u5C0F\u65F6</option>' +
        '<option value="86400"'+(editing&&editing.ttl===86400?' selected':'')+'>1 \u5929</option>' +
        '</select></div>' +
        '<div class="form-group" id="priority-group" style="display:none"><label class="form-label">\u4F18\u5148\u7EA7</label>' +
        '<input class="form-input" type="number" id="rec-priority" placeholder="10" value="'+(editing&&editing.priority!==null?editing.priority:'10')+'" /></div></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">' +
        '<label class="checkbox-label"><input type="checkbox" id="rec-proxied"'+(editing&&editing.proxied?' checked':'')+'> Cloudflare \u4EE3\u7406 (A/AAAA/CNAME)</label>' +
        '<div style="display:flex;gap:8px">' +
        (editing?'<button class="btn btn-secondary btn-sm" onclick="cancelEdit()">\u53D6\u6D88</button>':'') +
        '<button class="btn btn-primary btn-sm btn-jelly" onclick="'+(editing?'updateRecord()':'addRecord()')+'">'+(editing?'\u66F4\u65B0':'\u6DFB\u52A0')+'</button>' +
        '</div></div></div>';

      if (records.length > 0) {
        h += '<div class="card"><div class="table-wrap"><table>' +
          '<thead><tr><th>\u7C7B\u578B</th><th>\u540D\u79F0</th><th>\u5185\u5BB9</th><th>TTL</th><th>\u4EE3\u7406</th><th>\u5F00\u5173</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
        records.forEach(r => {
          const ttl = r.ttl===1?'\u81EA\u52A8':(r.ttl>=3600?(r.ttl/3600)+'h':(r.ttl>=60?(r.ttl/60)+'m':r.ttl+'s'));
          h += '<tr><td><span class="badge badge-type">'+escapeHtml(r.record_type)+'</span></td>' +
            '<td class="mono">'+escapeHtml(r.name)+'</td>' +
            '<td class="mono" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escapeHtml(r.content)+'">'+escapeHtml(r.content)+'</td>' +
            '<td>'+ttl+'</td>' +
            '<td>'+(r.proxied
              ?'<span class="proxy-indicator proxied">' + icons.cloud + ' \u5DF2\u4EE3\u7406</span>'
              :'<span class="proxy-indicator direct">\u76F4\u63A5</span>')+'</td>' +
            '<td><div class="proxied-toggle ' + (r.proxied ? 'active' : '') + '" onclick="toggleProxied(' + r.id + ', ' + r.proxied + ')" title="\u5207\u6362\u4EE3\u7406\u72B6\u6001"></div></td>' +
            '<td><div style="display:flex;gap:4px">' +
            '<button class="btn btn-ghost btn-sm" onclick="editRecord('+r.id+')" title="\u7F16\u8F91" style="display:flex">' + icons.edit + '</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="deleteRecordConfirm('+r.id+',\\''+escapeHtml(r.name)+'\\',\\''+escapeHtml(r.record_type)+'\\')" title="\u5220\u9664" style="display:flex">' + icons.trash + '</button>' +
            '</div></td></tr>';
        });
        h += '</tbody></table></div></div>';
      } else {
        h += '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>\u8FD8\u6CA1\u6709 DNS \u8BB0\u5F55</p></div>';
      }
      h += '</div>';
      return h;
    }

    function onTypeChange() {
      const t = document.getElementById('rec-type').value;
      document.getElementById('priority-group').style.display = (t==='MX'||t==='SRV')?'block':'none';
    }

    async function addRecord() {
      const type = document.getElementById('rec-type').value;
      const name = document.getElementById('rec-name').value.trim() || '@';
      const content = document.getElementById('rec-content').value.trim();
      const ttl = parseInt(document.getElementById('rec-ttl').value);
      const priority = parseInt(document.getElementById('rec-priority')?.value) || 10;
      const proxied = document.getElementById('rec-proxied').checked;
      if (!content) { toast('\u8BF7\u586B\u5199\u8BB0\u5F55\u5185\u5BB9', 'error'); return; }
      const body = { type, name, content, ttl, proxied };
      if (type==='MX'||type==='SRV') body.priority = priority;
      try {
        await api('/subdomains/'+state.currentSubdomain+'/records', { method:'POST', body:JSON.stringify(body) });
        toast('DNS \u8BB0\u5F55\u5DF2\u6DFB\u52A0', 'success');
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function editRecord(id) {
      const r = state.records.find(r => r.id===id);
      if (!r) return;
      state.editingRecord = r;
      render();
      setTimeout(() => onTypeChange(), 0);
    }

    function cancelEdit() { state.editingRecord = null; render(); }

    async function updateRecord() {
      const editing = state.editingRecord; if (!editing) return;
      const type = document.getElementById('rec-type').value;
      const name = document.getElementById('rec-name').value.trim() || '@';
      const content = document.getElementById('rec-content').value.trim();
      const ttl = parseInt(document.getElementById('rec-ttl').value);
      const priority = parseInt(document.getElementById('rec-priority')?.value) || 10;
      const proxied = document.getElementById('rec-proxied').checked;
      if (!content) { toast('\u8BF7\u586B\u5199\u8BB0\u5F55\u5185\u5BB9', 'error'); return; }
      const body = { type, name, content, ttl, proxied };
      if (type==='MX'||type==='SRV') body.priority = priority;
      try {
        await api('/subdomains/'+state.currentSubdomain+'/records/'+editing.id, { method:'PUT', body:JSON.stringify(body) });
        toast('\u5DF2\u66F4\u65B0', 'success');
        state.editingRecord = null;
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function deleteRecordConfirm(id, name, type) {
      showModal('\u5220\u9664 DNS \u8BB0\u5F55', '\u786E\u5B9A\u5220\u9664 '+type+' \u8BB0\u5F55 "'+name+'" \u5417\uFF1F', async () => {
        try {
          await api('/subdomains/'+state.currentSubdomain+'/records/'+id, { method:'DELETE' });
          toast('\u5DF2\u5220\u9664', 'success');
          await loadRecords(state.currentSubdomain);
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Proxied Toggle ====================
    async function toggleProxied(recordId, currentProxied) {
      try {
        const res = await api('/proxied/records/' + recordId + '/proxied', {
          method: 'PUT',
          body: JSON.stringify({ proxied: !currentProxied }),
        });
        toast(res.message || '\u4EE3\u7406\u72B6\u6001\u5DF2\u5207\u6362', 'success');
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    // ==================== Admin Panel ====================
    async function loadAdminData() {
      try {
        const [pendingData, allData, userData, annData] = await Promise.all([
          api('/admin/pending'),
          api('/admin/subdomains'),
          api('/admin/users'),
          annApi('/admin'),
        ]);
        state.adminPending = pendingData.subdomains;
        state.adminAll = allData.subdomains;
        state.adminUsers = userData.users;
        state.adminAnnouncements = annData.announcements || [];
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderAdminPanel() {
      const pendingCount = state.adminPending.length;

      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\'dashboard\\'); return false;">\u2190 \u8FD4\u56DE\u9762\u677F</a>' +
        '<div class="section-header" style="margin-top:16px"><h2 class="section-title" style="display:flex;align-items:center;gap:8px">' + icons.admin + ' \u7BA1\u7406\u5458\u9762\u677F</h2></div>';

      // Tabs
      h += '<div class="tabs">' +
        '<button class="tab'+(state.adminTab==='pending'?' active':'')+'" onclick="switchAdminTab(\\'pending\\')">\u5F85\u5BA1\u6838' +
        (pendingCount > 0 ? '<span class="tab-count">'+pendingCount+'</span>' : '') + '</button>' +
        '<button class="tab'+(state.adminTab==='all'?' active':'')+'" onclick="switchAdminTab(\\'all\\')">\u6240\u6709\u5B50\u57DF\u540D</button>' +
        '<button class="tab'+(state.adminTab==='users'?' active':'')+'" onclick="switchAdminTab(\\'users\\')">\u7528\u6237\u7BA1\u7406</button>' +
        '<button class="tab'+(state.adminTab==='announcements'?' active':'')+'" onclick="switchAdminTab(\\'announcements\\')">\u516C\u544A\u7BA1\u7406</button>' +
        '<button class="tab'+(state.adminTab==='accounts'?' active':'')+'" onclick="switchAdminTab(\\'accounts\\')">' + icons.key + ' Cloudflare \u8D26\u6237</button>' +
        '</div>';

      if (state.adminTab === 'pending') {
        h += renderAdminPending();
      } else if (state.adminTab === 'all') {
        h += renderAdminAll();
      } else if (state.adminTab === 'announcements') {
        h += renderAdminAnnouncements();
      } else if (state.adminTab === 'accounts') {
        h += renderAccountsContent();
      } else {
        h += renderAdminUsers();
      }

      h += '</div>';
      return h;
    }

    function renderAdminPending() {
      const items = state.adminPending;
      if (items.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>\u6682\u65E0\u5F85\u5BA1\u6838\u7684\u7533\u8BF7</p></div>';
      }

      let h = '';
      items.forEach(sub => {
        const fqdn = sub.subdomain + '.' + sub.domain;
        h += '<div class="card card-hover review-card" style="margin-bottom:10px;padding:20px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
          '<div>' +
          '<h4 style="font-family:var(--font-mono);font-size:16px;font-weight:600">' + escapeHtml(fqdn) + '</h4>' +
          '<div class="review-meta">' +
          '<span style="display:flex;align-items:center">' + icons.user + ' ' + escapeHtml(sub.github_username) + '</span>' +
          '<span style="display:flex;align-items:center">' + icons.calendar + ' ' + new Date(sub.created_at).toLocaleString('zh-CN') + '</span>' +
          (sub.email ? '<span style="display:flex;align-items:center">' + icons.email + ' ' + escapeHtml(sub.email) + '</span>' : '') +
          '</div></div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success btn-sm btn-jelly" onclick="approveSubdomain('+sub.id+',\\''+escapeHtml(fqdn)+'\\')">' + icons.approved + ' \u901A\u8FC7</button>' +
          '<button class="btn btn-danger btn-sm" onclick="rejectSubdomainModal('+sub.id+',\\''+escapeHtml(fqdn)+'\\')">' + icons.rejected + ' \u62D2\u7EDD</button>' +
          '</div></div></div>';
      });
      return h;
    }

    function renderAdminAll() {
      const items = state.adminAll;
      if (items.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>\u6682\u65E0\u5B50\u57DF\u540D\u8BB0\u5F55</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>\u5B50\u57DF\u540D</th><th>\u7528\u6237</th><th>\u72B6\u6001</th><th>\u521B\u5EFA\u65F6\u95F4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      items.forEach(sub => {
        const fqdn = sub.subdomain + '.' + sub.domain;
        h += '<tr><td class="mono">' + escapeHtml(fqdn) + '</td>' +
          '<td>' + escapeHtml(sub.github_username) + '</td>' +
          '<td>' + statusBadge(sub.status) + '</td>' +
          '<td>' + new Date(sub.created_at).toLocaleDateString('zh-CN') + '</td>' +
          '<td><button class="btn btn-danger btn-sm" onclick="adminDeleteSubdomain('+sub.id+',\\''+escapeHtml(fqdn)+'\\')">\u5220\u9664</button></td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    function renderAdminUsers() {
      const users = state.adminUsers;
      if (users.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.users + '</div><p>\u6682\u65E0\u7528\u6237</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>\u5934\u50CF</th><th>\u7528\u6237\u540D</th><th>\u90AE\u7BB1</th><th>\u8EAB\u4EFD</th><th>\u6CE8\u518C\u65F6\u95F4</th></tr></thead><tbody>';
      users.forEach(u => {
        h += '<tr><td><img src="'+(u.avatar_url||'')+'" style="width:28px;height:28px;border-radius:50%"></td>' +
          '<td>'+escapeHtml(u.github_username)+'</td>' +
          '<td class="mono">'+(u.email? escapeHtml(u.email):'\u2014')+'</td>' +
          '<td>'+(u.is_admin?'<span class="badge badge-approved">\u7BA1\u7406\u5458</span>':'\u7528\u6237')+'</td>' +
          '<td>'+new Date(u.created_at).toLocaleDateString('zh-CN')+'</td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    // ==================== \u516C\u544A\u7BA1\u7406 ====================
    function renderAdminAnnouncements() {
      const items = state.adminAnnouncements;

      // \u65B0\u589E/\u7F16\u8F91\u8868\u5355\uFF08\u4E34\u65F6\u7528 DOM \u8F93\u5165\uFF0C\u7F16\u8F91\u65F6\u590D\u7528\uFF09
      let h = '<div class="section" style="margin-bottom:16px">' +
        '<div class="card">' +
        '<div class="card-title">\u{1F4E2} \u53D1\u5E03 / \u7F16\u8F91\u516C\u544A</div>' +
        '<div class="form-group"><label class="form-label">\u516C\u544A\u6807\u9898</label>' +
        '<input type="text" class="form-input" id="ann-title" placeholder="\u8F93\u5165\u6807\u9898\u2026" value="' + (escapeHtml(state.editingAnnouncement?.title || '')) + '" /></div>' +
        '<div class="form-group"><label class="form-label">\u516C\u544A\u5185\u5BB9</label>' +
        '<textarea class="form-input" id="ann-content" rows="4" placeholder="\u8F93\u5165\u516C\u544A\u5185\u5BB9\u2026" style="min-height:100px">' + (escapeHtml(state.editingAnnouncement?.content || '')) + '</textarea></div>' +
        '<div class="form-group" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
        '<label class="form-label" style="margin:0">\u6392\u5E8F\u53F7</label>' +
        '<input type="number" min="0" class="form-input" id="ann-sort" value="' + (state.editingAnnouncement?.sort_order ?? '') + '" placeholder="0" style="width:100px" />' +
        '<label class="form-label" style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="ann-pinned" ' + (state.editingAnnouncement?.is_pinned ? 'checked' : '') + ' /> \u7F6E\u9876\uFF08\u8F6E\u64AD\u663E\u793A\u5168\u6587\uFF09</label>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:4px">' +
        '<button class="btn btn-primary btn-jelly" onclick="saveAnnouncement()">' + (state.editingAnnouncement ? '\u4FDD\u5B58\u4FEE\u6539' : '\u53D1\u5E03\u516C\u544A') + '</button>' +
        (state.editingAnnouncement ? '<button class="btn btn-ghost" onclick="cancelEditAnnouncement()">\u53D6\u6D88\u7F16\u8F91</button>' : '') +
        '</div>' +
        '</div></div>';

      if (items.length === 0) {
        h += '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>\u6682\u65E0\u516C\u544A</p></div>';
        return h;
      }

      h += '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>\u6807\u9898</th><th>\u6392\u5E8F</th><th>\u72B6\u6001</th><th>\u521B\u5EFA\u65F6\u95F4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      items.forEach(a => {
        h += '<tr><td><strong>' + escapeHtml(a.title) + (a.is_pinned ? '<span class="pin-badge">\u7F6E\u9876</span>' : '') + '</strong><div style="font-size:12px;color:var(--text-muted)">' + escapeHtml(a.content) + '</div></td>' +
          '<td>' + (a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 0) + '</td>' +
          '<td>' + (a.is_active ? '<span class="badge badge-approved">\u663E\u793A\u4E2D</span>' : '<span class="badge">\u5DF2\u9690\u85CF</span>') + '</td>' +
          '<td>' + new Date(a.created_at).toLocaleDateString('zh-CN') + '</td>' +
          '<td style="display:flex;gap:6px">' +
          '<button class="btn btn-sm ' + (a.is_pinned ? 'btn-ghost' : 'btn-primary') + '" onclick="toggleAnnouncementPin(' + a.id + ')">' + (a.is_pinned ? '\u53D6\u6D88\u7F6E\u9876' : '\u7F6E\u9876') + '</button>' +
          '<button class="btn btn-sm btn-primary btn-jelly" onclick="startEditAnnouncement(' + a.id + ')">\u7F16\u8F91</button>' +
          '<button class="btn btn-sm ' + (a.is_active ? 'btn-ghost' : 'btn-primary') + '" onclick="toggleAnnouncement(' + a.id + ')">' + (a.is_active ? '\u9690\u85CF' : '\u663E\u793A') + '</button>' +
          '<button class="btn btn-sm btn-danger" onclick="deleteAnnouncement(' + a.id + ',\\'' + escapeHtml(a.title) + '\\')">\u5220\u9664</button>' +
          '</td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    function startEditAnnouncement(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (a) { state.editingAnnouncement = a; }
      render();
    }

    function cancelEditAnnouncement() {
      state.editingAnnouncement = null;
      render();
    }

    async function saveAnnouncement() {
      const title = document.getElementById('ann-title')?.value?.trim();
      const content = document.getElementById('ann-content')?.value?.trim();
      if (!title) { toast('\u8BF7\u8F93\u5165\u516C\u544A\u6807\u9898', 'error'); return; }
      if (!content) { toast('\u8BF7\u8F93\u5165\u516C\u544A\u5185\u5BB9', 'error'); return; }

      // \u6392\u5E8F\u53F7\u4E0E\u7F6E\u9876
      const sortRaw = document.getElementById('ann-sort')?.value;
      const sortOrder = sortRaw !== undefined && sortRaw !== '' ? parseInt(sortRaw, 10) : NaN;
      const pinned = !!document.getElementById('ann-pinned')?.checked;
      const payload = {
        title, content,
        is_pinned: pinned,
        sort_order: Number.isNaN(sortOrder) ? undefined : sortOrder
      };

      try {
        const editing = state.editingAnnouncement;
        if (editing) {
          const r = await annApi('/admin/' + editing.id, { method: 'PUT', body: JSON.stringify(payload) });
          toast('\u516C\u544A\u5DF2\u66F4\u65B0', 'success');
          if (r && r.announcement) {
            for (let i = 0; i < state.adminAnnouncements.length; i++) {
              if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
            }
          }
        } else {
          const r = await annApi('/admin', { method: 'POST', body: JSON.stringify(payload) });
          toast('\u516C\u544A\u5DF2\u53D1\u5E03', 'success');
          if (r && r.announcement) { state.adminAnnouncements.push(r.announcement); }
        }
        state.editingAnnouncement = null;
        sortAnnouncements();
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAnnouncementPin(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (!a) return;
      try {
        const r = await annApi('/admin/' + id, { method: 'PUT', body: JSON.stringify({ is_pinned: !a.is_pinned }) });
        toast(a.is_pinned ? '\u5DF2\u53D6\u6D88\u7F6E\u9876' : '\u5DF2\u7F6E\u9876\uFF08\u8F6E\u64AD\u663E\u793A\u5168\u6587\uFF09', 'success');
        if (r && r.announcement) {
          for (let i = 0; i < state.adminAnnouncements.length; i++) {
            if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
          }
          sortAnnouncements();
        }
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAnnouncement(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (!a) return;
      try {
        const r = await annApi('/admin/' + id, { method: 'PUT', body: JSON.stringify({ is_active: !a.is_active }) });
        toast(a.is_active ? '\u516C\u544A\u5DF2\u9690\u85CF' : '\u516C\u544A\u5DF2\u663E\u793A', 'success');
        if (r && r.announcement) {
          for (let i = 0; i < state.adminAnnouncements.length; i++) {
            if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
          }
          sortAnnouncements();
        }
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deleteAnnouncement(id, title) {
      showModal('\u5220\u9664\u516C\u544A', '\u786E\u5B9A\u5220\u9664\u516C\u544A\u300C' + title + '\u300D\u5417\uFF1F', async () => {
        try {
          await annApi('/admin/' + id, { method: 'DELETE' });
          toast('\u516C\u544A\u5DF2\u5220\u9664', 'success');
          state.adminAnnouncements = state.adminAnnouncements.filter(function (x) { return x.id !== id; });
          sortAnnouncements();
          rerender();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    async function switchAdminTab(tab) {
      state.adminTab = tab;
      if (tab === 'accounts') {
        try { await loadAccounts(); } catch (e) { console.error('Failed to load accounts:', e); }
      }
      render();
    }

    async function approveSubdomain(id, fqdn) {
      showModal('\u5BA1\u6838\u901A\u8FC7', '\u786E\u5B9A\u901A\u8FC7 ' + fqdn + ' \u7684\u7533\u8BF7\u5417\uFF1F\u901A\u8FC7\u540E\u7528\u6237\u5373\u53EF\u7BA1\u7406 DNS \u8BB0\u5F55\u3002', async () => {
        try {
          await api('/admin/subdomains/'+id+'/approve', { method:'POST', body:'{}' });
          toast('\u5DF2\u901A\u8FC7\u5BA1\u6838', 'success');
          await loadAdminData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      }, { confirmText: '\u901A\u8FC7', confirmClass: 'btn-success btn-jelly' });
    }

    function rejectSubdomainModal(id, fqdn) {
      showModal(
        '\u62D2\u7EDD\u7533\u8BF7',
        '\u8BF7\u586B\u5199\u62D2\u7EDD ' + fqdn + ' \u7684\u539F\u56E0\uFF1A',
        async () => {
          const reason = document.getElementById('reject-reason')?.value?.trim();
          if (!reason) { toast('\u8BF7\u586B\u5199\u62D2\u7EDD\u539F\u56E0', 'error'); return; }
          try {
            await api('/admin/subdomains/'+id+'/reject', {
              method: 'POST',
              body: JSON.stringify({ reason }),
            });
            toast('\u5DF2\u62D2\u7EDD', 'success');
            await loadAdminData();
            render();
          } catch (err) { toast(err.message, 'error'); }
        },
        {
          bodyHtml: '<textarea class="form-input" id="reject-reason" placeholder="\u8BF7\u8F93\u5165\u62D2\u7EDD\u539F\u56E0..." style="resize:vertical;min-height:80px;margin-bottom:12px"></textarea>',
          confirmText: '\u62D2\u7EDD',
          confirmClass: 'btn-danger btn-jelly',
        }
      );
    }

    async function adminDeleteSubdomain(id, fqdn) {
      showModal('\u7BA1\u7406\u5458\u5220\u9664', '\u786E\u5B9A\u5220\u9664 ' + fqdn + ' \u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002', async () => {
        try {
          await api('/admin/subdomains/'+id, { method:'DELETE' });
          toast('\u5DF2\u5220\u9664', 'success');
          await loadAdminData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Email Verification ====================
    async function bindEmail() {
      const input = document.getElementById('bind-email');
      const email = input?.value?.trim().toLowerCase();
      if (!email) { toast('\u8BF7\u8F93\u5165\u90AE\u7BB1\u5730\u5740', 'error'); return; }
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)) { toast('\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E', 'error'); return; }
      try {
        const res = await api('/verification/bind', { method: 'POST', body: JSON.stringify({ email }) });
        state.user.email = email;
        state.user.email_verified = false;
        state.showVerifyBanner = true;
        toast(res.message || '\u90AE\u7BB1\u5DF2\u7ED1\u5B9A\uFF0C\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001', 'success');
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function sendVerificationEmail() {
      try {
        await api('/verification/send', { method: 'POST' });
        toast('\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001\uFF0C\u8BF7\u67E5\u6536', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }

    // ==================== Cloudflare Accounts ====================
    async function loadAccounts() {
      try {
        const data = await api('/accounts');
        state.accounts = data.accounts || [];
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    }

    async function createAccount() {
      const name = document.getElementById('account-name')?.value?.trim();
      const token = document.getElementById('account-token')?.value?.trim();
      const zoneId = document.getElementById('account-zone')?.value?.trim();

      if (!name || !token) {
        toast('\u8BF7\u586B\u5199\u8D26\u6237\u540D\u79F0\u548C API Token', 'error');
        return;
      }

      try {
        const res = await api('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            account_name: name,
            api_token: token,
            zone_id: zoneId || undefined,
          }),
        });
        toast('\u8D26\u6237\u6DFB\u52A0\u6210\u529F', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderAccounts() {
      if (state.accounts.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.key + '</div><p>\u8FD8\u6CA1\u6709\u6DFB\u52A0 Cloudflare \u8D26\u6237</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>\u8D26\u6237\u540D\u79F0</th><th>\u72B6\u6001</th><th>\u9ED8\u8BA4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';

      state.accounts.forEach(acc => {
        h += '<tr>' +
          '<td><strong>' + escapeHtml(acc.account_name) + '</strong></td>' +
          '<td>' + (acc.is_active ? '<span class="badge badge-approved">\u6D3B\u8DC3</span>' : '<span class="badge badge-rejected">\u505C\u7528</span>') + '</td>' +
          '<td>' + (acc.is_default ? '\u2B50 \u9ED8\u8BA4' : '\u2014') + '</td>' +
          '<td><div style="display:flex;gap:8px">' +
          '<button class="btn btn-ghost btn-sm" onclick="toggleAccountDefault(' + acc.id + ')" title="\u8BBE\u4E3A\u9ED8\u8BA4">\u2B50</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="toggleAccountActive(' + acc.id + ')" title="\u542F\u7528/\u505C\u7528">' + (acc.is_active ? '\u{1F441}' : '\u{1F441}\u200D\u{1F5E8}') + '</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteAccount(' + acc.id + ')" title="\u5220\u9664">' + icons.trash + '</button>' +
          '</div></td></tr>';
      });

      h += '</tbody></table></div></div>';
      return h;
    }

    async function toggleAccountDefault(id) {
      try {
        await api('/accounts/' + id, {
          method: 'PUT',
          body: JSON.stringify({ is_default: true }),
        });
        toast('\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u8D26\u6237', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAccountActive(id) {
      const account = state.accounts.find(a => a.id === id);
      if (!account) return;

      try {
        await api('/accounts/' + id, {
          method: 'PUT',
          body: JSON.stringify({ is_active: !account.is_active }),
        });
        toast('\u8D26\u6237\u72B6\u6001\u5DF2\u66F4\u65B0', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deleteAccount(id) {
      showModal('\u5220\u9664\u8D26\u6237', '\u786E\u5B9A\u5220\u9664\u6B64 Cloudflare \u8D26\u6237\u5417\uFF1F', async () => {
        try {
          await api('/accounts/' + id, { method: 'DELETE' });
          toast('\u8D26\u6237\u5DF2\u5220\u9664', 'success');
          await loadAccounts();
          renderAccounts();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Main Render ====================
    function render() {
      const app = document.getElementById('app');
      if (!state.user) { app.innerHTML = renderLanding(); return; }

      switch (state.currentView) {
        case 'dns':
          app.innerHTML = renderDnsManager();
          setTimeout(() => onTypeChange(), 0);
          break;
        case 'admin':
          app.innerHTML = renderAdminPanel();
          break;
        case 'accounts':
          app.innerHTML = renderAccountsPage();
          break;
        case 'dashboard':
        default:
          app.innerHTML = renderDashboard();
          break;
      }
    }

    // \u4FDD\u6301\u6EDA\u52A8\u4F4D\u7F6E\u5730\u91CD\u7ED8\u5F53\u524D\u89C6\u56FE\uFF1A\u4FDD\u5B58\u540E\u5237\u65B0\u4E0D\u56DE\u5230\u9876\u90E8\u3001\u4E0D\u91CD\u767B\u4E3B\u9875
    function rerender() {
      const y = window.scrollY || 0;
      render();
      requestAnimationFrame(function () { window.scrollTo(0, y); });
    }

    // \u4E0E\u540E\u7AEF\u4E00\u81F4\uFF1A\u542F\u7528 \u2192 \u7F6E\u9876 \u2192 \u6392\u5E8F\u53F7 \u2192 id \u6392\u5E8F\u516C\u544A\uFF08\u7BA1\u7406\u5217\u8868\u5C55\u793A\u987A\u5E8F\uFF09
    function sortAnnouncements() {
      const arr = state.adminAnnouncements || [];
      arr.sort(function (a, b) {
        const ak = (a.is_active ? 0 : 1), bk = (b.is_active ? 0 : 1);
        if (ak !== bk) return ak - bk;
        const ap = (a.is_pinned ? 0 : 1), bp = (b.is_pinned ? 0 : 1);
        if (ap !== bp) return ap - bp;
        const aso = (a.sort_order || 0), bso = (b.sort_order || 0);
        if (aso !== bso) return aso - bso;
        return a.id - b.id;
      });
    }

    function renderAccountsPage() {
      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\'dashboard\\'); return false;">\u2190 \u8FD4\u56DE\u9762\u677F</a>' +
        '<div class="section-header" style="margin-top:16px"><h2 class="section-title" style="display:flex;align-items:center;gap:8px">' + icons.key + ' Cloudflare \u8D26\u6237\u7BA1\u7406</h2></div>' +
        renderAccountsContent() + '</div>';
      return h;
    }

    function renderAccountsContent() {
      let h = '<div class="section">' +
        '<div class="card" style="border-left:4px solid var(--accent)">' +
        '<div class="card-title">\u591A\u8D26\u6237\u914D\u7F6E\u8BF4\u660E</div>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px">\u672C\u7CFB\u7EDF\u652F\u6301<strong>\u591A Cloudflare \u8D26\u6237</strong>\uFF1A\u4E0D\u540C\u57DF\u540D\u53EF\u7ED1\u5B9A\u4E0D\u540C\u8D26\u6237\u7684 Zone\u3002\u8BF7\u4E3A\u6BCF\u4E2A\u8D26\u6237\u5355\u72EC\u521B\u5EFA API Token\uFF0C\u5E76\u586B\u5199\u5230\u4E0B\u65B9\u8868\u5355\u3002Token \u4EC5\u7528\u4E8E DNS \u64CD\u4F5C\uFF0C\u9700\u8981 <strong>Zone - Edit</strong> \u6743\u9650\uFF1B\u8BF7\u52FF\u4F7F\u7528 Global \u6743\u9650\u8FC7\u5927\u7684 Token\u3002</p>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px"><strong>\u65E0\u9700\u914D\u7F6E\u73AF\u5883\u53D8\u91CF</strong>\uFF1A\u8D26\u6237\u6570\u636E\u4E0E\u52A0\u5BC6 Token \u5747\u5B58\u50A8\u5728 D1 \u7684 <code>cloudflare_accounts</code> \u8868\u3002\u73AF\u5883\u53D8\u91CF\u4E2D\u7684 <code>CF_API_TOKEN</code> \u4EC5\u4F5C\u4E3A\u65E0\u5339\u914D\u8D26\u6237\u65F6\u7684\u540E\u5907\uFF1B\u4F18\u5148\u4F7F\u7528\u8D26\u6237\u5217\u8868\u4E2D\u7684 Token\u3002</p>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px"><strong>\u5B50\u57DF\u540D\u4EE3\u7406\u5F00\u5173</strong>\uFF1A\u7ED1\u5B9A\u8D26\u6237\u540E\uFF0C\u5BA1\u6838\u901A\u8FC7\u7684\u5B50\u57DF\u540D\u53EF\u5728 DNS \u7BA1\u7406\u9875\u5207\u6362\u9EC4\u8272\u4E91\u6735\uFF08\u4EE3\u7406\uFF09\u3002\u4EC5\u7BA1\u7406\u5458\u5BA1\u6838\u901A\u8FC7\u7684\u5B50\u57DF\u540D\u53EF\u5F00\u901A\u4EE3\u7406\u3002</p>' +
        '</div>' +
        '<div class="card" style="margin-top:16px">' +
        '<div class="card-title">\u6DFB\u52A0\u65B0\u8D26\u6237</div>' +
        '<div class="form-group">' +
        '<label class="form-label">\u8D26\u6237\u540D\u79F0</label>' +
        '<input type="text" class="form-input" id="account-name" placeholder="\u4F8B\u5982: \u4E3B\u8D26\u6237\u3001\u5907\u7528\u8D26\u6237" /></div>' +
        '<div class="form-group">' +
        '<label class="form-label">API Token</label>' +
        '<input type="password" class="form-input" id="account-token" placeholder="\u8F93\u5165 Cloudflare API Token" /></div>' +
        '<div class="form-group">' +
        '<label class="form-label">Zone ID\uFF08\u53EF\u9009\uFF09</label>' +
        '<input type="text" class="form-input" id="account-zone" placeholder="\u7559\u7A7A\u81EA\u52A8\u4ECE\u57DF\u540D\u914D\u7F6E\u83B7\u53D6" /></div>' +
        '<button class="btn btn-primary btn-jelly" onclick="createAccount()">\u6DFB\u52A0\u8D26\u6237</button>' +
        '</div></div>' +
        '<div class="section"><h3 class="section-title" style="font-size:18px;margin-bottom:16px">\u6211\u7684\u8D26\u6237</h3>' +
        renderAccounts() + '</div>';
      return h;
    }

    // ==================== Announcements (\u516C\u544A\uFF1A\u7F6E\u9876\u5168\u6587 + \u8F6E\u64AD\u7F29\u7565\u53EF\u5C55\u5F00) ====================
    // \u5C55\u793A\u89C4\u5219\uFF1Ais_pinned=1 \u7684\u516C\u544A\u76F4\u51FA\u5B8C\u6574\u5185\u5BB9\uFF08\u5E26\u300C\u7F6E\u9876\u300D\u5FBD\u6807\uFF09\uFF1B
    // \u5176\u4F59\u516C\u544A\u8FDB\u5165\u8F6E\u64AD\u533A\uFF0C\u9ED8\u8BA4\u6309\u5B57\u6570\u7F29\u7565\uFF083 \u884C\u622A\u65AD\uFF09\uFF0C\u53EF\u70B9\u51FB\u300C\u5C55\u5F00\u5168\u6587/\u6536\u8D77\u300D\u9605\u8BFB\u5B8C\u6574\u5185\u5BB9\u3002
    async function loadAnnouncements() {
      const container = document.getElementById('announcements');
      if (!container) return;
      try {
        const data = await annApi('');
        const list = data.announcements || [];
        if (!list.length) { container.innerHTML = ''; return; }
        const pinned = list.filter(a => a.is_pinned);
        const normal = list.filter(a => !a.is_pinned);
        let h = '';
        // \u7F6E\u9876\uFF1A\u5B8C\u6574\u5185\u5BB9\u76F4\u51FA
        pinned.forEach(function (a) {
          const date = (a.created_at || '').slice(0, 10);
          h += '<div class="announcement-card pinned fade-in">' +
            '<div class="announcement-title">\u{1F4E2} ' + escapeHtml(a.title) +
            '<span class="pin-badge">\u7F6E\u9876</span><span class="announcement-date">' + date + '</span></div>' +
            '<div class="announcement-content">' + escapeHtml(a.content) + '</div></div>';
        });
        // \u666E\u901A\uFF1A\u8FDB\u8F6E\u64AD\uFF0C\u6BCF\u5F20\u7F29\u7565\u53EF\u5C55\u5F00
        if (normal.length) {
          h += '<div class="announcement-carousel">';
          normal.forEach(function (a, i) {
            const date = (a.created_at || '').slice(0, 10);
            h += '<div class="carousel-slide' + (i === 0 ? ' active' : '') + '" id="ann-slide-' + i + '">' +
              '<div class="announcement-card fade-in">' +
              '<div class="announcement-title">\u{1F4E2} ' + escapeHtml(a.title) + '<span class="announcement-date">' + date + '</span></div>' +
              '<div class="announcement-content collapsed" id="ann-body-' + i + '">' + escapeHtml(a.content) + '</div>' +
              '<button type="button" class="announcement-toggle-btn" onclick="toggleAnnouncementBody(' + i + ', this)">\u5C55\u5F00\u5168\u6587</button>' +
              '</div></div>';
          });
          h += '<div class="carousel-dots">';
          normal.forEach(function (_, i) {
            h += '<span class="carousel-dot' + (i === 0 ? ' active' : '') + '" onclick="goAnnouncementSlide(' + i + ')"></span>';
          });
          h += '</div></div>';
        }
        container.innerHTML = h;
        // \u542F\u52A8\u8F6E\u64AD\u5B9A\u65F6\u5207\u6362
        if (normal.length > 1) {
          window.clearInterval(window.__annTimer);
          let idx = 0;
          window.__annTimer = window.setInterval(function () {
            idx = (idx + 1) % normal.length;
            goAnnouncementSlide(idx);
          }, 5000);
        }
      } catch (err) {
        console.error('Failed to load announcements:', err);
      }
    }

    // \u5C55\u5F00/\u6536\u8D77\u67D0\u6761\u8F6E\u64AD\u516C\u544A\u7684\u5168\u6587
    function toggleAnnouncementBody(i, btn) {
      const el = document.getElementById('ann-body-' + i);
      if (!el) return;
      el.classList.toggle('collapsed');
      btn.textContent = el.classList.contains('collapsed') ? '\u5C55\u5F00\u5168\u6587' : '\u6536\u8D77';
    }

    // \u8F6E\u64AD\u5207\u5230\u7B2C i \u5F20
    function goAnnouncementSlide(i) {
      const slides = document.querySelectorAll('#announcements .carousel-slide');
      const dots = document.querySelectorAll('#announcements .carousel-dot');
      slides.forEach(function (s, k) { s.classList.toggle('active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('active', k === i); });
    }

    // ==================== Init ====================
    async function init() {
      // \u6240\u6709\u6570\u636E\u52A0\u8F7D\u5747\u5355\u72EC\u515C\u5E95\uFF0C\u4E00\u65E6\u67D0\u63A5\u53E3\u5931\u8D25\u4E0D\u80FD\u8BA9\u6574\u6BB5 init \u4E2D\u65AD\uFF0C
      // \u5426\u5219 render() \u4E0D\u6267\u884C\uFF0C\u9875\u9762\u4F1A\u4E00\u76F4\u505C\u5728\u52A0\u8F7D\u8F6C\u5708\uFF08\u9876/\u5E95\u7531\u670D\u52A1\u7AEF\u6E32\u67D3\u3001\u4E0D\u53D7\u5F71\u54CD\uFF0C\u6B63\u662F \u201C\u4E2D\u95F4\u8F6C\u5708\u201D \u7684\u73B0\u8C61\uFF09\u3002
      try {
        setTheme(getTheme());
        renderHeaderUser();
        try { loadAnnouncements(); }
        catch (err) { console.error('Failed to load announcements:', err); }

        if (state.user) {
          state.currentView = 'dashboard';
          try { await loadDashboardData(); }
          catch (err) { console.error('Failed to load dashboard data:', err); }

          // \u52A0\u8F7D\u90AE\u7BB1\u9A8C\u8BC1\u914D\u7F6E
          try {
            const config = await api('/verification/config');
            state.emailVerificationRequired = config.required;
            state.allowedEmailDomains = config.allowed_domains || [];

            // \u68C0\u67E5\u662F\u5426\u9700\u8981\u663E\u793A\u9A8C\u8BC1\u63D0\u793A
            if (state.emailVerificationRequired && !state.user.email_verified) {
              state.showVerifyBanner = true;
            }
          } catch (err) {
            console.error('Failed to load verification config:', err);
          }

          // \u52A0\u8F7D\u8D26\u6237\u5217\u8868
          try { await loadAccounts(); }
          catch (err) { console.error('Failed to load accounts:', err); }

          if (state.user.is_admin) {
            try { loadAdminData(); }
            catch (err) { console.error('Failed to load admin data:', err); }
          }
        }
      } catch (err) {
        console.error('init error:', err);
      }

      // \u65E0\u8BBA\u4E0A\u9762\u6570\u636E\u662F\u5426\u6210\u529F\u52A0\u8F7D\uFF0C\u90FD\u5FC5\u987B\u6E32\u67D3\uFF0C\u907F\u514D\u505C\u7559\u5728\u52A0\u8F7D\u8F6C\u5708
      render();
    }

    init();
  <\/script>

  <footer class="footer">
    <div class="container">
      `, "\n      <p>Powered by Cloudflare Workers &amp; D1 \xB7 ", '</p>\n      <p style="margin-top:8px;font-size:12px;color:var(--text-muted);">\n        \u611F\u8C22 <a href="https://github.com/Little100/cloudflare_subdomain_provisioning" target="_blank" rel="noopener">Little100/cloudflare_subdomain_provisioning</a> \u5F00\u6E90\u9879\u76EE\n      </p>\n      ', "\n      ", "\n    </div>\n  </footer>\n</body>\n</html>"], ['<!DOCTYPE html>\n<html lang="zh-CN" data-theme="dark">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>', `</title>
  <style>
    :root {
      --font-sans: 'Comic Sans MS', 'YouYuan', '\u5E7C\u5706', 'KaiTi', '\u6977\u4F53', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
      --font-mono: 'Comic Sans MS', 'Consolas', 'Courier New', monospace;
      --radius: 16px;
      --radius-sm: 10px;
      --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* ========== \u84DD\u767D\u8272\u7CFB\u4E3B\u9898 ========== */
    [data-theme="dark"] {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --bg-card: #1e293b;
      --bg-hover: #334155;
      --bg-input: #0f172a;
      --border: #334155;
      --border-hover: #475569;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --accent-bg: rgba(59, 130, 246, 0.15);
      --accent-border: rgba(59, 130, 246, 0.4);
      --danger: #ef4444;
      --danger-hover: #f87171;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --success: #22c55e;
      --success-bg: rgba(34, 197, 94, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
      --pending-bg: rgba(139, 92, 246, 0.15);
      --pending: #8b5cf6;
      --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.3);
      --glass-bg: rgba(30, 41, 59, 0.8);
      --bg-image: var(--bg-image-dark);
      --overlay-fallback: rgba(15, 23, 42, 0.7);
    }

    [data-theme="light"] {
      --bg-primary: #eff5ff;
      --bg-secondary: #ffffff;
      --bg-tertiary: #e4efff;
      --bg-card: #ffffff;
      --bg-hover: #e4efff;
      --bg-input: #ffffff;
      --border: #d4e4f8;
      --border-hover: #b3cef6;
      --text-primary: #0b2b4f;
      --text-secondary: #3c5e85;
      --text-muted: #7b9dc2;
      --accent: #1d7dfa;
      --accent-hover: #3b82f6;
      --accent-bg: rgba(29, 125, 250, 0.10);
      --accent-border: rgba(29, 125, 250, 0.32);
      --danger: #d64040;
      --danger-hover: #ef4444;
      --danger-bg: rgba(214, 64, 64, 0.08);
      --success: #14914b;
      --success-bg: rgba(20, 145, 75, 0.08);
      --warning: #d97706;
      --warning-bg: rgba(217, 119, 6, 0.08);
      --pending-bg: rgba(124, 58, 237, 0.08);
      --pending: #7c3aed;
      --shadow: 0 8px 26px rgba(29, 78, 138, 0.10);
      --shadow-sm: 0 4px 12px rgba(29, 78, 138, 0.06);
      --glass-bg: rgba(255, 255, 255, 0.80);
      --overlay-fallback: rgba(230, 243, 255, 0.70);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font-sans);
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      transition: background var(--transition), color var(--transition);
      position: relative;
    }

    /* \u80CC\u666F\u56FE\u4E0E\u906E\u7F69 */
    .bg-image-wrapper {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
    }
    .bg-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: blur(2px);
      transform: scale(1.05);
    }
    .bg-overlay {
      position: absolute;
      inset: 0;
      background: `, `;
    }
    a { color: var(--accent); text-decoration: none; transition: all var(--transition); }
    a:hover { color: var(--accent-hover); }

    .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }

    /* ========== \u53EF\u7231\u73BB\u7483\u6001 Header ========== */
    .header {
      background: var(--glass-bg);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid var(--border);
      padding: 16px 0;
      position: sticky;
      top: 0;
      z-index: 100;
      transition: all var(--transition);
    }
    .header .container { display: flex; align-items: center; justify-content: space-between; }
    .logo { 
      font-size: 20px; 
      font-weight: 700; 
      color: var(--text-primary); 
      display: flex; 
      align-items: center; 
      gap: 10px;
      transition: all var(--transition);
    }
    .logo-icon { 
      width: 36px; 
      height: 36px; 
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      border-radius: 12px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      color: white; 
      font-size: 18px; 
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .logo:hover .logo-icon {
      transform: scale(1.1) rotate(-5deg);
    }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .user-info { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      padding: 8px 14px; 
      background: var(--bg-tertiary); 
      border-radius: var(--radius-sm); 
      border: 1px solid var(--border);
      transition: all var(--transition);
    }
    .user-info:hover {
      border-color: var(--border-hover);
      transform: translateY(-1px);
    }
    .user-avatar { 
      width: 28px; 
      height: 28px; 
      border-radius: 50%; 
      border: 2px solid var(--accent);
      transition: transform 0.3s ease;
    }
    .user-info:hover .user-avatar {
      transform: scale(1.1);
    }
    .user-name { 
      font-size: 14px; 
      font-weight: 500; 
      color: var(--text-primary); 
    }

    /* ========== \u679C\u51BB\u6309\u94AE\u6837\u5F0F ========== */
    .btn { 
      display: inline-flex; 
      align-items: center; 
      justify-content: center; 
      gap: 8px; 
      padding: 12px 24px; 
      border: none; 
      border-radius: var(--radius-sm); 
      font-size: 14px; 
      font-weight: 600; 
      font-family: var(--font-sans); 
      cursor: pointer; 
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      white-space: nowrap; 
      text-decoration: none;
      position: relative;
      overflow: hidden;
    }
    .btn:active {
      transform: scale(0.95);
    }
    .btn:disabled { 
      opacity: 0.5; 
      cursor: not-allowed;
      transform: none !important;
    }
    .btn-primary { 
      background: linear-gradient(135deg, #3b82f6, #2563eb); 
      color: white; 
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    }
    .btn-primary:active {
      transform: scale(0.95) translateY(0);
    }
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }
    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
    }
    .btn-danger:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }
    .btn-success {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
    }
    .btn-success:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
    }
    [data-theme="light"] .btn-primary {
      box-shadow: 0 4px 14px rgba(29, 125, 250, 0.25);
    }
    [data-theme="light"] .btn-primary:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(29, 125, 250, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-secondary {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    [data-theme="light"] .btn-secondary:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgba(29, 78, 138, 0.10);
      transform: translateY(-2px);
    }
    [data-theme="light"] .btn-danger {
      box-shadow: 0 4px 14px rgba(214, 64, 64, 0.25);
    }
    [data-theme="light"] .btn-danger:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(214, 64, 64, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-success {
      box-shadow: 0 4px 14px rgba(20, 145, 75, 0.25);
    }
    [data-theme="light"] .btn-success:hover:not(:disabled) {
      box-shadow: 0 8px 24px rgba(20, 145, 75, 0.35);
      transform: translateY(-3px);
    }
    [data-theme="light"] .btn-github {
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    }
    [data-theme="light"] .btn-github:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      transform: translateY(-3px);
    }
    .btn-ghost { 
      background: transparent; 
      color: var(--text-secondary); 
      border: none; 
      padding: 8px; 
      border-radius: var(--radius-sm);
    }
    .btn-ghost:hover { 
      color: var(--text-primary); 
      background: var(--bg-hover);
      transform: scale(1.1);
    }
    .btn-sm { 
      padding: 8px 16px; 
      font-size: 13px; 
    }
    .btn-github { 
      background: linear-gradient(135deg, #24292e, #373e47); 
      color: white; 
      border: none; 
      padding: 14px 32px; 
      font-size: 16px; 
      border-radius: var(--radius);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
    }
    .btn-github:hover { 
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .btn-github:active {
      transform: scale(0.95) translateY(0);
    }

    /* \u679C\u51BB\u52A8\u753B */
    @keyframes jelly {
      0% { transform: scale(1, 1); }
      30% { transform: scale(1.25, 0.75); }
      40% { transform: scale(0.75, 1.25); }
      50% { transform: scale(1.15, 0.85); }
      65% { transform: scale(0.95, 1.05); }
      75% { transform: scale(1.05, 0.95); }
      100% { transform: scale(1, 1); }
    }
    .btn-jelly:active {
      animation: jelly 0.6s ease;
    }

    /* \u70B9\u51FB\u6CE2\u7EB9\u6548\u679C */
    .btn::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }
    .btn:active::after {
      width: 200px;
      height: 200px;
      opacity: 0;
    }

    .theme-toggle { 
      width: 40px; 
      height: 40px; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      cursor: pointer; 
      background: var(--bg-tertiary); 
      border: 1px solid var(--border); 
      color: var(--text-secondary); 
      font-size: 18px; 
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .theme-toggle:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: var(--border-hover);
      transform: rotate(180deg) scale(1.1);
    }
    [data-theme="light"] .theme-toggle:hover {
      background: var(--accent-bg);
      color: var(--accent);
      border-color: var(--accent-border);
    }

    /* ========== \u53EF\u7231\u5361\u7247 ========== */
    .card { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 24px; 
      transition: all var(--transition);
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
      opacity: 0;
      transition: opacity var(--transition);
    }
    .card-hover:hover { 
      border-color: var(--border-hover); 
      box-shadow: var(--shadow-sm);
      transform: translateY(-4px);
    }
    .card-hover:hover::before {
      opacity: 1;
    }
    .card:hover {
      border-color: var(--border-hover);
      box-shadow: var(--shadow-sm);
      transform: translateY(-3px);
    }
    [data-theme="light"] .card:hover::before {
      opacity: 1;
    }
    .card-title { 
      font-size: 16px; 
      font-weight: 600; 
      margin-bottom: 16px; 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
    }

    /* ========== \u8868\u5355\u6837\u5F0F ========== */
    .form-group { margin-bottom: 16px; }
    .form-label { 
      display: block; 
      font-size: 13px; 
      font-weight: 600; 
      color: var(--text-secondary); 
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .form-input, .form-select { 
      width: 100%; 
      padding: 12px 16px; 
      background: var(--bg-input); 
      border: 2px solid var(--border); 
      border-radius: var(--radius-sm); 
      color: var(--text-primary); 
      font-size: 14px; 
      font-family: var(--font-sans); 
      transition: all var(--transition); 
      outline: none;
    }
    .form-input:focus, .form-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-bg);
      transform: translateY(-2px);
    }
    [data-theme="light"] .form-input:focus,
    [data-theme="light"] .form-select:focus {
      box-shadow: 0 0 0 6px rgba(29, 125, 250, 0.12);
      transform: translateY(-2px);
      border-color: var(--accent-hover);
    }
    .form-input::placeholder { color: var(--text-muted); }
    .form-select {
      appearance: none;
      -webkit-appearance: none;
      cursor: pointer;
      padding-right: 38px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 14px;
      position: relative;
    }
    .form-select:hover { border-color: var(--accent-hover); }
    .form-select option { background: var(--bg-card); color: var(--text-primary); padding: 6px 10px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-row-3 { display: grid; grid-template-columns: 140px 1fr 1fr; gap: 12px; }
    .form-inline { display: flex; align-items: flex-end; gap: 8px; }
    .form-inline .form-group { flex: 1; margin-bottom: 0; }
    .subdomain-input-group { display: flex; align-items: center; gap: 0; }
    .subdomain-input-group .form-input { 
      border-radius: var(--radius-sm) 0 0 var(--radius-sm); 
      border-right: none; 
      text-align: right;
    }
    .subdomain-input-group .domain-suffix { 
      padding: 12px 16px; 
      background: var(--bg-tertiary); 
      border: 2px solid var(--border); 
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0; 
      color: var(--text-secondary); 
      font-size: 14px; 
      white-space: nowrap; 
      font-family: var(--font-mono);
      border-left: none;
    }
    textarea.form-input { resize: vertical; min-height: 80px; }

    /* ========== \u8868\u683C ========== */
    .table-wrap { overflow-x: auto; border-radius: var(--radius-sm); }
    table { width: 100%; border-collapse: collapse; }
    th { 
      text-align: left; 
      padding: 12px 16px; 
      font-size: 12px; 
      font-weight: 600; 
      color: var(--text-muted); 
      text-transform: uppercase; 
      letter-spacing: 0.08em;
      border-bottom: 2px solid var(--border);
      background: var(--bg-tertiary);
    }
    td { 
      padding: 14px 16px; 
      font-size: 14px; 
      border-bottom: 1px solid var(--border); 
      color: var(--text-primary); 
      transition: background var(--transition);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { 
      background: var(--bg-hover);
    }
    .mono { 
      font-family: var(--font-mono); 
      font-size: 13px;
      background: var(--bg-tertiary);
      padding: 4px 8px;
      border-radius: 4px;
    }

    /* ========== \u6807\u7B7E ========== */
    .badge { 
      display: inline-flex; 
      align-items: center; 
      gap: 4px;
      padding: 4px 12px; 
      border-radius: 999px; 
      font-size: 12px; 
      font-weight: 600;
      transition: all var(--transition);
    }
    .badge-type { 
      background: var(--accent-bg); 
      color: var(--accent); 
      border: 1px solid var(--accent-border);
    }
    .badge-proxied { 
      background: var(--warning-bg); 
      color: var(--warning);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
    }
    .badge-pending { 
      background: var(--pending-bg); 
      color: var(--pending);
      animation: pulse 2s ease-in-out infinite;
    }
    .badge-approved { 
      background: var(--success-bg); 
      color: var(--success);
    }
    .badge-rejected { 
      background: var(--danger-bg); 
      color: var(--danger);
    }

    /* \u8109\u51B2\u52A8\u753B */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* ========== Hero \u533A\u57DF ========== */
    .hero { 
      text-align: center; 
      padding: 80px 0 60px; 
    }
    .hero h1 { 
      font-size: 52px; 
      font-weight: 800; 
      letter-spacing: -0.03em; 
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
      -webkit-background-clip: text; 
      -webkit-text-fill-color: transparent; 
      background-clip: text; 
      margin-bottom: 20px;
      animation: gradientShift 3s ease infinite;
      background-size: 200% 200%;
    }
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .hero p { 
      font-size: 18px; 
      color: var(--text-secondary); 
      max-width: 520px; 
      margin: 0 auto 32px;
      line-height: 1.7;
    }
    .features { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 20px; 
      margin: 48px 0; 
    }
    .feature-card { 
      text-align: center; 
      padding: 32px 20px;
      transition: all var(--transition);
    }
    .feature-card:hover {
      transform: translateY(-8px);
    }
    .feature-icon { 
      font-size: 40px; 
      margin-bottom: 16px;
      display: inline-block;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .feature-card:hover .feature-icon {
      transform: scale(1.2) rotate(-10deg);
    }
    .feature-card h3 { 
      font-size: 16px; 
      font-weight: 600; 
      margin-bottom: 8px; 
    }
    .feature-card p { 
      font-size: 13px; 
      color: var(--text-secondary); 
    }

    /* ========== Dashboard ========== */
    .dashboard { padding: 32px 0; }
    .section { margin-bottom: 32px; }
    .section-header { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      margin-bottom: 20px; 
    }
    .section-title { 
      font-size: 24px; 
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .empty { 
      text-align: center; 
      padding: 64px 20px; 
      color: var(--text-muted); 
    }
    .empty-icon { 
      font-size: 64px; 
      margin-bottom: 16px;
      opacity: 0.5;
    }

    /* ========== \u5B50\u57DF\u540D\u5361\u7247 ========== */
    .subdomain-card { 
      display: flex; 
      align-items: center; 
      justify-content: space-between; 
      padding: 20px 24px; 
      margin-bottom: 12px;
      transition: all var(--transition);
    }
    .subdomain-card:hover {
      transform: translateX(8px);
    }
    .subdomain-info h4 { 
      font-size: 18px; 
      font-weight: 700; 
      font-family: var(--font-mono);
      margin-bottom: 4px;
    }
    .subdomain-info p { 
      font-size: 13px; 
      color: var(--text-secondary); 
      margin-top: 4px;
    }
    .subdomain-actions { 
      display: flex; 
      gap: 8px; 
      align-items: center; 
    }

    .status-note { 
      margin-top: 10px; 
      padding: 12px 16px; 
      border-radius: var(--radius-sm); 
      font-size: 13px; 
      display: flex;
      align-items: center;
      gap: 8px;
      border-left: 3px solid;
    }
    .status-note.pending { 
      background: var(--pending-bg); 
      color: var(--pending);
      border-left-color: var(--pending);
    }
    .status-note.rejected { 
      background: var(--danger-bg); 
      color: var(--danger);
      border-left-color: var(--danger);
    }

    /* ========== DNS \u7BA1\u7406 ========== */
    .dns-header { 
      display: flex; 
      align-items: center; 
      gap: 12px; 
      margin-bottom: 24px; 
    }
    .dns-header h2 { 
      font-size: 24px; 
      font-weight: 700;
    }
    .back-link { 
      display: inline-flex; 
      align-items: center; 
      gap: 6px; 
      color: var(--text-secondary); 
      font-size: 14px;
      font-weight: 500;
      transition: all var(--transition);
    }
    .back-link:hover { 
      color: var(--text-primary);
      transform: translateX(-4px);
    }
    .record-form { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 24px; 
      margin-bottom: 24px;
      transition: all var(--transition);
    }
    .record-form:hover {
      border-color: var(--border-hover);
    }
    .record-form-title { 
      font-size: 14px; 
      font-weight: 600; 
      margin-bottom: 16px; 
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ========== \u4EE3\u7406\u5F00\u5173\u6309\u94AE\uFF08\u9EC4\u8272\u4E91\u6735\uFF09 ========== */
    .proxied-toggle {
      position: relative;
      width: 56px;
      height: 28px;
      background: var(--bg-tertiary);
      border-radius: 999px;
      border: 2px solid var(--border);
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .proxied-toggle.active {
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      border-color: #f59e0b;
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
    }
    .proxied-toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .proxied-toggle.active::after {
      transform: translateX(28px);
    }
    .proxied-toggle:hover {
      transform: scale(1.1);
    }
    .proxied-toggle:active {
      transform: scale(0.95);
    }

    /* \u4EE3\u7406\u72B6\u6001\u6307\u793A\u5668 */
    .proxy-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      transition: all var(--transition);
    }
    .proxy-indicator.proxied {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #92400e;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
    }
    .proxy-indicator.direct {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }

    /* ========== \u7BA1\u7406\u6807\u7B7E\u9875 ========== */
    .tabs { 
      display: flex; 
      gap: 4px; 
      margin-bottom: 20px; 
      border-bottom: 1px solid var(--border); 
      padding-bottom: 0; 
    }
    .tab { 
      padding: 12px 24px; 
      cursor: pointer; 
      font-size: 14px; 
      font-weight: 600; 
      color: var(--text-secondary); 
      border-bottom: 2px solid transparent; 
      transition: all var(--transition); 
      background: none; 
      border-top: none; 
      border-left: none; 
      border-right: none; 
      font-family: var(--font-sans);
      position: relative;
    }
    .tab:hover { 
      color: var(--text-primary); 
      transform: translateY(-2px);
    }
    .tab.active { 
      color: var(--accent); 
      border-bottom-color: var(--accent);
    }
    .tab.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 2px;
      background: var(--accent);
      border-radius: 2px;
    }
    .tab .tab-count { 
      background: var(--danger); 
      color: white; 
      border-radius: 999px; 
      padding: 2px 8px; 
      font-size: 11px; 
      margin-left: 6px;
      animation: pulse 2s ease-in-out infinite;
    }

    /* ========== \u6A21\u6001\u6846 ========== */
    .modal-overlay { 
      position: fixed; 
      inset: 0; 
      background: rgba(0, 0, 0, 0.6); 
      backdrop-filter: blur(8px);
      display: flex; 
      align-items: center; 
      justify-content: center; 
      z-index: 200; 
      opacity: 0; 
      pointer-events: none; 
      transition: opacity 0.3s ease; 
    }
    .modal-overlay.active { 
      opacity: 1; 
      pointer-events: auto; 
    }
    .modal { 
      background: var(--bg-card); 
      border: 1px solid var(--border); 
      border-radius: var(--radius); 
      padding: 32px; 
      max-width: 480px; 
      width: 90%; 
      box-shadow: var(--shadow); 
      transform: scale(0.9) translateY(20px); 
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .modal-overlay.active .modal { 
      transform: scale(1) translateY(0); 
    }
    .modal h3 { 
      font-size: 20px; 
      font-weight: 700; 
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .modal p { 
      color: var(--text-secondary); 
      font-size: 14px; 
      margin-bottom: 20px;
      line-height: 1.6;
    }
    .modal-actions { 
      display: flex; 
      gap: 10px; 
      justify-content: flex-end; 
    }

    /* ========== Toast \u901A\u77E5 ========== */
    .toast-container { 
      position: fixed; 
      top: 80px; 
      right: 20px; 
      z-index: 300; 
      display: flex; 
      flex-direction: column; 
      gap: 8px; 
    }
    .toast { 
      padding: 14px 24px; 
      border-radius: var(--radius-sm); 
      font-size: 14px; 
      font-weight: 500; 
      box-shadow: var(--shadow); 
      animation: slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                 slideOutRight 0.4s ease 2.6s forwards; 
      max-width: 380px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast-success { 
      background: linear-gradient(135deg, #22c55e, #16a34a); 
      color: white; 
    }
    .toast-error { 
      background: linear-gradient(135deg, #ef4444, #dc2626); 
      color: white; 
    }
    .toast-info { 
      background: linear-gradient(135deg, #3b82f6, #2563eb); 
      color: white; 
    }
    @keyframes slideInRight { 
      from { transform: translateX(120%); opacity: 0; } 
      to { transform: translateX(0); opacity: 1; } 
    }
    @keyframes slideOutRight { 
      to { opacity: 0; transform: translateX(120%); } 
    }

    /* ========== \u52A0\u8F7D\u52A8\u753B ========== */
    .spinner { 
      display: inline-block; 
      width: 24px; 
      height: 24px; 
      border: 3px solid var(--border); 
      border-top-color: var(--accent); 
      border-radius: 50%; 
      animation: spin 0.8s linear infinite; 
    }
    @keyframes spin { 
      to { transform: rotate(360deg); } 
    }
    .loading-center { 
      display: flex; 
      justify-content: center; 
      padding: 60px; 
    }

    /* ========== \u590D\u9009\u6846 ========== */
    .checkbox-label { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      cursor: pointer; 
      font-size: 14px; 
      color: var(--text-secondary);
      transition: all var(--transition);
    }
    .checkbox-label:hover {
      color: var(--text-primary);
    }
    .checkbox-label input[type="checkbox"] { 
      width: 18px; 
      height: 18px; 
      accent-color: var(--accent);
      cursor: pointer;
    }

    /* ========== \u5BA1\u6838\u5361\u7247 ========== */
    .review-card { 
      border-left: 4px solid var(--pending); 
    }
    .review-card .review-meta { 
      display: flex; 
      gap: 16px; 
      align-items: center; 
      font-size: 13px; 
      color: var(--text-secondary); 
      margin-top: 8px; 
      flex-wrap: wrap;
    }

    /* ========== \u54CD\u5E94\u5F0F ========== */
    @media (max-width: 768px) {
      .hero h1 { font-size: 36px; }
      .features { grid-template-columns: 1fr; }
      .form-row, .form-row-3 { grid-template-columns: 1fr; }
      .subdomain-card { 
        flex-direction: column; 
        gap: 16px; 
        align-items: flex-start; 
      }
      .user-name { display: none; }
      .section-title { font-size: 20px; }
    }

    /* ========== \u6EDA\u52A8\u6761 ========== */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { 
      background: var(--border); 
      border-radius: 4px; 
    }
    ::-webkit-scrollbar-thumb:hover { 
      background: var(--border-hover); 
    }

    /* ========== \u52A8\u753B ========== */
    .fade-in { 
      animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); 
    }
    @keyframes fadeIn { 
      from { opacity: 0; transform: translateY(12px); } 
      to { opacity: 1; transform: translateY(0); } 
    }

    .jelly {
      animation: jelly 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .bounce-in {
      animation: bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes bounceIn {
      0% { transform: scale(0.8); opacity: 0; }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }

    /* \u6D6E\u52A8\u52A8\u753B */
    .float {
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    /* \u5F39\u8DF3\u52A8\u753B */
    .bounce {
      animation: bounce 2s ease-in-out infinite;
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-15px); }
    }

    /* \u6447\u6643\u52A8\u753B */
    .shake:hover {
      animation: shake 0.5s ease;
    }

    /* \u6301\u7EED\u8109\u52A8\u53D1\u5149\uFF08Cloudflare \u52A0\u901F\u56FE\u6807\u7528\uFF0C\u81EA\u52A8\u64AD\u653E\uFF09 */
    .pulse-soft {
      display: inline-block;
      animation: pulseSoft 2.4s ease-in-out infinite;
      filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.5));
    }
    @keyframes pulseSoft {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.18); opacity: 0.75; }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .footer { 
      text-align: center; 
      padding: 40px 0; 
      color: var(--text-muted); 
      font-size: 13px; 
      border-top: 1px solid var(--border); 
      margin-top: 60px; 
    }
    .footer-friendlinks {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .friend-link-label {
      font-weight: 600;
      color: var(--text-secondary);
    }
    .friend-link {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .friend-link:hover {
      color: white;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-color: transparent;
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
    }
    .contact-admin-btn {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      padding: 10px 20px;
    }
    .contact-admin-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(139, 92, 246, 0.4);
      color: #fff;
    }

    /* \u8D26\u6237\u9009\u62E9\u4E0B\u62C9 */
    .account-select {
      position: relative;
    }
    .account-select-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-top: 4px;
      box-shadow: var(--shadow);
      z-index: 50;
      max-height: 200px;
      overflow-y: auto;
    }
    .account-select-item {
      padding: 10px 14px;
      cursor: pointer;
      transition: all var(--transition);
      border-bottom: 1px solid var(--border);
    }
    .account-select-item:last-child {
      border-bottom: none;
    }
    .account-select-item:hover {
      background: var(--bg-hover);
    }
    .account-select-item.active {
      background: var(--accent-bg);
      color: var(--accent);
    }

    /* ========== \u516C\u544A\u6A2A\u5E45 ========== */
    .announcements-container {
      margin-top: 16px;
    }
    .announcement-card {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12));
      border: 1px solid var(--accent-border);
      border-radius: var(--radius);
      padding: 14px 18px;
      margin-bottom: 12px;
      backdrop-filter: blur(8px);
      transition: all var(--transition);
    }
    .announcement-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .announcement-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .announcement-date {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 400;
      margin-left: auto;
    }
    .announcement-content {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.7;
    }
    /* ===== \u516C\u544A\u8F6E\u64AD + \u7F6E\u9876 + \u7F29\u7565\u5C55\u5F00 ===== */
    .announcement-carousel {
      position: relative;
      /* \u4E0D\u80FD here overflow:hidden\uFF0C\u5426\u5219\u5C55\u5F00\u540E\u7684\u5168\u6587\u4F1A\u88AB\u88C1\u526A\uFF1B
         \u7528 visible\uFF0C\u8BA9\u300C\u5C55\u5F00\u300D\u53EF\u81EA\u7136\u6491\u9AD8\u9605\u8BFB\u5168\u6587\u3002\u672A\u5C55\u5F00\u65F6\u5404\u5361\u7247
         \u7F29\u7565\u540C\u9AD8\uFF083 \u884C\uFF09+ min-height \u515C\u5E95\uFF0C\u5207\u6362\u8F6E\u64AD\u4E0D\u4E0A\u4E0B\u8DF3\u52A8\u3002 */
      overflow: visible;
      min-height: 134px;
    }
    /* \u8F6E\u64AD\u5185\u6807\u9898\u5355\u884C\u7701\u7565\uFF0C\u9632\u6B62\u6807\u9898\u6362\u884C\u9020\u6210\u9AD8\u5EA6\u5DEE\u5F02 */
    .announcement-carousel .announcement-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* \u7F29\u7565\u533A\u56FA\u5B9A 3 \u884C\u5360\u4F4D\u9AD8\u5EA6\uFF08\u4E0E -webkit-line-clamp:3 \u4E00\u81F4\uFF0C1.7 \u884C\u9AD8\uFF09\uFF0C
       \u4FDD\u8BC1\u672A\u5C55\u5F00\u65F6\u6BCF\u5F20\u516C\u544A\u5361\u7247\u540C\u9AD8\uFF0C\u5207\u6362\u8F6E\u64AD\u5E73\u7A33 */
    .announcement-carousel .announcement-content.collapsed {
      height: 5.1em;
      overflow: hidden;
      white-space: normal;
    }
    .carousel-slide {
      display: none;
    }
    .carousel-slide.active {
      display: block;
      animation: fadeInUp var(--transition);
    }
    .announcement-card.pinned {
      border-color: var(--accent);
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.18);
    }
    .pin-badge {
      display: inline-block;
      font-size: 10px;
      color: #fff;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 999px;
      padding: 1px 8px;
      margin-left: 6px;
      font-weight: 600;
    }
    .announcement-content.collapsed {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .announcement-toggle-btn {
      margin-top: 6px;
      padding: 2px 12px;
      font-size: 12px;
      cursor: pointer;
      color: var(--accent);
      background: transparent;
      border: 1px solid var(--accent-border);
      border-radius: 999px;
      transition: all var(--transition);
    }
    .announcement-toggle-btn:hover {
      border-color: var(--accent);
      background: rgba(59, 130, 246, 0.1);
    }
    .carousel-dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 8px;
    }
    .carousel-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--text-muted);
      cursor: pointer;
      opacity: 0.5;
      transition: all var(--transition);
    }
    .carousel-dot.active {
      background: var(--accent);
      opacity: 1;
      width: 18px;
    }

    /* \u90AE\u7BB1\u9A8C\u8BC1\u63D0\u793A */
    .verify-banner {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      padding: 16px 20px;
      border-radius: var(--radius);
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
    }
    .verify-banner p {
      margin: 0;
      font-size: 14px;
    }
    .verify-banner .btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .verify-banner .btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .verify-banner-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
      flex-wrap: wrap;
    }
    .verify-binder {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .verify-binder .form-input {
      max-width: 300px;
      padding: 9px 14px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.95);
      color: #1f2937;
      border-color: rgba(255, 255, 255, 0.4);
      font-family: var(--font-mono);
    }
    .verify-binder .form-input:focus {
      border-color: #fff;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.25);
      transform: none;
    }
    .verify-banner-row .btn-primary {
      background: #fff;
      color: #2563eb;
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
    }
    .verify-banner-row .btn-primary:hover {
      background: #f0f4ff;
      color: #1d4ed8;
      transform: translateY(-2px);
    }

    /* \u591A\u8D26\u6237\u7BA1\u7406\u5361\u7247 */
    .account-card {
      padding: 16px 20px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .account-info {
      flex: 1;
    }
    .account-info h4 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .account-info p {
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }
    .account-actions {
      display: flex;
      gap: 8px;
    }

    /* \u5F00\u5173\u6837\u5F0F */
    .switch {
      position: relative;
      width: 48px;
      height: 24px;
      background: var(--bg-tertiary);
      border-radius: 999px;
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.3s ease;
      flex-shrink: 0;
    }
    .switch.active {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border-color: #3b82f6;
    }
    .switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: white;
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .switch.active::after {
      transform: translateX(24px);
    }

    /* ========== \u53EF\u7231 UI \u589E\u5F3A ========== */
    /* \u54C1\u724C\u6E10\u53D8\u6587\u5B57 */
    .gradient-text {
      background: linear-gradient(120deg, #60a5fa, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    /* \u7279\u6027\u5361\u7247\u60AC\u6D6E\u8F7B\u5FAE\u4E0A\u6D6E + \u67D4\u548C\u5149\u6655 */
    .feature-card {
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease;
    }
    .feature-card:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 14px 30px rgba(139, 92, 246, 0.18), 0 2px 8px rgba(0,0,0,0.06);
    }
    /* \u4E3B\u8981\u6309\u94AE\u679C\u51BB\u547C\u5438\u5149\u6655\uFF08\u4EC5\u4E3B\u6309\u94AE\uFF0C\u5B89\u5168\u53E0\u52A0\uFF09 */
    .btn-primary.btn-jelly {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      background-size: 200% 200%;
      animation: gradientShift 6s ease infinite;
    }
    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    /* \u9875\u9762\u53F3\u4FA7/\u5E95\u90E8\u53EF\u7231\u7684\u6F02\u6D6E\u88C5\u9970\u6C14\u6CE1 */
    .deco-bubble {
      position: fixed;
      border-radius: 50%;
      pointer-events: none;
      z-index: -1;
      filter: blur(3px);
      opacity: 0.35;
      animation: bubbleFloat 12s ease-in-out infinite;
    }
    @keyframes bubbleFloat {
      0%, 100% { transform: translateY(0) translateX(0); }
      50% { transform: translateY(-26px) translateX(14px); }
    }
    /* \u9762\u677F\u5207\u6362\u6DE1\u5165 */
    .section-header { animation: fadeIn 0.5s ease; }
  </style>
  
  `, `
</head>
<body>
  <!-- \u53EF\u7231\u7684\u6F02\u6D6E\u88C5\u9970\u6C14\u6CE1 -->
  <div class="deco-bubble" style="width:120px;height:120px;top:18%;right:-30px;background:linear-gradient(135deg,#38bdf8,#818cf8);"></div>
  <div class="deco-bubble" style="width:90px;height:90px;bottom:12%;left:-24px;background:linear-gradient(135deg,#f472b6,#a78bfa);animation-delay:-4s;"></div>
  <div class="deco-bubble" style="width:64px;height:64px;top:60%;right:6%;background:linear-gradient(135deg,#34d399,#38bdf8);animation-delay:-8s;"></div>

  <header class="header">
    <div class="container">
      <a href="/" class="logo" onclick="navigate('home'); return false;">
        `, "\n        <span>", `</span>
      </a>
      <div class="header-actions">
        <button class="theme-toggle" onclick="toggleTheme()" title="\u5207\u6362\u4E3B\u9898">
          <span id="theme-icon" style="display:flex;align-items:center;"></span>
        </button>
        <div id="header-user"></div>
      </div>
    </div>
  </header>

  <div id="announcements" class="container announcements-container"></div>

  <main id="app" class="container">
    <div class="loading-center"><div class="spinner"></div></div>
  </main>

  <div class="toast-container" id="toast-container"></div>

  <div class="modal-overlay" id="modal-overlay">
    <div class="modal" id="modal-content">
      <h3 id="modal-title">\u786E\u8BA4</h3>
      <p id="modal-message"></p>
      <div id="modal-body"></div>
      <div class="modal-actions" id="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">\u53D6\u6D88</button>
        <button class="btn btn-danger" id="modal-confirm" onclick="confirmModal()">\u786E\u8BA4</button>
      </div>
    </div>
  </div>

  <script>
    const icons = {
      themeDark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
      themeLight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
      admin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
      pending: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      approved: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      rejected: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      globe: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
      tool: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
      shield: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
      mailbox: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5"></path></svg>',
      clipboard: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
      users: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
      email: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
      cloud: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>',
      key: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:text-bottom"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>'
    };

    const state = {
      user: `, `,
      domains: [],
      subdomains: [],
      records: [],
      config: {},
      currentSubdomain: null,
      currentView: 'home',
      modalCallback: null,
      editingRecord: null,
      // Admin state
      adminTab: 'pending',
      adminPending: [],
      adminAll: [],
      adminUsers: [],
      adminAnnouncements: [],
      editingAnnouncement: null,
      // Cloudflare accounts
      accounts: [],
      selectedAccount: null,
      // Email verification
      emailVerificationRequired: false,
      allowedEmailDomains: [],
      showVerifyBanner: false,
    };

    // ==================== API ====================
    async function api(path, opts = {}) {
      const res = await fetch('/api' + path, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '\u8BF7\u6C42\u5931\u8D25');
      return data;
    }

    // \u516C\u544A\u63A5\u53E3\uFF08\u6302\u5728\u9876\u5C42 /announcements \u800C\u975E /api\uFF0C\u516C\u5F00\u5217\u8868\u4EE5\u53CA /admin \u7BA1\u7406\u5747\u7528 cookie \u8BA4\u8BC1\uFF09
    async function annApi(path, opts = {}) {
      const res = await fetch('/announcements' + path, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '\u8BF7\u6C42\u5931\u8D25');
      return data;
    }

    // ==================== Toast ====================
    function toast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const el = document.createElement('div');
      el.className = 'toast toast-' + type + ' bounce-in';
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }

    // ==================== Modal ====================
    function showModal(title, message, callback, opts = {}) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-message').textContent = message;
      document.getElementById('modal-body').innerHTML = opts.bodyHtml || '';
      const actions = document.getElementById('modal-actions');
      const confirmBtn = document.getElementById('modal-confirm');
      confirmBtn.textContent = opts.confirmText || '\u786E\u8BA4';
      confirmBtn.className = 'btn ' + (opts.confirmClass || 'btn-danger btn-jelly');
      document.getElementById('modal-overlay').classList.add('active');
      state.modalCallback = callback;
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('active');
      state.modalCallback = null;
    }

    function confirmModal() {
      if (state.modalCallback) state.modalCallback();
      closeModal();
    }

    // ==================== Theme ====================
    function getTheme() { return localStorage.getItem('theme') || 'dark'; }
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      document.getElementById('theme-icon').innerHTML = theme === 'dark' ? icons.themeDark : icons.themeLight;
    }
    function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

    // ==================== Navigation ====================
    function navigate(view, data) {
      state.currentView = view;
      if (data !== undefined) state.currentSubdomain = data;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderHeaderUser() {
      const el = document.getElementById('header-user');
      if (state.user) {
        let adminLink = '';
        if (state.user.is_admin) {
          adminLink = '<a href="#" class="btn btn-ghost btn-sm" onclick="navigate(\\\\'admin\\\\'); return false;" style="font-size:13px">' + icons.admin + ' \u7BA1\u7406</a>';
        }
        el.innerHTML = '<div class="user-info">' +
          '<img class="user-avatar" src="' + (state.user.avatar_url || '') + '" alt="">' +
          '<span class="user-name">' + escapeHtml(state.user.github_username) + '</span>' +
          '</div>' + adminLink +
          '<a href="/auth/logout" class="btn btn-ghost btn-sm">\u9000\u51FA</a>';
      } else {
        el.innerHTML = '';
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function statusBadge(status) {
      const map = {
        pending: '<span class="badge badge-pending">' + icons.pending + ' \u5F85\u5BA1\u6838</span>',
        approved: '<span class="badge badge-approved">' + icons.approved + ' \u5DF2\u901A\u8FC7</span>',
        rejected: '<span class="badge badge-rejected">' + icons.rejected + ' \u5DF2\u62D2\u7EDD</span>',
      };
      return map[status] || status;
    }

    // ==================== Landing ====================
    function renderLanding() {
      return '<div class="hero fade-in">' +
        '<h1 class="gradient-text">\u83B7\u53D6\u4F60\u7684\u4E13\u5C5E\u5B50\u57DF\u540D</h1>' +
        '<p>\u901A\u8FC7 GitHub \u767B\u5F55\uFF0C\u7533\u8BF7\u5C5E\u4E8E\u81EA\u5DF1\u7684\u4E8C\u7EA7\u57DF\u540D\uFF0C\u7ECF\u7BA1\u7406\u5458\u5BA1\u6838\u540E\u5373\u53EF\u83B7\u5F97\u5B8C\u6574 DNS \u63A7\u5236\u6743\u3002</p>' +
        '<a href="/auth/github" class="btn btn-github btn-jelly">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.744.083-.729.083-.729 1.205.085 1.838 1.237 1.838 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.776.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.51 11.51 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.652.242 2.873.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.604-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>' +
        '\u4F7F\u7528 GitHub \u767B\u5F55' +
        '</a></div>' +
        '<div class="features">' +
        '<div class="card feature-card card-hover"><div class="feature-icon bounce">' + icons.globe + '</div><h3>\u5B89\u5168\u5206\u914D</h3><p>\u7BA1\u7406\u5458\u5BA1\u6838\u901A\u8FC7\u540E\uFF0C\u5373\u53EF\u83B7\u5F97\u4E13\u5C5E\u5B50\u57DF\u540D</p></div>' +
        '<div class="card feature-card card-hover"><div class="feature-icon float">' + icons.tool + '</div><h3>\u5B8C\u6574 DNS \u63A7\u5236</h3><p>\u652F\u6301 A\u3001AAAA\u3001CNAME\u3001MX\u3001TXT\u3001SRV\u3001CAA \u5168\u7C7B\u578B\u8BB0\u5F55</p></div>' +
        '<div class="card feature-card card-hover"><div class="feature-icon pulse-soft">' + icons.shield + '</div><h3>Cloudflare \u52A0\u901F</h3><p>\u4F9D\u6258 Cloudflare \u5168\u7403\u7F51\u7EDC\uFF0C\u4EAB\u53D7 CDN \u52A0\u901F\u4E0E DDoS \u9632\u62A4</p></div>' +
        '</div>';
    }

    // ==================== Dashboard ====================
    async function loadDashboardData() {
      try {
        const [domainData, subData] = await Promise.all([api('/domains'), api('/subdomains')]);
        state.domains = domainData.domains;
        state.config = {
          max_subdomains: domainData.max_subdomains,
          max_records: domainData.max_records,
          banned_prefixes: domainData.banned_prefixes,
          allowed_record_types: domainData.allowed_record_types,
        };
        state.subdomains = subData.subdomains;
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderDashboard() {
      const subs = state.subdomains;
      const activeSubs = subs.filter(s => s.status !== 'rejected');
      const canCreate = activeSubs.length < state.config.max_subdomains;

      let h = '<div class="dashboard fade-in">';

      // \u90AE\u7BB1\u9A8C\u8BC1\u63D0\u793A
      if (state.showVerifyBanner) {
        h += '<div class="verify-banner bounce-in">' +
          '<div class="verify-banner-row">' +
          (state.user.email
            ? '<p>\u{1F4E7} \u8BF7\u9A8C\u8BC1\u60A8\u7684\u90AE\u7BB1 <b>' + escapeHtml(state.user.email) + '</b> \u4EE5\u4F7F\u7528\u5168\u90E8\u529F\u80FD</p>' +
              '<button class="btn btn-sm" onclick="sendVerificationEmail()">\u53D1\u9001\u9A8C\u8BC1\u90AE\u4EF6</button>'
            : '<p>\u{1F4E7} \u60A8\u8FD8\u6CA1\u6709\u7ED1\u5B9A\u90AE\u7BB1\uFF0C\u8BF7\u5148\u7ED1\u5B9A\u90AE\u7BB1\u540E\u5373\u53EF\u7533\u8BF7\u5B50\u57DF\u540D</p>' +
              '<div class="verify-binder">' +
              '<input type="email" class="form-input" id="bind-email" placeholder="name@' + ((state.allowedEmailDomains && state.allowedEmailDomains[0]) || 'example.com').replace(/\\\\*/g, '') + '" onkeydown="if(event.key===\\\\Enter\\\\'){bindEmail();}" />' +
              '<button class="btn btn-primary btn-sm btn-jelly" onclick="bindEmail()">\u7ED1\u5B9A\u5E76\u53D1\u9001\u9A8C\u8BC1\u90AE\u4EF6</button>' +
              '</div>') +
          '</div>' +
          '</div>';
      }

      if (canCreate) {
        h += '<div class="section">' +
          '<div class="section-header"><h2 class="section-title">\u7533\u8BF7\u5B50\u57DF\u540D</h2></div>' +
          '<div class="card">' +
          '<div class="form-inline">' +
          '<div class="form-group" style="flex:2">' +
          '<label class="form-label">\u5B50\u57DF\u540D</label>' +
          '<div class="subdomain-input-group">' +
          '<input type="text" class="form-input" id="new-subdomain" placeholder="your-name" />' +
          '<select class="form-select domain-suffix" id="new-domain" style="width:auto;border-radius:0 var(--radius-sm) var(--radius-sm) 0;border-left:none;">' +
          state.domains.map(d => '<option value="' + d + '">.' + d + '</option>').join('') +
          '</select></div></div>' +
          '<button class="btn btn-primary btn-jelly" onclick="registerSubdomain()" style="margin-bottom:0;align-self:flex-end;">\u63D0\u4EA4\u7533\u8BF7</button>' +
          '</div>' +
          '<p style="font-size:12px;color:var(--text-muted);margin-top:10px;">\u4EC5\u9650\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u8FDE\u5B57\u7B26\uFF0C\u957F\u5EA6 \u2265 2 \xB7 \u63D0\u4EA4\u540E\u9700\u7BA1\u7406\u5458\u5BA1\u6838</p>' +
          '</div></div>';
      }

      h += '<div class="section"><div class="section-header">' +
        '<h2 class="section-title">\u6211\u7684\u5B50\u57DF\u540D</h2>' +
        '<span style="font-size:13px;color:var(--text-muted)">' + activeSubs.length + ' / ' + state.config.max_subdomains + '</span></div>';

      if (subs.length === 0) {
        h += '<div class="card empty"><div class="empty-icon">' + icons.mailbox + '</div><p>\u8FD8\u6CA1\u6709\u5B50\u57DF\u540D\uFF0C\u5FEB\u53BB\u7533\u8BF7\u4E00\u4E2A\u5427</p></div>';
      } else {
        subs.forEach(sub => {
          const fqdn = sub.subdomain + '.' + sub.domain;
          h += '<div class="card card-hover subdomain-card">' +
            '<div class="subdomain-info">' +
            '<h4>' + escapeHtml(fqdn) + ' ' + statusBadge(sub.status) + '</h4>' +
            '<p>\u521B\u5EFA\u4E8E ' + new Date(sub.created_at).toLocaleDateString('zh-CN') + '</p>';

          if (sub.status === 'pending') {
            h += '<div class="status-note pending" style="display:flex;align-items:center;gap:6px">' + icons.pending + '\u6B63\u5728\u7B49\u5F85\u7BA1\u7406\u5458\u5BA1\u6838\uFF0C\u5BA1\u6838\u901A\u8FC7\u540E\u5373\u53EF\u7BA1\u7406 DNS \u8BB0\u5F55</div>';
          } else if (sub.status === 'rejected') {
            h += '<div class="status-note rejected" style="display:flex;align-items:center;gap:6px">' + icons.rejected + '\u62D2\u7EDD\u539F\u56E0: ' + escapeHtml(sub.reject_reason || '\u672A\u63D0\u4F9B') + '</div>';
          }

          h += '</div><div class="subdomain-actions">';

          if (sub.status === 'approved') {
            h += '<button class="btn btn-primary btn-sm btn-jelly" onclick="openDnsManager(' + sub.id + ')">\u7BA1\u7406 DNS</button>';
          }

          h += '<button class="btn btn-danger btn-sm" onclick="deleteSubdomainConfirm(' + sub.id + ',\\\\'' + escapeHtml(fqdn) + '\\\\')">\u5220\u9664</button>' +
            '</div></div>';
        });
      }

      h += '</div></div>';
      return h;
    }

    async function registerSubdomain() {
      const subdomain = document.getElementById('new-subdomain').value.trim().toLowerCase();
      const domain = document.getElementById('new-domain').value;
      if (!subdomain) { toast('\u8BF7\u8F93\u5165\u5B50\u57DF\u540D', 'error'); return; }
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) { toast('\u5B50\u57DF\u540D\u683C\u5F0F\u65E0\u6548', 'error'); return; }
      if (subdomain.length < 2) { toast('\u5B50\u57DF\u540D\u81F3\u5C11 2 \u4E2A\u5B57\u7B26', 'error'); return; }
      if (state.config.banned_prefixes && state.config.banned_prefixes.includes(subdomain)) { toast('\u8BE5\u5B50\u57DF\u540D\u524D\u7F00\u5DF2\u88AB\u7981\u6B62', 'error'); return; }

      try {
        const res = await api('/subdomains', { method: 'POST', body: JSON.stringify({ subdomain, domain }) });
        toast(res.message || '\u7533\u8BF7\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u5BA1\u6838', 'success');
        await loadDashboardData();
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function deleteSubdomainConfirm(id, fqdn) {
      showModal('\u5220\u9664\u5B50\u57DF\u540D', '\u786E\u5B9A\u8981\u5220\u9664 ' + fqdn + ' \u5417\uFF1F\u6240\u6709\u5173\u8054\u7684 DNS \u8BB0\u5F55\u4E5F\u5C06\u88AB\u5220\u9664\u3002', async () => {
        try {
          await api('/subdomains/' + id, { method: 'DELETE' });
          toast('\u5B50\u57DF\u540D\u5DF2\u5220\u9664', 'success');
          await loadDashboardData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== DNS Manager ====================
    async function openDnsManager(subId) {
      state.currentSubdomain = subId;
      state.currentView = 'dns';
      state.editingRecord = null;
      await loadRecords(subId);
      render();
    }

    async function loadRecords(subId) {
      try {
        const data = await api('/subdomains/' + subId + '/records');
        state.records = data.records;
        state.currentSubdomainFqdn = data.subdomain;
        state.currentRecordCount = data.current_count;
        state.maxRecords = data.max_records;
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderDnsManager() {
      const fqdn = state.currentSubdomainFqdn || '';
      const records = state.records || [];
      const types = state.config.allowed_record_types || ['A','AAAA','CNAME','MX','TXT','SRV','CAA'];
      const editing = state.editingRecord;

      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\\\'dashboard\\\\'); return false;">\u2190 \u8FD4\u56DE\u5B50\u57DF\u540D\u5217\u8868</a>' +
        '<div class="dns-header"><h2>' + escapeHtml(fqdn) + ' - DNS \u7BA1\u7406</h2></div>' +
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;">\u8BB0\u5F55: ' + (state.currentRecordCount||0) + ' / ' + (state.maxRecords||20) +
        ' \xB7 \u540D\u79F0 @ \u6216\u7559\u7A7A = ' + escapeHtml(fqdn) + '\uFF0C\u586B "www" = www.' + escapeHtml(fqdn) + '</p>';

      // Add/edit form
      h += '<div class="record-form">' +
        '<div class="record-form-title" style="display:flex;align-items:center;gap:6px">' + (editing ? icons.edit + '\u7F16\u8F91\u8BB0\u5F55' : icons.plus + '\u6DFB\u52A0\u8BB0\u5F55') + '</div>' +
        '<div class="form-row-3">' +
        '<div class="form-group"><label class="form-label">\u7C7B\u578B</label>' +
        '<select class="form-select" id="rec-type" onchange="onTypeChange()">' +
        types.map(t => '<option value="'+t+'"'+(editing&&editing.record_type===t?' selected':'')+'>'+t+'</option>').join('') +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">\u540D\u79F0</label>' +
        '<input class="form-input" id="rec-name" placeholder="@ \u6216\u5B50\u540D\u79F0" value="'+(editing?escapeHtml(editing.name):'')+'" /></div>' +
        '<div class="form-group"><label class="form-label">\u5185\u5BB9</label>' +
        '<input class="form-input" id="rec-content" placeholder="\u8BB0\u5F55\u503C" value="'+(editing?escapeHtml(editing.content):'')+'" /></div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">TTL</label>' +
        '<select class="form-select" id="rec-ttl">' +
        '<option value="1"'+(editing&&editing.ttl===1?' selected':'')+'>\u81EA\u52A8</option>' +
        '<option value="60"'+(editing&&editing.ttl===60?' selected':'')+'>1 \u5206\u949F</option>' +
        '<option value="300"'+(editing&&editing.ttl===300?' selected':'')+'>5 \u5206\u949F</option>' +
        '<option value="3600"'+(editing&&editing.ttl===3600?' selected':'')+'>1 \u5C0F\u65F6</option>' +
        '<option value="86400"'+(editing&&editing.ttl===86400?' selected':'')+'>1 \u5929</option>' +
        '</select></div>' +
        '<div class="form-group" id="priority-group" style="display:none"><label class="form-label">\u4F18\u5148\u7EA7</label>' +
        '<input class="form-input" type="number" id="rec-priority" placeholder="10" value="'+(editing&&editing.priority!==null?editing.priority:'10')+'" /></div></div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">' +
        '<label class="checkbox-label"><input type="checkbox" id="rec-proxied"'+(editing&&editing.proxied?' checked':'')+'> Cloudflare \u4EE3\u7406 (A/AAAA/CNAME)</label>' +
        '<div style="display:flex;gap:8px">' +
        (editing?'<button class="btn btn-secondary btn-sm" onclick="cancelEdit()">\u53D6\u6D88</button>':'') +
        '<button class="btn btn-primary btn-sm btn-jelly" onclick="'+(editing?'updateRecord()':'addRecord()')+'">'+(editing?'\u66F4\u65B0':'\u6DFB\u52A0')+'</button>' +
        '</div></div></div>';

      if (records.length > 0) {
        h += '<div class="card"><div class="table-wrap"><table>' +
          '<thead><tr><th>\u7C7B\u578B</th><th>\u540D\u79F0</th><th>\u5185\u5BB9</th><th>TTL</th><th>\u4EE3\u7406</th><th>\u5F00\u5173</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
        records.forEach(r => {
          const ttl = r.ttl===1?'\u81EA\u52A8':(r.ttl>=3600?(r.ttl/3600)+'h':(r.ttl>=60?(r.ttl/60)+'m':r.ttl+'s'));
          h += '<tr><td><span class="badge badge-type">'+escapeHtml(r.record_type)+'</span></td>' +
            '<td class="mono">'+escapeHtml(r.name)+'</td>' +
            '<td class="mono" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escapeHtml(r.content)+'">'+escapeHtml(r.content)+'</td>' +
            '<td>'+ttl+'</td>' +
            '<td>'+(r.proxied
              ?'<span class="proxy-indicator proxied">' + icons.cloud + ' \u5DF2\u4EE3\u7406</span>'
              :'<span class="proxy-indicator direct">\u76F4\u63A5</span>')+'</td>' +
            '<td><div class="proxied-toggle ' + (r.proxied ? 'active' : '') + '" onclick="toggleProxied(' + r.id + ', ' + r.proxied + ')" title="\u5207\u6362\u4EE3\u7406\u72B6\u6001"></div></td>' +
            '<td><div style="display:flex;gap:4px">' +
            '<button class="btn btn-ghost btn-sm" onclick="editRecord('+r.id+')" title="\u7F16\u8F91" style="display:flex">' + icons.edit + '</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="deleteRecordConfirm('+r.id+',\\\\''+escapeHtml(r.name)+'\\\\',\\\\''+escapeHtml(r.record_type)+'\\\\')" title="\u5220\u9664" style="display:flex">' + icons.trash + '</button>' +
            '</div></td></tr>';
        });
        h += '</tbody></table></div></div>';
      } else {
        h += '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>\u8FD8\u6CA1\u6709 DNS \u8BB0\u5F55</p></div>';
      }
      h += '</div>';
      return h;
    }

    function onTypeChange() {
      const t = document.getElementById('rec-type').value;
      document.getElementById('priority-group').style.display = (t==='MX'||t==='SRV')?'block':'none';
    }

    async function addRecord() {
      const type = document.getElementById('rec-type').value;
      const name = document.getElementById('rec-name').value.trim() || '@';
      const content = document.getElementById('rec-content').value.trim();
      const ttl = parseInt(document.getElementById('rec-ttl').value);
      const priority = parseInt(document.getElementById('rec-priority')?.value) || 10;
      const proxied = document.getElementById('rec-proxied').checked;
      if (!content) { toast('\u8BF7\u586B\u5199\u8BB0\u5F55\u5185\u5BB9', 'error'); return; }
      const body = { type, name, content, ttl, proxied };
      if (type==='MX'||type==='SRV') body.priority = priority;
      try {
        await api('/subdomains/'+state.currentSubdomain+'/records', { method:'POST', body:JSON.stringify(body) });
        toast('DNS \u8BB0\u5F55\u5DF2\u6DFB\u52A0', 'success');
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function editRecord(id) {
      const r = state.records.find(r => r.id===id);
      if (!r) return;
      state.editingRecord = r;
      render();
      setTimeout(() => onTypeChange(), 0);
    }

    function cancelEdit() { state.editingRecord = null; render(); }

    async function updateRecord() {
      const editing = state.editingRecord; if (!editing) return;
      const type = document.getElementById('rec-type').value;
      const name = document.getElementById('rec-name').value.trim() || '@';
      const content = document.getElementById('rec-content').value.trim();
      const ttl = parseInt(document.getElementById('rec-ttl').value);
      const priority = parseInt(document.getElementById('rec-priority')?.value) || 10;
      const proxied = document.getElementById('rec-proxied').checked;
      if (!content) { toast('\u8BF7\u586B\u5199\u8BB0\u5F55\u5185\u5BB9', 'error'); return; }
      const body = { type, name, content, ttl, proxied };
      if (type==='MX'||type==='SRV') body.priority = priority;
      try {
        await api('/subdomains/'+state.currentSubdomain+'/records/'+editing.id, { method:'PUT', body:JSON.stringify(body) });
        toast('\u5DF2\u66F4\u65B0', 'success');
        state.editingRecord = null;
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    function deleteRecordConfirm(id, name, type) {
      showModal('\u5220\u9664 DNS \u8BB0\u5F55', '\u786E\u5B9A\u5220\u9664 '+type+' \u8BB0\u5F55 "'+name+'" \u5417\uFF1F', async () => {
        try {
          await api('/subdomains/'+state.currentSubdomain+'/records/'+id, { method:'DELETE' });
          toast('\u5DF2\u5220\u9664', 'success');
          await loadRecords(state.currentSubdomain);
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Proxied Toggle ====================
    async function toggleProxied(recordId, currentProxied) {
      try {
        const res = await api('/proxied/records/' + recordId + '/proxied', {
          method: 'PUT',
          body: JSON.stringify({ proxied: !currentProxied }),
        });
        toast(res.message || '\u4EE3\u7406\u72B6\u6001\u5DF2\u5207\u6362', 'success');
        await loadRecords(state.currentSubdomain);
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    // ==================== Admin Panel ====================
    async function loadAdminData() {
      try {
        const [pendingData, allData, userData, annData] = await Promise.all([
          api('/admin/pending'),
          api('/admin/subdomains'),
          api('/admin/users'),
          annApi('/admin'),
        ]);
        state.adminPending = pendingData.subdomains;
        state.adminAll = allData.subdomains;
        state.adminUsers = userData.users;
        state.adminAnnouncements = annData.announcements || [];
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderAdminPanel() {
      const pendingCount = state.adminPending.length;

      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\\\'dashboard\\\\'); return false;">\u2190 \u8FD4\u56DE\u9762\u677F</a>' +
        '<div class="section-header" style="margin-top:16px"><h2 class="section-title" style="display:flex;align-items:center;gap:8px">' + icons.admin + ' \u7BA1\u7406\u5458\u9762\u677F</h2></div>';

      // Tabs
      h += '<div class="tabs">' +
        '<button class="tab'+(state.adminTab==='pending'?' active':'')+'" onclick="switchAdminTab(\\\\'pending\\\\')">\u5F85\u5BA1\u6838' +
        (pendingCount > 0 ? '<span class="tab-count">'+pendingCount+'</span>' : '') + '</button>' +
        '<button class="tab'+(state.adminTab==='all'?' active':'')+'" onclick="switchAdminTab(\\\\'all\\\\')">\u6240\u6709\u5B50\u57DF\u540D</button>' +
        '<button class="tab'+(state.adminTab==='users'?' active':'')+'" onclick="switchAdminTab(\\\\'users\\\\')">\u7528\u6237\u7BA1\u7406</button>' +
        '<button class="tab'+(state.adminTab==='announcements'?' active':'')+'" onclick="switchAdminTab(\\\\'announcements\\\\')">\u516C\u544A\u7BA1\u7406</button>' +
        '<button class="tab'+(state.adminTab==='accounts'?' active':'')+'" onclick="switchAdminTab(\\\\'accounts\\\\')">' + icons.key + ' Cloudflare \u8D26\u6237</button>' +
        '</div>';

      if (state.adminTab === 'pending') {
        h += renderAdminPending();
      } else if (state.adminTab === 'all') {
        h += renderAdminAll();
      } else if (state.adminTab === 'announcements') {
        h += renderAdminAnnouncements();
      } else if (state.adminTab === 'accounts') {
        h += renderAccountsContent();
      } else {
        h += renderAdminUsers();
      }

      h += '</div>';
      return h;
    }

    function renderAdminPending() {
      const items = state.adminPending;
      if (items.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>\u6682\u65E0\u5F85\u5BA1\u6838\u7684\u7533\u8BF7</p></div>';
      }

      let h = '';
      items.forEach(sub => {
        const fqdn = sub.subdomain + '.' + sub.domain;
        h += '<div class="card card-hover review-card" style="margin-bottom:10px;padding:20px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
          '<div>' +
          '<h4 style="font-family:var(--font-mono);font-size:16px;font-weight:600">' + escapeHtml(fqdn) + '</h4>' +
          '<div class="review-meta">' +
          '<span style="display:flex;align-items:center">' + icons.user + ' ' + escapeHtml(sub.github_username) + '</span>' +
          '<span style="display:flex;align-items:center">' + icons.calendar + ' ' + new Date(sub.created_at).toLocaleString('zh-CN') + '</span>' +
          (sub.email ? '<span style="display:flex;align-items:center">' + icons.email + ' ' + escapeHtml(sub.email) + '</span>' : '') +
          '</div></div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success btn-sm btn-jelly" onclick="approveSubdomain('+sub.id+',\\\\''+escapeHtml(fqdn)+'\\\\')">' + icons.approved + ' \u901A\u8FC7</button>' +
          '<button class="btn btn-danger btn-sm" onclick="rejectSubdomainModal('+sub.id+',\\\\''+escapeHtml(fqdn)+'\\\\')">' + icons.rejected + ' \u62D2\u7EDD</button>' +
          '</div></div></div>';
      });
      return h;
    }

    function renderAdminAll() {
      const items = state.adminAll;
      if (items.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>\u6682\u65E0\u5B50\u57DF\u540D\u8BB0\u5F55</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>\u5B50\u57DF\u540D</th><th>\u7528\u6237</th><th>\u72B6\u6001</th><th>\u521B\u5EFA\u65F6\u95F4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      items.forEach(sub => {
        const fqdn = sub.subdomain + '.' + sub.domain;
        h += '<tr><td class="mono">' + escapeHtml(fqdn) + '</td>' +
          '<td>' + escapeHtml(sub.github_username) + '</td>' +
          '<td>' + statusBadge(sub.status) + '</td>' +
          '<td>' + new Date(sub.created_at).toLocaleDateString('zh-CN') + '</td>' +
          '<td><button class="btn btn-danger btn-sm" onclick="adminDeleteSubdomain('+sub.id+',\\\\''+escapeHtml(fqdn)+'\\\\')">\u5220\u9664</button></td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    function renderAdminUsers() {
      const users = state.adminUsers;
      if (users.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.users + '</div><p>\u6682\u65E0\u7528\u6237</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>\u5934\u50CF</th><th>\u7528\u6237\u540D</th><th>\u90AE\u7BB1</th><th>\u8EAB\u4EFD</th><th>\u6CE8\u518C\u65F6\u95F4</th></tr></thead><tbody>';
      users.forEach(u => {
        h += '<tr><td><img src="'+(u.avatar_url||'')+'" style="width:28px;height:28px;border-radius:50%"></td>' +
          '<td>'+escapeHtml(u.github_username)+'</td>' +
          '<td class="mono">'+(u.email? escapeHtml(u.email):'\u2014')+'</td>' +
          '<td>'+(u.is_admin?'<span class="badge badge-approved">\u7BA1\u7406\u5458</span>':'\u7528\u6237')+'</td>' +
          '<td>'+new Date(u.created_at).toLocaleDateString('zh-CN')+'</td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    // ==================== \u516C\u544A\u7BA1\u7406 ====================
    function renderAdminAnnouncements() {
      const items = state.adminAnnouncements;

      // \u65B0\u589E/\u7F16\u8F91\u8868\u5355\uFF08\u4E34\u65F6\u7528 DOM \u8F93\u5165\uFF0C\u7F16\u8F91\u65F6\u590D\u7528\uFF09
      let h = '<div class="section" style="margin-bottom:16px">' +
        '<div class="card">' +
        '<div class="card-title">\u{1F4E2} \u53D1\u5E03 / \u7F16\u8F91\u516C\u544A</div>' +
        '<div class="form-group"><label class="form-label">\u516C\u544A\u6807\u9898</label>' +
        '<input type="text" class="form-input" id="ann-title" placeholder="\u8F93\u5165\u6807\u9898\u2026" value="' + (escapeHtml(state.editingAnnouncement?.title || '')) + '" /></div>' +
        '<div class="form-group"><label class="form-label">\u516C\u544A\u5185\u5BB9</label>' +
        '<textarea class="form-input" id="ann-content" rows="4" placeholder="\u8F93\u5165\u516C\u544A\u5185\u5BB9\u2026" style="min-height:100px">' + (escapeHtml(state.editingAnnouncement?.content || '')) + '</textarea></div>' +
        '<div class="form-group" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
        '<label class="form-label" style="margin:0">\u6392\u5E8F\u53F7</label>' +
        '<input type="number" min="0" class="form-input" id="ann-sort" value="' + (state.editingAnnouncement?.sort_order ?? '') + '" placeholder="0" style="width:100px" />' +
        '<label class="form-label" style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="ann-pinned" ' + (state.editingAnnouncement?.is_pinned ? 'checked' : '') + ' /> \u7F6E\u9876\uFF08\u8F6E\u64AD\u663E\u793A\u5168\u6587\uFF09</label>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:4px">' +
        '<button class="btn btn-primary btn-jelly" onclick="saveAnnouncement()">' + (state.editingAnnouncement ? '\u4FDD\u5B58\u4FEE\u6539' : '\u53D1\u5E03\u516C\u544A') + '</button>' +
        (state.editingAnnouncement ? '<button class="btn btn-ghost" onclick="cancelEditAnnouncement()">\u53D6\u6D88\u7F16\u8F91</button>' : '') +
        '</div>' +
        '</div></div>';

      if (items.length === 0) {
        h += '<div class="card empty"><div class="empty-icon">' + icons.clipboard + '</div><p>\u6682\u65E0\u516C\u544A</p></div>';
        return h;
      }

      h += '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>\u6807\u9898</th><th>\u6392\u5E8F</th><th>\u72B6\u6001</th><th>\u521B\u5EFA\u65F6\u95F4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      items.forEach(a => {
        h += '<tr><td><strong>' + escapeHtml(a.title) + (a.is_pinned ? '<span class="pin-badge">\u7F6E\u9876</span>' : '') + '</strong><div style="font-size:12px;color:var(--text-muted)">' + escapeHtml(a.content) + '</div></td>' +
          '<td>' + (a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 0) + '</td>' +
          '<td>' + (a.is_active ? '<span class="badge badge-approved">\u663E\u793A\u4E2D</span>' : '<span class="badge">\u5DF2\u9690\u85CF</span>') + '</td>' +
          '<td>' + new Date(a.created_at).toLocaleDateString('zh-CN') + '</td>' +
          '<td style="display:flex;gap:6px">' +
          '<button class="btn btn-sm ' + (a.is_pinned ? 'btn-ghost' : 'btn-primary') + '" onclick="toggleAnnouncementPin(' + a.id + ')">' + (a.is_pinned ? '\u53D6\u6D88\u7F6E\u9876' : '\u7F6E\u9876') + '</button>' +
          '<button class="btn btn-sm btn-primary btn-jelly" onclick="startEditAnnouncement(' + a.id + ')">\u7F16\u8F91</button>' +
          '<button class="btn btn-sm ' + (a.is_active ? 'btn-ghost' : 'btn-primary') + '" onclick="toggleAnnouncement(' + a.id + ')">' + (a.is_active ? '\u9690\u85CF' : '\u663E\u793A') + '</button>' +
          '<button class="btn btn-sm btn-danger" onclick="deleteAnnouncement(' + a.id + ',\\\\'' + escapeHtml(a.title) + '\\\\')">\u5220\u9664</button>' +
          '</td></tr>';
      });
      h += '</tbody></table></div></div>';
      return h;
    }

    function startEditAnnouncement(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (a) { state.editingAnnouncement = a; }
      render();
    }

    function cancelEditAnnouncement() {
      state.editingAnnouncement = null;
      render();
    }

    async function saveAnnouncement() {
      const title = document.getElementById('ann-title')?.value?.trim();
      const content = document.getElementById('ann-content')?.value?.trim();
      if (!title) { toast('\u8BF7\u8F93\u5165\u516C\u544A\u6807\u9898', 'error'); return; }
      if (!content) { toast('\u8BF7\u8F93\u5165\u516C\u544A\u5185\u5BB9', 'error'); return; }

      // \u6392\u5E8F\u53F7\u4E0E\u7F6E\u9876
      const sortRaw = document.getElementById('ann-sort')?.value;
      const sortOrder = sortRaw !== undefined && sortRaw !== '' ? parseInt(sortRaw, 10) : NaN;
      const pinned = !!document.getElementById('ann-pinned')?.checked;
      const payload = {
        title, content,
        is_pinned: pinned,
        sort_order: Number.isNaN(sortOrder) ? undefined : sortOrder
      };

      try {
        const editing = state.editingAnnouncement;
        if (editing) {
          const r = await annApi('/admin/' + editing.id, { method: 'PUT', body: JSON.stringify(payload) });
          toast('\u516C\u544A\u5DF2\u66F4\u65B0', 'success');
          if (r && r.announcement) {
            for (let i = 0; i < state.adminAnnouncements.length; i++) {
              if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
            }
          }
        } else {
          const r = await annApi('/admin', { method: 'POST', body: JSON.stringify(payload) });
          toast('\u516C\u544A\u5DF2\u53D1\u5E03', 'success');
          if (r && r.announcement) { state.adminAnnouncements.push(r.announcement); }
        }
        state.editingAnnouncement = null;
        sortAnnouncements();
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAnnouncementPin(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (!a) return;
      try {
        const r = await annApi('/admin/' + id, { method: 'PUT', body: JSON.stringify({ is_pinned: !a.is_pinned }) });
        toast(a.is_pinned ? '\u5DF2\u53D6\u6D88\u7F6E\u9876' : '\u5DF2\u7F6E\u9876\uFF08\u8F6E\u64AD\u663E\u793A\u5168\u6587\uFF09', 'success');
        if (r && r.announcement) {
          for (let i = 0; i < state.adminAnnouncements.length; i++) {
            if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
          }
          sortAnnouncements();
        }
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAnnouncement(id) {
      const a = state.adminAnnouncements.find(x => x.id === id);
      if (!a) return;
      try {
        const r = await annApi('/admin/' + id, { method: 'PUT', body: JSON.stringify({ is_active: !a.is_active }) });
        toast(a.is_active ? '\u516C\u544A\u5DF2\u9690\u85CF' : '\u516C\u544A\u5DF2\u663E\u793A', 'success');
        if (r && r.announcement) {
          for (let i = 0; i < state.adminAnnouncements.length; i++) {
            if (state.adminAnnouncements[i].id === r.announcement.id) { state.adminAnnouncements[i] = r.announcement; break; }
          }
          sortAnnouncements();
        }
        rerender();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deleteAnnouncement(id, title) {
      showModal('\u5220\u9664\u516C\u544A', '\u786E\u5B9A\u5220\u9664\u516C\u544A\u300C' + title + '\u300D\u5417\uFF1F', async () => {
        try {
          await annApi('/admin/' + id, { method: 'DELETE' });
          toast('\u516C\u544A\u5DF2\u5220\u9664', 'success');
          state.adminAnnouncements = state.adminAnnouncements.filter(function (x) { return x.id !== id; });
          sortAnnouncements();
          rerender();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    async function switchAdminTab(tab) {
      state.adminTab = tab;
      if (tab === 'accounts') {
        try { await loadAccounts(); } catch (e) { console.error('Failed to load accounts:', e); }
      }
      render();
    }

    async function approveSubdomain(id, fqdn) {
      showModal('\u5BA1\u6838\u901A\u8FC7', '\u786E\u5B9A\u901A\u8FC7 ' + fqdn + ' \u7684\u7533\u8BF7\u5417\uFF1F\u901A\u8FC7\u540E\u7528\u6237\u5373\u53EF\u7BA1\u7406 DNS \u8BB0\u5F55\u3002', async () => {
        try {
          await api('/admin/subdomains/'+id+'/approve', { method:'POST', body:'{}' });
          toast('\u5DF2\u901A\u8FC7\u5BA1\u6838', 'success');
          await loadAdminData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      }, { confirmText: '\u901A\u8FC7', confirmClass: 'btn-success btn-jelly' });
    }

    function rejectSubdomainModal(id, fqdn) {
      showModal(
        '\u62D2\u7EDD\u7533\u8BF7',
        '\u8BF7\u586B\u5199\u62D2\u7EDD ' + fqdn + ' \u7684\u539F\u56E0\uFF1A',
        async () => {
          const reason = document.getElementById('reject-reason')?.value?.trim();
          if (!reason) { toast('\u8BF7\u586B\u5199\u62D2\u7EDD\u539F\u56E0', 'error'); return; }
          try {
            await api('/admin/subdomains/'+id+'/reject', {
              method: 'POST',
              body: JSON.stringify({ reason }),
            });
            toast('\u5DF2\u62D2\u7EDD', 'success');
            await loadAdminData();
            render();
          } catch (err) { toast(err.message, 'error'); }
        },
        {
          bodyHtml: '<textarea class="form-input" id="reject-reason" placeholder="\u8BF7\u8F93\u5165\u62D2\u7EDD\u539F\u56E0..." style="resize:vertical;min-height:80px;margin-bottom:12px"></textarea>',
          confirmText: '\u62D2\u7EDD',
          confirmClass: 'btn-danger btn-jelly',
        }
      );
    }

    async function adminDeleteSubdomain(id, fqdn) {
      showModal('\u7BA1\u7406\u5458\u5220\u9664', '\u786E\u5B9A\u5220\u9664 ' + fqdn + ' \u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002', async () => {
        try {
          await api('/admin/subdomains/'+id, { method:'DELETE' });
          toast('\u5DF2\u5220\u9664', 'success');
          await loadAdminData();
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Email Verification ====================
    async function bindEmail() {
      const input = document.getElementById('bind-email');
      const email = input?.value?.trim().toLowerCase();
      if (!email) { toast('\u8BF7\u8F93\u5165\u90AE\u7BB1\u5730\u5740', 'error'); return; }
      if (!/^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]{2,}$/.test(email)) { toast('\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E', 'error'); return; }
      try {
        const res = await api('/verification/bind', { method: 'POST', body: JSON.stringify({ email }) });
        state.user.email = email;
        state.user.email_verified = false;
        state.showVerifyBanner = true;
        toast(res.message || '\u90AE\u7BB1\u5DF2\u7ED1\u5B9A\uFF0C\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001', 'success');
        render();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function sendVerificationEmail() {
      try {
        await api('/verification/send', { method: 'POST' });
        toast('\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001\uFF0C\u8BF7\u67E5\u6536', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }

    // ==================== Cloudflare Accounts ====================
    async function loadAccounts() {
      try {
        const data = await api('/accounts');
        state.accounts = data.accounts || [];
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    }

    async function createAccount() {
      const name = document.getElementById('account-name')?.value?.trim();
      const token = document.getElementById('account-token')?.value?.trim();
      const zoneId = document.getElementById('account-zone')?.value?.trim();

      if (!name || !token) {
        toast('\u8BF7\u586B\u5199\u8D26\u6237\u540D\u79F0\u548C API Token', 'error');
        return;
      }

      try {
        const res = await api('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            account_name: name,
            api_token: token,
            zone_id: zoneId || undefined,
          }),
        });
        toast('\u8D26\u6237\u6DFB\u52A0\u6210\u529F', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    function renderAccounts() {
      if (state.accounts.length === 0) {
        return '<div class="card empty"><div class="empty-icon">' + icons.key + '</div><p>\u8FD8\u6CA1\u6709\u6DFB\u52A0 Cloudflare \u8D26\u6237</p></div>';
      }

      let h = '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>\u8D26\u6237\u540D\u79F0</th><th>\u72B6\u6001</th><th>\u9ED8\u8BA4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';

      state.accounts.forEach(acc => {
        h += '<tr>' +
          '<td><strong>' + escapeHtml(acc.account_name) + '</strong></td>' +
          '<td>' + (acc.is_active ? '<span class="badge badge-approved">\u6D3B\u8DC3</span>' : '<span class="badge badge-rejected">\u505C\u7528</span>') + '</td>' +
          '<td>' + (acc.is_default ? '\u2B50 \u9ED8\u8BA4' : '\u2014') + '</td>' +
          '<td><div style="display:flex;gap:8px">' +
          '<button class="btn btn-ghost btn-sm" onclick="toggleAccountDefault(' + acc.id + ')" title="\u8BBE\u4E3A\u9ED8\u8BA4">\u2B50</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="toggleAccountActive(' + acc.id + ')" title="\u542F\u7528/\u505C\u7528">' + (acc.is_active ? '\u{1F441}' : '\u{1F441}\u200D\u{1F5E8}') + '</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteAccount(' + acc.id + ')" title="\u5220\u9664">' + icons.trash + '</button>' +
          '</div></td></tr>';
      });

      h += '</tbody></table></div></div>';
      return h;
    }

    async function toggleAccountDefault(id) {
      try {
        await api('/accounts/' + id, {
          method: 'PUT',
          body: JSON.stringify({ is_default: true }),
        });
        toast('\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u8D26\u6237', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function toggleAccountActive(id) {
      const account = state.accounts.find(a => a.id === id);
      if (!account) return;

      try {
        await api('/accounts/' + id, {
          method: 'PUT',
          body: JSON.stringify({ is_active: !account.is_active }),
        });
        toast('\u8D26\u6237\u72B6\u6001\u5DF2\u66F4\u65B0', 'success');
        await loadAccounts();
        renderAccounts();
      } catch (err) { toast(err.message, 'error'); }
    }

    async function deleteAccount(id) {
      showModal('\u5220\u9664\u8D26\u6237', '\u786E\u5B9A\u5220\u9664\u6B64 Cloudflare \u8D26\u6237\u5417\uFF1F', async () => {
        try {
          await api('/accounts/' + id, { method: 'DELETE' });
          toast('\u8D26\u6237\u5DF2\u5220\u9664', 'success');
          await loadAccounts();
          renderAccounts();
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // ==================== Main Render ====================
    function render() {
      const app = document.getElementById('app');
      if (!state.user) { app.innerHTML = renderLanding(); return; }

      switch (state.currentView) {
        case 'dns':
          app.innerHTML = renderDnsManager();
          setTimeout(() => onTypeChange(), 0);
          break;
        case 'admin':
          app.innerHTML = renderAdminPanel();
          break;
        case 'accounts':
          app.innerHTML = renderAccountsPage();
          break;
        case 'dashboard':
        default:
          app.innerHTML = renderDashboard();
          break;
      }
    }

    // \u4FDD\u6301\u6EDA\u52A8\u4F4D\u7F6E\u5730\u91CD\u7ED8\u5F53\u524D\u89C6\u56FE\uFF1A\u4FDD\u5B58\u540E\u5237\u65B0\u4E0D\u56DE\u5230\u9876\u90E8\u3001\u4E0D\u91CD\u767B\u4E3B\u9875
    function rerender() {
      const y = window.scrollY || 0;
      render();
      requestAnimationFrame(function () { window.scrollTo(0, y); });
    }

    // \u4E0E\u540E\u7AEF\u4E00\u81F4\uFF1A\u542F\u7528 \u2192 \u7F6E\u9876 \u2192 \u6392\u5E8F\u53F7 \u2192 id \u6392\u5E8F\u516C\u544A\uFF08\u7BA1\u7406\u5217\u8868\u5C55\u793A\u987A\u5E8F\uFF09
    function sortAnnouncements() {
      const arr = state.adminAnnouncements || [];
      arr.sort(function (a, b) {
        const ak = (a.is_active ? 0 : 1), bk = (b.is_active ? 0 : 1);
        if (ak !== bk) return ak - bk;
        const ap = (a.is_pinned ? 0 : 1), bp = (b.is_pinned ? 0 : 1);
        if (ap !== bp) return ap - bp;
        const aso = (a.sort_order || 0), bso = (b.sort_order || 0);
        if (aso !== bso) return aso - bso;
        return a.id - b.id;
      });
    }

    function renderAccountsPage() {
      let h = '<div class="dashboard fade-in">' +
        '<a href="#" class="back-link" onclick="navigate(\\\\'dashboard\\\\'); return false;">\u2190 \u8FD4\u56DE\u9762\u677F</a>' +
        '<div class="section-header" style="margin-top:16px"><h2 class="section-title" style="display:flex;align-items:center;gap:8px">' + icons.key + ' Cloudflare \u8D26\u6237\u7BA1\u7406</h2></div>' +
        renderAccountsContent() + '</div>';
      return h;
    }

    function renderAccountsContent() {
      let h = '<div class="section">' +
        '<div class="card" style="border-left:4px solid var(--accent)">' +
        '<div class="card-title">\u591A\u8D26\u6237\u914D\u7F6E\u8BF4\u660E</div>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px">\u672C\u7CFB\u7EDF\u652F\u6301<strong>\u591A Cloudflare \u8D26\u6237</strong>\uFF1A\u4E0D\u540C\u57DF\u540D\u53EF\u7ED1\u5B9A\u4E0D\u540C\u8D26\u6237\u7684 Zone\u3002\u8BF7\u4E3A\u6BCF\u4E2A\u8D26\u6237\u5355\u72EC\u521B\u5EFA API Token\uFF0C\u5E76\u586B\u5199\u5230\u4E0B\u65B9\u8868\u5355\u3002Token \u4EC5\u7528\u4E8E DNS \u64CD\u4F5C\uFF0C\u9700\u8981 <strong>Zone - Edit</strong> \u6743\u9650\uFF1B\u8BF7\u52FF\u4F7F\u7528 Global \u6743\u9650\u8FC7\u5927\u7684 Token\u3002</p>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px"><strong>\u65E0\u9700\u914D\u7F6E\u73AF\u5883\u53D8\u91CF</strong>\uFF1A\u8D26\u6237\u6570\u636E\u4E0E\u52A0\u5BC6 Token \u5747\u5B58\u50A8\u5728 D1 \u7684 <code>cloudflare_accounts</code> \u8868\u3002\u73AF\u5883\u53D8\u91CF\u4E2D\u7684 <code>CF_API_TOKEN</code> \u4EC5\u4F5C\u4E3A\u65E0\u5339\u914D\u8D26\u6237\u65F6\u7684\u540E\u5907\uFF1B\u4F18\u5148\u4F7F\u7528\u8D26\u6237\u5217\u8868\u4E2D\u7684 Token\u3002</p>' +
        '<p style="color:var(--text-secondary);line-height:1.7;margin-top:8px"><strong>\u5B50\u57DF\u540D\u4EE3\u7406\u5F00\u5173</strong>\uFF1A\u7ED1\u5B9A\u8D26\u6237\u540E\uFF0C\u5BA1\u6838\u901A\u8FC7\u7684\u5B50\u57DF\u540D\u53EF\u5728 DNS \u7BA1\u7406\u9875\u5207\u6362\u9EC4\u8272\u4E91\u6735\uFF08\u4EE3\u7406\uFF09\u3002\u4EC5\u7BA1\u7406\u5458\u5BA1\u6838\u901A\u8FC7\u7684\u5B50\u57DF\u540D\u53EF\u5F00\u901A\u4EE3\u7406\u3002</p>' +
        '</div>' +
        '<div class="card" style="margin-top:16px">' +
        '<div class="card-title">\u6DFB\u52A0\u65B0\u8D26\u6237</div>' +
        '<div class="form-group">' +
        '<label class="form-label">\u8D26\u6237\u540D\u79F0</label>' +
        '<input type="text" class="form-input" id="account-name" placeholder="\u4F8B\u5982: \u4E3B\u8D26\u6237\u3001\u5907\u7528\u8D26\u6237" /></div>' +
        '<div class="form-group">' +
        '<label class="form-label">API Token</label>' +
        '<input type="password" class="form-input" id="account-token" placeholder="\u8F93\u5165 Cloudflare API Token" /></div>' +
        '<div class="form-group">' +
        '<label class="form-label">Zone ID\uFF08\u53EF\u9009\uFF09</label>' +
        '<input type="text" class="form-input" id="account-zone" placeholder="\u7559\u7A7A\u81EA\u52A8\u4ECE\u57DF\u540D\u914D\u7F6E\u83B7\u53D6" /></div>' +
        '<button class="btn btn-primary btn-jelly" onclick="createAccount()">\u6DFB\u52A0\u8D26\u6237</button>' +
        '</div></div>' +
        '<div class="section"><h3 class="section-title" style="font-size:18px;margin-bottom:16px">\u6211\u7684\u8D26\u6237</h3>' +
        renderAccounts() + '</div>';
      return h;
    }

    // ==================== Announcements (\u516C\u544A\uFF1A\u7F6E\u9876\u5168\u6587 + \u8F6E\u64AD\u7F29\u7565\u53EF\u5C55\u5F00) ====================
    // \u5C55\u793A\u89C4\u5219\uFF1Ais_pinned=1 \u7684\u516C\u544A\u76F4\u51FA\u5B8C\u6574\u5185\u5BB9\uFF08\u5E26\u300C\u7F6E\u9876\u300D\u5FBD\u6807\uFF09\uFF1B
    // \u5176\u4F59\u516C\u544A\u8FDB\u5165\u8F6E\u64AD\u533A\uFF0C\u9ED8\u8BA4\u6309\u5B57\u6570\u7F29\u7565\uFF083 \u884C\u622A\u65AD\uFF09\uFF0C\u53EF\u70B9\u51FB\u300C\u5C55\u5F00\u5168\u6587/\u6536\u8D77\u300D\u9605\u8BFB\u5B8C\u6574\u5185\u5BB9\u3002
    async function loadAnnouncements() {
      const container = document.getElementById('announcements');
      if (!container) return;
      try {
        const data = await annApi('');
        const list = data.announcements || [];
        if (!list.length) { container.innerHTML = ''; return; }
        const pinned = list.filter(a => a.is_pinned);
        const normal = list.filter(a => !a.is_pinned);
        let h = '';
        // \u7F6E\u9876\uFF1A\u5B8C\u6574\u5185\u5BB9\u76F4\u51FA
        pinned.forEach(function (a) {
          const date = (a.created_at || '').slice(0, 10);
          h += '<div class="announcement-card pinned fade-in">' +
            '<div class="announcement-title">\u{1F4E2} ' + escapeHtml(a.title) +
            '<span class="pin-badge">\u7F6E\u9876</span><span class="announcement-date">' + date + '</span></div>' +
            '<div class="announcement-content">' + escapeHtml(a.content) + '</div></div>';
        });
        // \u666E\u901A\uFF1A\u8FDB\u8F6E\u64AD\uFF0C\u6BCF\u5F20\u7F29\u7565\u53EF\u5C55\u5F00
        if (normal.length) {
          h += '<div class="announcement-carousel">';
          normal.forEach(function (a, i) {
            const date = (a.created_at || '').slice(0, 10);
            h += '<div class="carousel-slide' + (i === 0 ? ' active' : '') + '" id="ann-slide-' + i + '">' +
              '<div class="announcement-card fade-in">' +
              '<div class="announcement-title">\u{1F4E2} ' + escapeHtml(a.title) + '<span class="announcement-date">' + date + '</span></div>' +
              '<div class="announcement-content collapsed" id="ann-body-' + i + '">' + escapeHtml(a.content) + '</div>' +
              '<button type="button" class="announcement-toggle-btn" onclick="toggleAnnouncementBody(' + i + ', this)">\u5C55\u5F00\u5168\u6587</button>' +
              '</div></div>';
          });
          h += '<div class="carousel-dots">';
          normal.forEach(function (_, i) {
            h += '<span class="carousel-dot' + (i === 0 ? ' active' : '') + '" onclick="goAnnouncementSlide(' + i + ')"></span>';
          });
          h += '</div></div>';
        }
        container.innerHTML = h;
        // \u542F\u52A8\u8F6E\u64AD\u5B9A\u65F6\u5207\u6362
        if (normal.length > 1) {
          window.clearInterval(window.__annTimer);
          let idx = 0;
          window.__annTimer = window.setInterval(function () {
            idx = (idx + 1) % normal.length;
            goAnnouncementSlide(idx);
          }, 5000);
        }
      } catch (err) {
        console.error('Failed to load announcements:', err);
      }
    }

    // \u5C55\u5F00/\u6536\u8D77\u67D0\u6761\u8F6E\u64AD\u516C\u544A\u7684\u5168\u6587
    function toggleAnnouncementBody(i, btn) {
      const el = document.getElementById('ann-body-' + i);
      if (!el) return;
      el.classList.toggle('collapsed');
      btn.textContent = el.classList.contains('collapsed') ? '\u5C55\u5F00\u5168\u6587' : '\u6536\u8D77';
    }

    // \u8F6E\u64AD\u5207\u5230\u7B2C i \u5F20
    function goAnnouncementSlide(i) {
      const slides = document.querySelectorAll('#announcements .carousel-slide');
      const dots = document.querySelectorAll('#announcements .carousel-dot');
      slides.forEach(function (s, k) { s.classList.toggle('active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('active', k === i); });
    }

    // ==================== Init ====================
    async function init() {
      // \u6240\u6709\u6570\u636E\u52A0\u8F7D\u5747\u5355\u72EC\u515C\u5E95\uFF0C\u4E00\u65E6\u67D0\u63A5\u53E3\u5931\u8D25\u4E0D\u80FD\u8BA9\u6574\u6BB5 init \u4E2D\u65AD\uFF0C
      // \u5426\u5219 render() \u4E0D\u6267\u884C\uFF0C\u9875\u9762\u4F1A\u4E00\u76F4\u505C\u5728\u52A0\u8F7D\u8F6C\u5708\uFF08\u9876/\u5E95\u7531\u670D\u52A1\u7AEF\u6E32\u67D3\u3001\u4E0D\u53D7\u5F71\u54CD\uFF0C\u6B63\u662F \u201C\u4E2D\u95F4\u8F6C\u5708\u201D \u7684\u73B0\u8C61\uFF09\u3002
      try {
        setTheme(getTheme());
        renderHeaderUser();
        try { loadAnnouncements(); }
        catch (err) { console.error('Failed to load announcements:', err); }

        if (state.user) {
          state.currentView = 'dashboard';
          try { await loadDashboardData(); }
          catch (err) { console.error('Failed to load dashboard data:', err); }

          // \u52A0\u8F7D\u90AE\u7BB1\u9A8C\u8BC1\u914D\u7F6E
          try {
            const config = await api('/verification/config');
            state.emailVerificationRequired = config.required;
            state.allowedEmailDomains = config.allowed_domains || [];

            // \u68C0\u67E5\u662F\u5426\u9700\u8981\u663E\u793A\u9A8C\u8BC1\u63D0\u793A
            if (state.emailVerificationRequired && !state.user.email_verified) {
              state.showVerifyBanner = true;
            }
          } catch (err) {
            console.error('Failed to load verification config:', err);
          }

          // \u52A0\u8F7D\u8D26\u6237\u5217\u8868
          try { await loadAccounts(); }
          catch (err) { console.error('Failed to load accounts:', err); }

          if (state.user.is_admin) {
            try { loadAdminData(); }
            catch (err) { console.error('Failed to load admin data:', err); }
          }
        }
      } catch (err) {
        console.error('init error:', err);
      }

      // \u65E0\u8BBA\u4E0A\u9762\u6570\u636E\u662F\u5426\u6210\u529F\u52A0\u8F7D\uFF0C\u90FD\u5FC5\u987B\u6E32\u67D3\uFF0C\u907F\u514D\u505C\u7559\u5728\u52A0\u8F7D\u8F6C\u5708
      render();
    }

    init();
  <\/script>

  <footer class="footer">
    <div class="container">
      `, "\n      <p>Powered by Cloudflare Workers &amp; D1 \xB7 ", '</p>\n      <p style="margin-top:8px;font-size:12px;color:var(--text-muted);">\n        \u611F\u8C22 <a href="https://github.com/Little100/cloudflare_subdomain_provisioning" target="_blank" rel="noopener">Little100/cloudflare_subdomain_provisioning</a> \u5F00\u6E90\u9879\u76EE\n      </p>\n      ', "\n      ", "\n    </div>\n  </footer>\n</body>\n</html>"])), siteName, backgroundOverlay || "var(--overlay-fallback)", raw(backgroundImage ? `<div class="bg-image-wrapper"><img class="bg-image" src="${backgroundImage}" alt="background" /><div class="bg-overlay"></div></div>` : ""), raw(siteLogo ? `<img src="${siteLogo}" alt="logo" class="logo-icon" style="width:36px;height:36px;object-fit:contain;background:none;box-shadow:none;border-radius:12px;" />` : `<div class="logo-icon">${defaultLogoSvg}</div>`), siteName, raw(user ? `JSON.parse('${JSON.stringify({ id: user.id, github_username: user.github_username, avatar_url: user.avatar_url, is_admin: !!user.is_admin, email: user.email, email_verified: user.email_verified })}')` : "null"), raw(friendLinks && friendLinks.length > 0 ? `
      <div class="footer-friendlinks">
        <span class="friend-link-label">\u2728 \u53CB\u60C5\u94FE\u63A5\uFF1A</span>
        ${friendLinks.map((l) => `<a class="friend-link" href="${l.url}" target="_blank" rel="noopener">${l.name}</a>`).join("")}
      </div>` : ""), siteName, raw(adminContactEmail ? `
      <p style="margin-top:12px;">
        <a href="mailto:${adminContactEmail}" class="btn btn-primary btn-sm btn-jelly contact-admin-btn" target="_blank">
          \u2709\uFE0F \u8054\u7CFB\u7BA1\u7406\u5458
        </a>
      </p>` : ""), raw(beian ? `
      <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">\u5907\u6848\u4FE1\u606F\uFF1A${beian}</p>` : ""));
}
__name(renderPage, "renderPage");
var pages_default = pages;

// src/routes/accounts.ts
var accounts = new Hono2();
accounts.use("/*", authMiddleware, emailVerifiedMiddleware);
accounts.get("/", async (c) => {
  const user = c.get("user");
  const accountsList = await getUserAccounts(c.env.DB, c.env, user.id);
  return c.json({ accounts: accountsList });
});
accounts.get("/default", async (c) => {
  const user = c.get("user");
  const defaultAccount = await getDefaultAccount(c.env.DB, c.env, user.id);
  if (!defaultAccount) {
    return c.json({ account: null });
  }
  return c.json({ account: defaultAccount });
});
accounts.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { account_name, api_token } = body;
  if (!account_name || !api_token) {
    return c.json({ error: "\u8BF7\u63D0\u4F9B\u8D26\u6237\u540D\u79F0\u548C API Token" }, 400);
  }
  if (account_name.length < 2 || account_name.length > 50) {
    return c.json({ error: "\u8D26\u6237\u540D\u79F0\u957F\u5EA6\u5E94\u5728 2-50 \u4E2A\u5B57\u7B26\u4E4B\u95F4" }, 400);
  }
  try {
    const account = await createAccount(
      c.env.DB,
      c.env,
      user.id,
      account_name.trim(),
      api_token.trim(),
      body.zone_id
    );
    return c.json({ account }, 201);
  } catch (err) {
    return c.json({ error: err.message || "\u521B\u5EFA\u8D26\u6237\u5931\u8D25" }, 400);
  }
});
accounts.put("/:id", async (c) => {
  const user = c.get("user");
  const accountId = parseInt(c.req.param("id"), 10);
  const body = await c.req.json();
  try {
    const account = await updateAccount(c.env.DB, c.env, user.id, accountId, body);
    return c.json({ account });
  } catch (err) {
    return c.json({ error: err.message || "\u66F4\u65B0\u8D26\u6237\u5931\u8D25" }, 400);
  }
});
accounts.delete("/:id", async (c) => {
  const user = c.get("user");
  const accountId = parseInt(c.req.param("id"), 10);
  try {
    await deleteAccount(c.env.DB, user.id, accountId);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err.message || "\u5220\u9664\u8D26\u6237\u5931\u8D25" }, 400);
  }
});
accounts.post("/verify-token", async (c) => {
  const body = await c.req.json();
  if (!body.api_token) {
    return c.json({ error: "\u8BF7\u63D0\u4F9B API Token" }, 400);
  }
  try {
    const isValid = await verifyToken(body.api_token.trim());
    return c.json({ valid: isValid });
  } catch {
    return c.json({ valid: false });
  }
});
var accounts_default = accounts;

// src/services/email-verification.ts
function isEmailDomainAllowed(env, email) {
  const whitelist = env.ALLOWED_EMAIL_DOMAINS;
  if (!whitelist || whitelist.trim() === "") {
    return true;
  }
  const allowedDomains = whitelist.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (allowedDomains.length === 0) {
    return true;
  }
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return false;
  }
  return allowedDomains.includes(domain);
}
__name(isEmailDomainAllowed, "isEmailDomainAllowed");
function getAllowedEmailDomains2(env) {
  const whitelist = env.ALLOWED_EMAIL_DOMAINS;
  if (!whitelist || whitelist.trim() === "") {
    return [];
  }
  return whitelist.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}
__name(getAllowedEmailDomains2, "getAllowedEmailDomains");
function isEmailVerificationRequired2(env) {
  return env.EMAIL_VERIFICATION_REQUIRED === "true" || env.EMAIL_VERIFICATION_REQUIRED === "1";
}
__name(isEmailVerificationRequired2, "isEmailVerificationRequired");
async function createEmailVerification(db, userId, email) {
  await db.prepare("DELETE FROM user_email_verifications WHERE user_id = ? AND email = ?").bind(userId, email).run();
  const token = generateToken(32);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const result = await db.prepare(
    `INSERT INTO user_email_verifications (user_id, email, verification_token, is_verified, created_at)
       VALUES (?, ?, ?, 0, ?)`
  ).bind(userId, email, token, now).run();
  const id = result.meta.last_row_id;
  return {
    id,
    user_id: userId,
    email,
    verification_token: token,
    is_verified: 0,
    verified_at: null,
    created_at: now
  };
}
__name(createEmailVerification, "createEmailVerification");
async function verifyEmailByToken2(db, token) {
  const verification2 = await db.prepare("SELECT * FROM user_email_verifications WHERE verification_token = ? AND is_verified = 0").bind(token).first();
  if (!verification2) {
    return null;
  }
  const createdAt = new Date(verification2.created_at).getTime();
  const now = Date.now();
  if (now - createdAt > 24 * 60 * 60 * 1e3) {
    return null;
  }
  await db.prepare(
    `UPDATE user_email_verifications
       SET is_verified = 1, verified_at = datetime('now')
       WHERE id = ?`
  ).bind(verification2.id).run();
  await db.prepare(
    `UPDATE users SET email_verified = 1, email = ?, updated_at = datetime('now')
       WHERE id = ?`
  ).bind(verification2.email, verification2.user_id).run();
  return {
    success: true,
    user_id: verification2.user_id,
    email: verification2.email
  };
}
__name(verifyEmailByToken2, "verifyEmailByToken");
async function getEmailVerificationStatus(db, userId) {
  const user = await db.prepare("SELECT email, email_verified FROM users WHERE id = ?").bind(userId).first();
  if (!user) {
    return null;
  }
  return {
    email: user.email,
    is_verified: !!user.email_verified
  };
}
__name(getEmailVerificationStatus, "getEmailVerificationStatus");
async function sendVerificationEmail(env, email, token, siteName, siteUrl) {
  const verificationUrl = `${siteUrl}/verify-email?token=${token}`;
  const emailHtml = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 0;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <h2 style="color:#3b82f6;margin:0 0 16px;">\u{1F4E7} \u9A8C\u8BC1\u60A8\u7684\u90AE\u7BB1</h2>
  <p style="color:#333;font-size:15px;line-height:1.6;">
    \u611F\u8C22\u60A8\u4F7F\u7528 ${siteName}\uFF01\u8BF7\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u9A8C\u8BC1\u60A8\u7684\u90AE\u7BB1\u5730\u5740\uFF1A
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${verificationUrl}" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">
      \u9A8C\u8BC1\u90AE\u7BB1
    </a>
  </div>
  <p style="color:#666;font-size:13px;line-height:1.6;">
    \u5982\u679C\u6309\u94AE\u65E0\u6CD5\u70B9\u51FB\uFF0C\u8BF7\u590D\u5236\u4EE5\u4E0B\u94FE\u63A5\u5230\u6D4F\u89C8\u5668\u6253\u5F00\uFF1A<br>
    <a href="${verificationUrl}" style="color:#3b82f6;word-break:break-all;">${verificationUrl}</a>
  </p>
  <p style="color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px;">
    \u6B64\u94FE\u63A5 24 \u5C0F\u65F6\u5185\u6709\u6548\u3002\u5982\u679C\u8FD9\u4E0D\u662F\u60A8\u7684\u64CD\u4F5C\uFF0C\u8BF7\u5FFD\u7565\u6B64\u90AE\u4EF6\u3002<br>
    ${siteName}
  </p>
</div>
</body></html>`;
  const emailText = `
\u9A8C\u8BC1\u60A8\u7684\u90AE\u7BB1 - ${siteName}

\u611F\u8C22\u60A8\u4F7F\u7528 ${siteName}\uFF01\u8BF7\u8BBF\u95EE\u4EE5\u4E0B\u94FE\u63A5\u9A8C\u8BC1\u60A8\u7684\u90AE\u7BB1\u5730\u5740\uFF1A

${verificationUrl}

\u6B64\u94FE\u63A5 24 \u5C0F\u65F6\u5185\u6709\u6548\u3002\u5982\u679C\u8FD9\u4E0D\u662F\u60A8\u7684\u64CD\u4F5C\uFF0C\u8BF7\u5FFD\u7565\u6B64\u90AE\u4EF6\u3002
`;
  return sendEmail(env, {
    to: email,
    subject: `\u9A8C\u8BC1\u60A8\u7684\u90AE\u7BB1 - ${siteName}`,
    html: emailHtml,
    text: emailText
  });
}
__name(sendVerificationEmail, "sendVerificationEmail");
async function resendVerificationEmail(env, db, userId, email, siteName, siteUrl) {
  const verification2 = await createEmailVerification(db, userId, email);
  return sendVerificationEmail(env, email, verification2.verification_token, siteName, siteUrl);
}
__name(resendVerificationEmail, "resendVerificationEmail");
async function checkEmailSendQuota(env, db, userId) {
  const limit = parseInt(env.EMAIL_DAILY_EMAIL_LIMIT || "5", 10) || 5;
  const date = new Date(Date.now() + 8 * 60 * 60 * 1e3).toISOString().slice(0, 10);
  const row = await db.prepare("SELECT count FROM email_send_log WHERE user_id = ? AND send_date = ?").bind(userId, date).first();
  const cur = row?.count || 0;
  if (cur >= limit) {
    return { ok: false, remaining: 0 };
  }
  await db.prepare(
    `INSERT INTO email_send_log (user_id, send_date, count) VALUES (?, ?, 1)
       ON CONFLICT(user_id, send_date) DO UPDATE SET count = count + 1, updated_at = datetime('now')`
  ).bind(userId, date).run();
  return { ok: true, remaining: limit - cur - 1 };
}
__name(checkEmailSendQuota, "checkEmailSendQuota");

// src/routes/verification.ts
init_queries();
var verification = new Hono2();
verification.get("/config", optionalAuthMiddleware, async (c) => {
  const env = c.env;
  const required = isEmailVerificationRequired2(env);
  const allowedDomains = getAllowedEmailDomains2(env);
  return c.json({
    required,
    allowedDomains
  });
});
verification.get("/status", authMiddleware, async (c) => {
  const user = c.get("user");
  const status = await getEmailVerificationStatus(c.env.DB, user.id);
  if (!status) {
    return c.json({ error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 404);
  }
  return c.json(status);
});
verification.post("/send", authMiddleware, async (c) => {
  const user = c.get("user");
  const env = c.env;
  if (!user.email) {
    return c.json({ error: "\u7528\u6237\u6CA1\u6709\u90AE\u7BB1\u5730\u5740" }, 400);
  }
  const required = isEmailVerificationRequired2(env);
  if (!required) {
    return c.json({ error: "\u90AE\u7BB1\u9A8C\u8BC1\u672A\u542F\u7528" }, 400);
  }
  const allowed = isEmailDomainAllowed(env, user.email);
  if (!allowed) {
    return c.json({ error: "\u8BE5\u90AE\u7BB1\u57DF\u540D\u4E0D\u5728\u5141\u8BB8\u5217\u8868\u4E2D" }, 400);
  }
  try {
    const quota = await checkEmailSendQuota(env, c.env.DB, user.id);
    if (!quota.ok) {
      return c.json({ error: "\u5DF2\u8FBE\u4ECA\u65E5\u90AE\u4EF6\u53D1\u9001\u4E0A\u9650\uFF085 \u5C01\uFF09\uFF0C\u8BF7\u660E\u5929\u518D\u8BD5", code: "EMAIL_QUOTA_EXCEEDED" }, 429);
    }
    const token = crypto.randomUUID().replace(/-/g, "");
    await createEmailVerification(c.env.DB, user.id, user.email);
    const siteName = env.SITE_NAME || "SubDomain Hub";
    const url = new URL(c.req.url);
    const siteUrl = url.origin;
    await resendVerificationEmail(env, c.env.DB, user.id, user.email, siteName, siteUrl);
    return c.json({ message: "\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001\uFF0C\u8BF7\u67E5\u6536", remaining: quota.remaining });
  } catch (err) {
    return c.json({ error: err.message || "\u53D1\u9001\u9A8C\u8BC1\u90AE\u4EF6\u5931\u8D25" }, 500);
  }
});
verification.post("/bind", authMiddleware, async (c) => {
  const user = c.get("user");
  const env = c.env;
  let email = "";
  try {
    email = (await c.req.json()).email?.trim().toLowerCase() || "";
  } catch {
    return c.json({ error: "\u8BF7\u63D0\u4F9B\u90AE\u7BB1\u5730\u5740" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return c.json({ error: "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E" }, 400);
  }
  const allowed = isEmailDomainAllowed(env, email);
  if (!allowed) {
    return c.json({ error: "\u8BE5\u90AE\u7BB1\u57DF\u540D\u4E0D\u5728\u5141\u8BB8\u5217\u8868\u4E2D" }, 400);
  }
  try {
    const quota = await checkEmailSendQuota(env, c.env.DB, user.id);
    if (!quota.ok) {
      return c.json({ error: "\u5DF2\u8FBE\u4ECA\u65E5\u90AE\u4EF6\u53D1\u9001\u4E0A\u9650\uFF085 \u5C01\uFF09\uFF0C\u8BF7\u660E\u5929\u518D\u8BD5", code: "EMAIL_QUOTA_EXCEEDED" }, 429);
    }
    await updateUserEmail(c.env.DB, user.id, email);
    const token = crypto.randomUUID().replace(/-/g, "");
    await createEmailVerification(c.env.DB, user.id, email);
    const siteName = env.SITE_NAME || "SubDomain Hub";
    const url = new URL(c.req.url);
    const siteUrl = url.origin;
    await resendVerificationEmail(env, c.env.DB, user.id, email, siteName, siteUrl);
    return c.json({ message: "\u90AE\u7BB1\u5DF2\u7ED1\u5B9A\uFF0C\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001\uFF0C\u8BF7\u67E5\u6536", email, remaining: quota.remaining });
  } catch (err) {
    return c.json({ error: err.message || "\u7ED1\u5B9A\u90AE\u7BB1\u5931\u8D25" }, 500);
  }
});
verification.get("/confirm", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "\u7F3A\u5C11\u9A8C\u8BC1\u4EE4\u724C" }, 400);
  }
  try {
    const result = await verifyEmailByToken2(c.env.DB, token);
    if (!result) {
      return c.json({ error: "\u9A8C\u8BC1\u94FE\u63A5\u65E0\u6548\u6216\u5DF2\u8FC7\u671F" }, 400);
    }
    return c.json({
      success: true,
      message: "\u90AE\u7BB1\u9A8C\u8BC1\u6210\u529F",
      email: result.email
    });
  } catch (err) {
    return c.json({ error: err.message || "\u9A8C\u8BC1\u5931\u8D25" }, 500);
  }
});
verification.post("/check-domain", async (c) => {
  const body = await c.req.json();
  if (!body.email) {
    return c.json({ error: "\u8BF7\u63D0\u4F9B\u90AE\u7BB1\u5730\u5740" }, 400);
  }
  const allowed = isEmailDomainAllowed(c.env, body.email);
  return c.json({
    allowed,
    domain: body.email.split("@")[1]?.toLowerCase()
  });
});
var verification_default = verification;

// src/routes/proxied.ts
init_queries();
var proxied = new Hono2();
proxied.use("/*", authMiddleware, emailVerifiedMiddleware);
proxied.put("/records/:recordId/proxied", async (c) => {
  const user = c.get("user");
  const recordId = parseInt(c.req.param("recordId"), 10);
  const body = await c.req.json();
  if (typeof body.proxied !== "boolean") {
    return c.json({ error: "\u8BF7\u63D0\u4F9B proxied \u72B6\u6001" }, 400);
  }
  const record = await getDnsRecordById(c.env.DB, recordId);
  if (!record) {
    return c.json({ error: "DNS \u8BB0\u5F55\u4E0D\u5B58\u5728" }, 404);
  }
  const subdomain = await getSubdomainById(c.env.DB, record.subdomain_id);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "\u65E0\u6743\u64CD\u4F5C\u6B64 DNS \u8BB0\u5F55" }, 403);
  }
  if (subdomain.status !== "approved") {
    return c.json({ error: "\u5B50\u57DF\u540D\u5C1A\u672A\u901A\u8FC7\u5BA1\u6838" }, 403);
  }
  if (!["A", "AAAA", "CNAME"].includes(record.record_type)) {
    return c.json({ error: "\u4EC5 A\u3001AAAA\u3001CNAME \u8BB0\u5F55\u652F\u6301\u4EE3\u7406\u5F00\u5173" }, 400);
  }
  try {
    const activeAccounts = await getActiveAccounts(c.env.DB, c.env, user.id);
    if (activeAccounts.length === 0) {
      return c.json({ error: "\u6CA1\u6709\u53EF\u7528\u7684 Cloudflare \u8D26\u6237\uFF0C\u8BF7\u5148\u5728\u8D26\u6237\u7BA1\u7406\u4E2D\u6DFB\u52A0" }, 400);
    }
    const resolved = await resolveZoneIdAndTokenFromAccounts(activeAccounts, subdomain.domain);
    if (!resolved) {
      return c.json({ error: `\u65E0\u6CD5\u89E3\u6790\u57DF\u540D ${subdomain.domain} \u7684 Zone ID\uFF0C\u8BF7\u68C0\u67E5\u8D26\u6237\u6743\u9650` }, 400);
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
        priority: record.priority ?? void 0,
        proxied: body.proxied
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
    return c.json({
      success: true,
      proxied: body.proxied,
      message: body.proxied ? "\u5DF2\u5F00\u542F\u4EE3\u7406\uFF08\u9EC4\u8272\u4E91\u6735\uFF09" : "\u5DF2\u5173\u95ED\u4EE3\u7406\uFF08\u7070\u8272\u4E91\u6735\uFF09"
    });
  } catch (err) {
    return c.json({ error: `\u5207\u6362\u4EE3\u7406\u72B6\u6001\u5931\u8D25: ${err.message}` }, 500);
  }
});
proxied.put("/subdomains/:subdomainId/records/proxied", async (c) => {
  const user = c.get("user");
  const subdomainId = parseInt(c.req.param("subdomainId"), 10);
  const body = await c.req.json();
  if (typeof body.proxied !== "boolean") {
    return c.json({ error: "\u8BF7\u63D0\u4F9B proxied \u72B6\u6001" }, 400);
  }
  const subdomain = await getSubdomainById(c.env.DB, subdomainId);
  if (!subdomain) {
    return c.json({ error: "\u5B50\u57DF\u540D\u4E0D\u5B58\u5728" }, 404);
  }
  if (subdomain.user_id !== user.id && !user.is_admin) {
    return c.json({ error: "\u65E0\u6743\u64CD\u4F5C\u6B64\u5B50\u57DF\u540D" }, 403);
  }
  if (subdomain.status !== "approved") {
    return c.json({ error: "\u5B50\u57DF\u540D\u5C1A\u672A\u901A\u8FC7\u5BA1\u6838" }, 403);
  }
  const { getSubdomainRecords: getSubdomainRecords2, updateDnsRecordEntry: updateDnsRecordEntry2 } = await Promise.resolve().then(() => (init_queries(), queries_exports));
  const records = await getSubdomainRecords2(c.env.DB, subdomainId);
  const supportedRecords = records.filter((r) => ["A", "AAAA", "CNAME"].includes(r.record_type));
  const targetRecords = body.record_ids && body.record_ids.length > 0 ? supportedRecords.filter((r) => body.record_ids.includes(r.id)) : supportedRecords;
  if (targetRecords.length === 0) {
    return c.json({ error: "\u6CA1\u6709\u53EF\u64CD\u4F5C\u7684\u8BB0\u5F55" }, 400);
  }
  try {
    const activeAccounts = await getActiveAccounts(c.env.DB, c.env, user.id);
    if (activeAccounts.length === 0) {
      return c.json({ error: "\u6CA1\u6709\u53EF\u7528\u7684 Cloudflare \u8D26\u6237\uFF0C\u8BF7\u5148\u5728\u8D26\u6237\u7BA1\u7406\u4E2D\u6DFB\u52A0" }, 400);
    }
    const resolved = await resolveZoneIdAndTokenFromAccounts(activeAccounts, subdomain.domain);
    if (!resolved) {
      return c.json({ error: `\u65E0\u6CD5\u89E3\u6790\u57DF\u540D ${subdomain.domain} \u7684 Zone ID\uFF0C\u8BF7\u68C0\u67E5\u8D26\u6237\u6743\u9650` }, 400);
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
            priority: record.priority ?? void 0,
            proxied: body.proxied
          }
        );
        await updateDnsRecordEntry2(
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
      message: `\u6210\u529F\u66F4\u65B0 ${successCount} \u6761\u8BB0\u5F55${failCount > 0 ? `\uFF0C${failCount} \u6761\u5931\u8D25` : ""}`
    });
  } catch (err) {
    return c.json({ error: `\u6279\u91CF\u5207\u6362\u5931\u8D25: ${err.message}` }, 500);
  }
});
var proxied_default = proxied;

// src/routes/announcements.ts
init_queries();
var announcements = new Hono2();
announcements.get("/", async (c) => {
  try {
    const list = await getActiveAnnouncements(c.env.DB);
    return c.json({ announcements: list });
  } catch (err) {
    return c.json({ error: `\u83B7\u53D6\u516C\u544A\u5931\u8D25: ${err.message}` }, 500);
  }
});
var admin = new Hono2();
admin.use("/*", authMiddleware, adminMiddleware);
admin.get("/", async (c) => {
  const list = await getAllAnnouncements(c.env.DB);
  return c.json({ announcements: list });
});
admin.post("/", async (c) => {
  const user = c.get("user");
  const parsed = await c.req.json().catch(() => null);
  const body = { title: "", content: "", is_pinned: void 0, sort_order: void 0, ...parsed ?? {} };
  if (!body.title || !body.title.trim()) {
    return c.json({ error: "\u516C\u544A\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  if (!body.content || !body.content.trim()) {
    return c.json({ error: "\u516C\u544A\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const created = await createAnnouncement(
    c.env.DB,
    body.title.trim(),
    body.content.trim(),
    user.id,
    body.sort_order,
    body.is_pinned
  );
  if (!created) {
    return c.json({ error: "\u521B\u5EFA\u516C\u544A\u5931\u8D25" }, 500);
  }
  return c.json({ success: true, announcement: created });
});
admin.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json().catch(() => ({ title: void 0, content: void 0, is_active: void 0, is_pinned: void 0, sort_order: void 0 }));
  const updated = await updateAnnouncement(c.env.DB, id, {
    title: body.title !== void 0 ? body.title.trim() : void 0,
    content: body.content !== void 0 ? body.content.trim() : void 0,
    is_active: body.is_active,
    is_pinned: body.is_pinned,
    sort_order: body.sort_order
  });
  if (!updated) {
    return c.json({ error: "\u516C\u544A\u4E0D\u5B58\u5728\u6216\u672A\u66F4\u65B0" }, 404);
  }
  return c.json({ success: true, announcement: updated });
});
admin.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await deleteAnnouncement(c.env.DB, id);
  return c.json({ success: true });
});
announcements.route("/admin", admin);
var announcements_default = announcements;

// src/index.ts
function isSameOrigin(c) {
  const self = new URL(c.req.url).origin;
  const origin = c.req.header("origin");
  if (origin) {
    try {
      return new URL(origin).origin === self;
    } catch {
      return false;
    }
  }
  const referer = c.req.header("referer");
  if (referer) {
    try {
      return new URL(referer).origin === self;
    } catch {
      return false;
    }
  }
  return true;
}
__name(isSameOrigin, "isSameOrigin");
var rateBuckets = /* @__PURE__ */ new Map();
function rateLimit(c, windowMs, max, keyBase) {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const key = `${keyBase}:${ip}`;
  const b = rateBuckets.get(key);
  if (!b || now - b.first >= windowMs) {
    if (rateBuckets.size > 1e4) rateBuckets.clear();
    rateBuckets.set(key, { first: now, count: 1 });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}
__name(rateLimit, "rateLimit");
var app = new Hono2();
app.use("*", async (c, next) => {
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  await next();
});
app.use("/api/*", cors({
  origin: /* @__PURE__ */ __name((origin, c) => {
    if (!origin) return "";
    try {
      return new URL(origin).origin === new URL(c.req.url).origin ? origin : "";
    } catch {
      return "";
    }
  }, "origin"),
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"]
}));
var csrfAndAudit = /* @__PURE__ */ __name(async (c, next) => {
  const m = c.req.method;
  if (m === "POST" || m === "PUT" || m === "DELETE" || m === "PATCH") {
    const ip = c.req.header("CF-Connecting-IP") || "-";
    console.log(`[audit] ${(/* @__PURE__ */ new Date()).toISOString()} ${m} ${c.req.path} ip=${ip}`);
    if (!isSameOrigin(c)) {
      return c.json({ error: "CSRF: \u8DE8\u6E90\u8BF7\u6C42\u88AB\u62D2\u7EDD" }, 403);
    }
  }
  await next();
}, "csrfAndAudit");
app.use("/api/*", csrfAndAudit);
app.use("/announcements", csrfAndAudit);
app.use("/api/verification/send", async (c, next) => {
  if (!rateLimit(c, 6e4, 5, "verify-send")) {
    return c.json({ error: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }, 429);
  }
  await next();
});
app.get("/health", (c) => c.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
app.get("/verify-email", async (c) => {
  const token = c.req.query("token");
  const page = /* @__PURE__ */ __name((emoji, title, desc) => c.html(`<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\u90AE\u7BB1\u9A8C\u8BC1</title></head><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#e0eaff,#f8fbff);color:#1e293b;display:flex;align-items:center;justify-content:center;min-height:100vh"><div style="text-align:center;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(59,130,246,.15);padding:40px;max-width:380px"><div style="font-size:52px">${emoji}</div><h2 style="margin:16px 0 8px">${title}</h2><p style="color:#64748b;margin:0 0 20px;line-height:1.6">${desc}</p><a href="/" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600">\u8FD4\u56DE\u9996\u9875</a></div></body></html>`), "page");
  if (!token) {
    return page("\u2753", "\u9A8C\u8BC1\u94FE\u63A5\u7F3A\u5C11\u4EE4\u724C", "\u8BF7\u4ECE\u90AE\u4EF6\u4E2D\u6253\u5F00\u5B8C\u6574\u94FE\u63A5\u3002");
  }
  const result = await verifyEmailByToken2(c.env.DB, token);
  if (!result) {
    return page("\u274C", "\u9A8C\u8BC1\u94FE\u63A5\u65E0\u6548\u6216\u5DF2\u8FC7\u671F", "\u8BE5\u94FE\u63A5\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u53D1\u9001\u9A8C\u8BC1\u90AE\u4EF6\u3002");
  }
  return page("\u2705", "\u90AE\u7BB1\u9A8C\u8BC1\u6210\u529F", `\u5DF2\u9A8C\u8BC1\u90AE\u7BB1 <strong>${result.email}</strong>\u3002\u8BF7\u56DE\u5230\u7AD9\u70B9\u5237\u65B0\uFF0C\u5373\u53EF\u6B63\u5E38\u4F7F\u7528\u5168\u90E8\u529F\u80FD\u3002`);
});
app.route("/auth", auth_default);
app.route("/api/verification", verification_default);
app.route("/api", api_default);
app.route("/api/accounts", accounts_default);
app.route("/api/proxied", proxied_default);
app.route("/announcements", announcements_default);
app.route("/", pages_default);
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF" }, 500);
});
var index_default = app;
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
