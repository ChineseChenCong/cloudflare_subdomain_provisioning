import { Hono } from 'hono';
import type { Env, User } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import {
  getActiveAnnouncements,
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../db/queries';
import { mirrorSyncRow } from '../services/mirror';

type Variables = { user: User };

const announcements = new Hono<{ Bindings: Env; Variables: Variables }>();

// 公开：获取启用中的公告（无需登录）
announcements.get('/', async (c) => {
  try {
    const list = await getActiveAnnouncements(c.env);
    return c.json({ announcements: list });
  } catch (err: any) {
    return c.json({ error: `获取公告失败: ${err.message}` }, 500);
  }
});

// ==================== 管理端（需管理员） ====================

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();
admin.use('/*', authMiddleware, adminMiddleware);

// 获取全部公告
admin.get('/', async (c) => {
  const list = await getAllAnnouncements(c.env);
  return c.json({ announcements: list });
});

// 创建公告
admin.post('/', async (c) => {
  const user = c.get('user');
  const parsed = await c.req
    .json<{ title?: string; content?: string; is_pinned?: boolean; sort_order?: number }>()
    .catch(() => null);
  const body = { title: '', content: '', is_pinned: undefined, sort_order: undefined, ...(parsed ?? {}) } as {
    title: string; content: string; is_pinned?: boolean; sort_order?: number;
  };

  if (!body.title || !body.title.trim()) {
    return c.json({ error: '公告标题不能为空' }, 400);
  }
  if (!body.content || !body.content.trim()) {
    return c.json({ error: '公告内容不能为空' }, 400);
  }

  const created = await createAnnouncement(
    c.env,
    body.title.trim(),
    body.content.trim(),
    user.id,
    body.sort_order,
    body.is_pinned
  );

  if (!created) {
    return c.json({ error: '创建公告失败' }, 500);
  }

  // write-through：镜像侧同步新增公告（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(c.env, 'announcements', created.id).catch(() => {});

  return c.json({ success: true, announcement: created });
});

// 更新公告
admin.put('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req
    .json<{ title?: string; content?: string; is_active?: boolean; is_pinned?: boolean; sort_order?: number }>()
    .catch(() => ({ title: undefined, content: undefined, is_active: undefined, is_pinned: undefined, sort_order: undefined }));

  const updated = await updateAnnouncement(c.env, id, {
    title: body.title !== undefined ? body.title.trim() : undefined,
    content: body.content !== undefined ? body.content.trim() : undefined,
    is_active: body.is_active,
    is_pinned: body.is_pinned,
    sort_order: body.sort_order,
  });

  if (!updated) {
    return c.json({ error: '公告不存在或未更新' }, 404);
  }

  // write-through：镜像侧同步更新公告（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(c.env, 'announcements', id).catch(() => {});

  return c.json({ success: true, announcement: updated });
});

// 删除公告
admin.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  await deleteAnnouncement(c.env, id);
  // write-through：镜像侧删除该公告行（best-effort，失败静默，日级 cron 回补）
  await mirrorSyncRow(c.env, 'announcements', id).catch(() => {});

  return c.json({ success: true });
});

announcements.route('/admin', admin);

export default announcements;
