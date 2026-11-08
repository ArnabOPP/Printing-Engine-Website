import { Router, json } from 'express';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import { data, save, newId } from '../store.js';
import { withReviewLock as locked, deleteReview } from '../reviewDeletion.js';
import { firebaseIdentity, firebaseAuthError } from '../firebaseAdmin.js';
import { saveArtwork, readArtwork, deleteArtwork, r2Enabled } from '../files.js';
import { visibleCatalog } from '../../../shared/customCatalog.js';
import { shopBaseProducts } from '../../../shared/shopProducts.js';

export const reviewsRouter = Router();
export const reviewAdminRouter = Router();
const bad = (message, status = 400) => Object.assign(new Error(message), { status });
const list = () => data().reviews;
const visible = (r) => r.status === 'published';
const publicReview = (r) => ({ id:r.id, name:r.name, rating:r.rating, comment:r.comment, createdAt:r.createdAt,
  photos:r.photos.map((name) => `/api/reviews/${r.id}/photos/${name}`) });
function productFor(key) {
  if (typeof key !== 'string' || key.length > 150) throw bad('Choose a product.');
  const [kind, ...rest] = key.split(':'); const id = rest.join(':');
  const product = kind === 'shop' ? (data().content.products || shopBaseProducts).find((p) => p.id === id && p.active !== false)
    : kind === 'custom' ? visibleCatalog(data().catalog).flatMap((g) => g.items).find((p) => p.slug === id) : null;
  if (!product) throw bad('Product not found.', 404);
  return product;
}
export async function requireReviewer(req, res, next) {
  try {
    const token = /^Bearer ([^\s]+)$/.exec(req.get('authorization') || '')?.[1];
    if (!token) throw bad('Sign in to write a review.', 401);
    req.reviewer = await firebaseIdentity().verifyIdToken(token, true);
    if (!req.reviewer.uid) throw bad('Sign in again.', 401);
    next();
  } catch (err) { next(firebaseAuthError(err)); }
}
const submitLimit = rateLimit({ windowMs:60*60*1000, limit:10, standardHeaders:'draft-7', legacyHeaders:false,
  keyGenerator:(req) => req.reviewer.uid, message:{error:'Too many review attempts. Please try again in an hour.'} });
