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
import { catalogRouter, contentRouter, couponRouter, ordersRouter } from './routes/public.js';
import { PUBLIC_DIR, save } from './store.js';
import { shippingRouter, trackRouter, webhookRouter } from './routes/track.js';
import { pollActive } from './shipping.js';
import { cleanupDispatchedAssets } from './assetRetention.js';
import { acquireStoreLock } from './processLock.js';
import { reviewsRouter } from './routes/reviews.js';
import { purgeRemovedReviews, cleanupReviewPhotos } from './reviewDeletion.js';
import { mediaRouter, uploadsRouter } from './routes/media.js';
import { syncAllImages, cleanupAbandonedImages } from './mediaStorage.js';

const releaseLock = acquireStoreLock();
process.on('exit', releaseLock);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1); // behind a host's proxy, so rate limits see the real visitor address
app.use(helmet());
// Only the shop's own website may call the API with cookies (the admin login cookie included).
app.use(cors({ origin: ORIGINS, credentials: true }));
morgan.token('safe-url', (req) => {
  const url = new URL(req.originalUrl, 'http://local');
  if (url.searchParams.has('key')) url.searchParams.set('key', '[redacted]');
  return url.pathname + url.search;
});
app.use(morgan(':method :safe-url :status :response-time ms'));
app.use(cookieParser());
app.use('/api/reviews', reviewsRouter);

// Orders can carry the customer's uploaded artwork, so this one route accepts a bigger body than the rest.
app.use('/api/orders', express.json({ limit: '60mb' }), ordersRouter);
app.use('/api/admin/uploads', express.json({ limit: '12mb' })); // website pictures, uploaded by signed-in admins
app.use('/api/admin/custom-products/media', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '1mb' }));

// Pictures the team uploaded for the website. Public, and served so a browser can only ever show them as images.
app.use('/uploads', uploadsRouter);
app.use('/api/media', mediaRouter);

app.use('/api/catalog', catalogRouter);
app.use('/api/content', contentRouter);
app.use('/api/coupons', couponRouter);
app.use('/api/track', trackRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/admin', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, adminRouter);
app.use('/api', apiRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));

// Serve the built React app in production
if (isProd && process.env.API_ONLY !== 'true') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/admin') || req.path.startsWith('/custom-admin')) res.set('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
  if (err.status && (err.status < 500 || err.expose)) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on our side.' });
});

await purgeRemovedReviews();
const server = app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
server.on('error', (err) => { console.error('Server failed:', err.message); process.exitCode = 1; releaseLock(); });
const syncMedia=()=>syncAllImages().catch((err)=>console.error('R2 image sync failed:',err.name));
syncMedia();
const mediaSync=setInterval(syncMedia,60*60*1000);mediaSync.unref();
const abandonedCleanup=setInterval(()=>cleanupAbandonedImages().catch((err)=>console.error('Abandoned image cleanup failed:',err.name)),24*60*60*1000);abandonedCleanup.unref();
cleanupAbandonedImages().catch((err)=>console.error('Abandoned image cleanup failed:',err.name));

// Check parcels that are on their way every 30 minutes (covers any push Delhivery misses).
const polling = setInterval(() => pollActive().catch((e) => console.error('Tracking poll failed:', e.message)), 30 * 60 * 1000);
polling.unref();
pollActive().catch((e) => console.error('Initial tracking check failed:', e.message));
// Retry interrupted deletions after restart and independently of courier polling.
cleanupDispatchedAssets().catch((e) => console.error('Artwork cleanup failed:', e.message));
const cleanup = setInterval(() => {
  cleanupDispatchedAssets().catch((e) => console.error('Artwork cleanup failed:', e.message));
  cleanupReviewPhotos().catch((e) => console.error('Review photo cleanup failed:', e.message));
}, 60 * 1000);
cleanup.unref();
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(polling);
  clearInterval(cleanup);
  clearInterval(mediaSync);
  clearInterval(abandonedCleanup);
  server.close(async () => {
    try { await save(); } catch (err) { console.error('Shutdown save failed:', err.message); process.exitCode = 1; }
    releaseLock();
    process.exit(process.exitCode || 0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
