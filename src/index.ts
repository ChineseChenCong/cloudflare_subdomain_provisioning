import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, User } from './types';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import pageRoutes from './routes/pages';
import accountRoutes from './routes/accounts';
import verificationRoutes from './routes/verification';
import proxiedRoutes from './routes/proxied';
import announcementRoutes from './routes/announcements';

type Variables = { user: User };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 路由挂载
app.route('/auth', authRoutes);
app.route('/api', apiRoutes);
app.route('/api/accounts', accountRoutes);
app.route('/api/verification', verificationRoutes);
app.route('/api/proxied', proxiedRoutes);
app.route('/announcements', announcementRoutes);
app.route('/', pageRoutes);

// 404
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: '服务器内部错误' }, 500);
});

export default app;
