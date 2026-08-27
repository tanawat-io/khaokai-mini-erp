// Wraps the existing Express app (server/app.ts — auth/router/repository/domain logic, all
// untouched) as a classic Netlify Function. netlify.toml redirects /api/* here as
// /.netlify/functions/api/:splat; `basePath: '/api'` tells serverless-http to put the "/api"
// prefix back on req.url before Express sees it, so the app's existing `app.use('/api', ...)`
// mounts keep matching without any route changes.
import serverlessHttp from 'serverless-http';
import { app } from '../../server/app';

export const handler = serverlessHttp(app, { basePath: '/api' });
