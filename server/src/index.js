import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { ORIGINS, PORT, isProd } from './config.js';
import apiRouter from './routes/index.js';
import adminRouter from './routes/admin.js';
import { catalogRouter, ordersRouter } from './routes/public.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1); // behind a host's proxy, so rate limits see the real visitor address
app.use(helmet());
// Only the shop's own website may call the API with cookies (the admin login cookie included).
app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(cookieParser());

// Orders can carry the customer's uploaded artwork, so this one route accepts a bigger body than the rest.
app.use('/api/orders', express.json({ limit: '60mb' }), ordersRouter);
app.use(express.json({ limit: '100kb' }));

app.use('/api/catalog', catalogRouter);
app.use('/api/admin', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, adminRouter);
app.use('/api', apiRouter);

// Serve the built React app in production
if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/admin')) res.set('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on our side.' });
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
