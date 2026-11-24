import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import apiRoutes from './routes/index.js';
import { getConfig } from './config/env.js';
import { errorHandler, ApiError } from './utils/http.js';

const config = getConfig();
const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = config.frontendDir ? path.resolve(config.frontendDir) : path.resolve(here, '../frontend');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', req.path.startsWith('/api/') ? 'no-store' : 'no-cache');
  next();
});
app.use('/api', apiRoutes);
app.use(express.static(frontendDir, { extensions: ['html'], index: 'index.html', maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next(new ApiError(404, 'API route not found.', 'ROUTE_NOT_FOUND'));
  res.sendFile(path.join(frontendDir, 'index.html'), error => { if (error) next(error); });
});
app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => console.log(`TicketMaster API listening on 0.0.0.0:${config.port}`));
