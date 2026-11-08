import { data, save, audit } from './store.js';
import { deleteArtwork, r2Enabled } from './files.js';

let queue = Promise.resolve();
export const withReviewLock = (fn) => {
  const task = queue.then(fn);
  queue = task.catch(() => {});
  return task;
};
const cleaning = new Set();

// Commit removal and the cleanup job together before deleting any bytes.
async function erase(reviews, by) {
  if (!reviews.length) return;
  const oldReviews = data().reviews;
  const oldPending = data().pendingReviewDeletes || [];
  const statuses = reviews.map((r) => r.status);
  const ids = new Set(reviews.map((r) => r.id));
  data().reviews = oldReviews.filter((r) => !ids.has(r.id));
  data().pendingReviewDeletes = [...oldPending, ...reviews.filter((r) => r.photos?.length).map((r) => ({
    id: r.id,
    storage: r.assetStorage || (r2Enabled || process.env.R2_REQUIRED === 'true' ? 'r2' : 'local'),
  }))];
  reviews.forEach((r) => { r.status = 'deleted'; }); // revoke in-flight photo reads too
  const auditEntries = reviews.map((r) => {
    audit(by, 'review.deleted', r.id);
    return data().audit[0];
  });
  try { await save(); }
  catch (err) {
    data().reviews = oldReviews;
    data().pendingReviewDeletes = oldPending;
    reviews.forEach((r,i) => { r.status = statuses[i]; });
    data().audit = data().audit.filter((entry) => !auditEntries.includes(entry));
    throw err;
  }
}

export async function deleteReview(id, by) {
  const found = await withReviewLock(async () => {
    const review = data().reviews.find((r) => r.id === id);
    if (!review) return false;
    await erase([review], by);
    return true;
  });
  if (found) await cleanupReviewPhotos();
  return found;
}

export async function purgeRemovedReviews() {
  await withReviewLock(() => erase(data().reviews.filter((r) => r.status === 'removed'), 'system'));
  await cleanupReviewPhotos();
}

export async function cleanupReviewPhotos({ remove = deleteArtwork, r2Available = r2Enabled } = {}) {
  for (const job of [...(data().pendingReviewDeletes || [])]) {
    if (cleaning.has(job.id) || (job.storage === 'r2' && !r2Available)) continue;
    cleaning.add(job.id);
    try {
      await remove(`review-${job.id}`);
      await withReviewLock(async () => {
        const old = data().pendingReviewDeletes;
        data().pendingReviewDeletes = old.filter((j) => j.id !== job.id);
        try { await save(); } catch (err) { data().pendingReviewDeletes = old; throw err; }
      });
    } catch (err) { console.error(`Review photo deletion pending for ${job.id}:`, err.message); }
    finally { cleaning.delete(job.id); }
  }
}
