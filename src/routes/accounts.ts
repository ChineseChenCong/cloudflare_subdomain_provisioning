import { Hono } from "hono";
import type { Env, User } from "../types";
import { authMiddleware, emailVerifiedMiddleware } from "../middleware/auth";
import {
  getUserAccounts,
  getDefaultAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getActiveAccounts,
} from "../services/cloudflare-accounts";
import { encryptText } from "../services/crypto";
import { verifyToken } from "../services/cloudflare";

type Variables = { user: User };

const accounts = new Hono<{ Bindings: Env; Variables: Variables }>();

accounts.use("/*", authMiddleware, emailVerifiedMiddleware);

// 获取用户的 Cloudflare 账户列表
accounts.get("/", async (c) => {
  const user = c.get("user");
  const accountsList = await getUserAccounts(c.env.DB, c.env, user.id);
  return c.json({ accounts: accountsList });
});

// 获取默认账户
accounts.get("/default", async (c) => {
  const user = c.get("user");
  const defaultAccount = await getDefaultAccount(c.env.DB, c.env, user.id);
  if (!defaultAccount) {
    return c.json({ account: null });
  }
  return c.json({ account: defaultAccount });
});

// 创建 Cloudflare 账户
accounts.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    account_name: string;
    api_token: string;
    zone_id?: string;
  }>();

  const { account_name, api_token } = body;

  if (!account_name || !api_token) {
    return c.json({ error: "请提供账户名称和 API Token" }, 400);
  }

  if (account_name.length < 2 || account_name.length > 50) {
    return c.json({ error: "账户名称长度应在 2-50 个字符之间" }, 400);
  }

  try {
    const account = await createAccount(
      c.env.DB,
      c.env,
      user.id,
      account_name.trim(),
      api_token.trim(),
      body.zone_id,
    );

    return c.json({ account }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "创建账户失败" }, 400);
  }
});

// 更新 Cloudflare 账户
accounts.put("/:id", async (c) => {
  const user = c.get("user");
  const accountId = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<{
    account_name?: string;
    api_token?: string;
    zone_id?: string;
    is_active?: boolean;
    is_default?: boolean;
  }>();

  try {
    const account = await updateAccount(
      c.env.DB,
      c.env,
      user.id,
      accountId,
      body,
    );
    return c.json({ account });
  } catch (err: any) {
    return c.json({ error: err.message || "更新账户失败" }, 400);
  }
});

// 删除 Cloudflare 账户
accounts.delete("/:id", async (c) => {
  const user = c.get("user");
  const accountId = parseInt(c.req.param("id"), 10);

  try {
    await deleteAccount(c.env.DB, user.id, accountId);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message || "删除账户失败" }, 400);
  }
});

// 验证 API Token
accounts.post("/verify-token", async (c) => {
  const body = await c.req.json<{ api_token: string }>();

  if (!body.api_token) {
    return c.json({ error: "请提供 API Token" }, 400);
  }

  try {
    const isValid = await verifyToken(body.api_token.trim());
    return c.json({ valid: isValid });
  } catch {
    return c.json({ valid: false });
  }
});

export default accounts;