const ipSubmitLimit = rateLimit({windowMs:60*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many review attempts from this connection. Try again later.'}});
reviewsRouter.use((req,res,next) => { res.set('Cache-Control','no-store'); next(); });
reviewsRouter.get('/', (req,res,next) => {
  try {
    productFor(req.query.product);
    const reviews = list().filter((r) => r.productKey === req.query.product && visible(r));
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page,10) || 1));
    res.json({ count:reviews.length, average:reviews.length ? Math.round(reviews.reduce((n,r) => n+r.rating,0)/reviews.length*10)/10 : null,
      reviews:reviews.slice((page-1)*10,page*10).map(publicReview), page, hasMore:page*10 < reviews.length });
  } catch (err) { next(err); }
});
reviewsRouter.get('/mine', requireReviewer, (req,res,next) => {
  try { productFor(req.query.product); res.json({ submitted:list().some((r) => visible(r) && r.productKey === req.query.product && r.uid === req.reviewer.uid) }); }
  catch(err) { next(err); }
});
reviewsRouter.get('/:id/photos/:name', async (req,res,next) => {
  try {
    const review = list().find((r) => r.id === req.params.id && visible(r));
    if (!review || !review.photos.includes(req.params.name)) return res.status(404).json({error:'Photo not found.'});
    const image = await readArtwork(`review-${review.id}`,req.params.name);
    // Recheck after storage I/O in case an admin removed the review meanwhile.
    if (!image || !visible(review)) return res.status(404).json({error:'Photo not found.'});
    res.set({'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'cross-origin'}).send(image.body);
  } catch(err) { next(err); }
});
reviewsRouter.post('/', ipSubmitLimit, requireReviewer, submitLimit, json({limit:'13mb'}), async (req,res,next) => {
  let reviewId;
  try {
    await locked(async () => {
      const body = req.body || {}; const product = productFor(body.product);
      const rating = body.rating; const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw bad('Choose a rating from 1 to 5.');
      if (comment.length < 3 || comment.length > 2000) throw bad('Write a review between 3 and 2,000 characters.');
      if (!name || name.length > 60) throw bad('Enter a public display name, up to 60 characters.');
      if (body.consent !== true) throw bad('Confirm that your review and photos may be published.');
      if (!Array.isArray(body.photos) || body.photos.length > 3) throw bad('Add up to three photos.');
      if (list().some((r) => visible(r) && r.productKey === body.product && r.uid === req.reviewer.uid)) throw bad('You have already reviewed this product.',409);
      if (list().length >= 50000) throw bad('Reviews are temporarily full. Please contact the shop.',503);
      if (body.photos.length && process.env.R2_REQUIRED === 'true' && !r2Enabled) throw bad('Photo storage is temporarily unavailable.',503);
      const images = [];
      for (const photo of body.photos) {
        const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(typeof photo === 'string' ? photo : '');
        if (!match) throw bad('Upload PNG, JPG or WebP photos.');
        const input = Buffer.from(match[2],'base64');
        if (!input.length || input.length > 3*1024*1024) throw bad('Each photo must be under 3 MB.');
        try {
          const img = sharp(input,{limitInputPixels:25000000,failOn:'warning'});
          const meta = await img.metadata();
          if (meta.format !== match[1] || (meta.pages || 1) > 1) throw new Error('Unsupported image');
          images.push(await img.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer());
        } catch { throw bad('A photo could not be read. Use a valid, still PNG, JPG or WebP image under 25 megapixels.'); }
      }
      reviewId = newId('rv_');
      const photos = [];
      for (let i=0;i<images.length;i++) { const file=`photo-${i+1}.webp`; await saveArtwork(`review-${reviewId}`,file,images[i]); photos.push(file); }
      const review = {id:reviewId,productKey:body.product,productName:product.name,uid:req.reviewer.uid,name,rating,comment,photos,assetStorage:r2Enabled?'r2':'local',status:'published',createdAt:new Date().toISOString()};
      list().unshift(review);
      try { await save(); } catch(err) { data().reviews = list().filter((r) => r !== review); throw err; }
      res.status(201).json({review:publicReview(review)});
    });
  } catch(err) {
    if (reviewId) await deleteArtwork(`review-${reviewId}`).catch(() => {});
    next(err);
  }
});

reviewAdminRouter.get('/', (req,res) => {
  const q = String(req.query.q || '').toLowerCase().slice(0,150);
  const page = Math.max(1,Number.parseInt(req.query.page,10)||1);
  const reviews = list().filter((r) => visible(r) && (!q || `${r.productName} ${r.name} ${r.comment}`.toLowerCase().includes(q)));
  res.json({total:reviews.length,page,hasMore:page*30<reviews.length,reviews:reviews.slice((page-1)*30,page*30).map((r) => ({...publicReview(r),productKey:r.productKey,productName:r.productName,status:r.status,moderation:r.moderation}))});
});
reviewAdminRouter.delete('/:id', async (req,res,next) => {
  try {
    if (!await deleteReview(req.params.id, req.admin.email)) throw bad('Review not found.',404);
    res.json({ok:true});
  } catch(err) { next(err); }
});
// An already-open older admin bundle must also remove permanently, never soft-delete.
reviewAdminRouter.patch('/:id', async (req,res,next) => {
  try {
    if (req.body?.status !== 'removed') throw bad('Restoring deleted reviews is no longer supported. Refresh the admin page.');
    if (!await deleteReview(req.params.id, req.admin.email)) throw bad('Review not found.',404);
    res.json({ok:true});
  } catch(err) { next(err); }
});
reviewAdminRouter.get('/:id/photos/:name', async (req,res,next) => {
  try {
    const review=list().find((r)=>r.id===req.params.id);
    if(!review || !review.photos.includes(req.params.name)) throw bad('Photo not found.',404);
    const image=await readArtwork(`review-${review.id}`,req.params.name);
    if(!image || review.status === 'deleted') throw bad('Photo not found.',404);
    res.set({'Content-Type':'image/webp','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).send(image.body);
  } catch(err){next(err);}
});
