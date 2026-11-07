import { deleteArtwork, r2Enabled } from './files.js';
import { audit, data, save } from './store.js';

const running = new Set();

// Only courier evidence sets dispatchedAt. Manual admin status changes never erase files.
export async function cleanupOrderAssets(order, { remove = deleteArtwork, persist = save, record = audit, r2Available = r2Enabled } = {}) {
  if (!order.dispatchedAt || order.assetsDeletedAt || running.has(order.id)) return false;
  if (order.assetStorage === 'r2' && !r2Available) return false;
  running.add(order.id);
  try {
    // An in-memory dispatch update must be durable before irreversible deletion.
    await persist();
    await remove(order.id);
    order.assetsDeletedAt = new Date().toISOString();
    record('system', 'artwork.deleted-after-dispatch', order.id);
    try { await persist(); } catch (err) { delete order.assetsDeletedAt; throw err; }
    return true;
  } finally { running.delete(order.id); }
}

export async function cleanupDispatchedAssets() {
  for (const id of [...(data().pendingFileDeletes || [])]) {
    if (running.has(id)) continue;
    running.add(id);
    try {
      await deleteArtwork(id);
      data().pendingFileDeletes = data().pendingFileDeletes.filter((value) => value !== id);
      await save();
    } catch (err) { console.error(`Deleted order file cleanup pending for ${id}:`, err.message); }
    finally { running.delete(id); }
  }
  for (const order of data().orders) {
    try { await cleanupOrderAssets(order); }
    catch (err) { console.error(`Artwork cleanup pending for ${order.id}:`, err.message); }
  }
}
