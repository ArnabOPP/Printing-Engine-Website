import { Router } from 'express';
import crypto from 'node:crypto';
import { buildCatalog } from '../../../shared/customCatalog.js';
import { audit, data, save } from '../store.js';
import { cleanCustomProduct } from '../customProducts.js';
import { withCatalogLock } from '../catalogLock.js';
import { r2Enabled, saveCatalogMedia } from '../files.js';

const router = Router();
const problem = (message, status = 400) => Object.assign(new Error(message), { status, expose: true });
router.get('/', (req, res) => res.json({ groups: buildCatalog(data().catalog), revision: data().catalog.revision || 0, hiddenGroups: data().catalog.hiddenGroups }));
router.post('/media', async (req, res, next) => {
  try {
    const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.data || ''));
    if (!match) throw problem('Upload a PNG, JPG, WebP or GIF image.');
    const buf = Buffer.from(match[2], 'base64');
    if (!buf.length || buf.length > 8 * 1024 * 1024) throw problem('Images must be under 8 MB.');
    const actual = buf.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : buf[0] === 255 && buf[1] === 216 && buf[2] === 255 ? 'jpeg' : buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : /^GIF8[79]a/.test(buf.toString('ascii',0,6)) ? 'gif' : '';
    if (actual !== match[1]) throw problem('The file is not a valid supported image.');
    if (process.env.R2_REQUIRED === 'true' && !r2Enabled) throw problem('R2 catalogue storage is not configured.', 503);
    const name = `catalog-${crypto.randomBytes(12).toString('hex')}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
    await saveCatalogMedia(name, buf);
    res.status(201).json({ url: `/api/catalog/media/${name}` });
  } catch (err) { next(err); }
});
router.put('/:slug', async (req, res, next) => {
  try {
    await withCatalogLock(async () => {
      const old = data().catalog || {};
      if (Number(req.body?.revision) !== (old.revision || 0)) throw problem('Products or stock changed while you were editing. Reload the catalogue and reapply your changes.', 409);
      const slug = req.params.slug;
      if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) throw problem('Use a URL ID with lowercase letters, numbers and hyphens (2–80 characters).');
      const existing = buildCatalog(old).flatMap((g) => g.items).some((p) => p.slug === slug);
      if (req.body?.create === true && existing) throw problem('That URL ID already belongs to another product. Choose a new ID.', 409);
      const product = cleanCustomProduct(req.body?.product || {}, slug, old);
      const entries = { ...old.productEntries, [slug]: product };
      if (Object.keys(entries).length > 200) throw problem('At most 200 managed products are supported.');
      data().catalog = { ...old, revision: (old.revision || 0) + 1, productEntries: entries, stock: { ...old.stock, [slug]: { ...old.stock?.[slug], ...Object.fromEntries(product.variants.map((v) => [v.key, v.stock])) } } };
      audit(req.admin.email, 'custom-product.updated', `${slug} · ${product.status}`);
      try { await save(); } catch (err) { data().catalog = old; throw err; }
      res.json({ product, revision: data().catalog.revision });
    });
  } catch (err) { next(err); }
});
export default router;
