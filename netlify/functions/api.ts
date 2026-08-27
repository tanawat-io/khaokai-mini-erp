// Wraps the existing Express app (server/app.ts — auth/router/repository/domain logic, all
// untouched) as a classic Netlify Function. netlify.toml rewrites /api/* to
// /.netlify/functions/api/:splat with status 200, but Netlify preserves the original
// request path in event.path (e.g. "/api/auth/login"), so Express must see "/api/..."
// directly — no basePath stripping. Previous `basePath: '/api'` made serverless-http
// strip "/api" via removeBasePath(), so Express received "/auth/login" and returned
// 404 "Cannot GET /auth/login".
import serverlessHttp from 'serverless-http';
import { app } from '../../server/app';

export const handler = serverlessHttp(app);
