import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pe-assets-test-'));
process.env.DATA_DIR = directory;
process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.R2_BUCKET = '';
process.env.R2_REQUIRED = 'false';
const { ordersRouter } = await import('../src/routes/public.js');
const { data } = await import('../src/store.js');
const { readArtwork } = await import('../src/files.js');
const { cleanupOrderAssets } = await import('../src/assetRetention.js');
const { applyTracking } = await import('../src/shipping.js');
const { stageOf } = await import('../src/delhivery.js');
const { buildCatalog } = await import('../../shared/customCatalog.js');
const { customQuote } = await import('../../shared/customQuote.js');
const app = express();
app.use(express.json());
app.use('/orders', ordersRouter);
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.on('listening', resolve));
const url = `http://127.0.0.1:${server.address().port}/orders`;
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ZkAAAAASUVORK5CYII=';
const design = () => ({ front: [{ type: 'image', x:50,y:50,rot:0,w:20,image: { src: png, name: 'art.png',ratio:1 } }],back:[],left:[],right:[],mode:'normal', mockups: { front: png },prints:{front:{src:png,widthIn:10}} });
const cfg = { material:'Pure cotton',colour:'white',audience:'unisex',sizes:{L:1},quantity:1,method:'dtf' };
const product = buildCatalog().flatMap((g) => g.items).find((p) => p.slug === 'regular-t-shirt');
const unit = customQuote(product,cfg,design()).perPiece;
const body = () => ({
  customer: { name: 'Test Customer', phone: '9876543210', email: 'test@example.com', line1: '123 Test Street', city: 'Kolkata', state: 'West Bengal', pin: '700001' },
  items: [{ name: 'Regular tee', qty: 1, unit, config:cfg, slug: 'regular-t-shirt', designId: 'design-one' }, { name: 'Regular tee', qty: 1, unit, config:cfg, slug: 'regular-t-shirt', designId: 'design-two' }],
  designs: { 'design-one': design(), 'design-two': design() },
});
const post = (payload) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

test('custom order keeps distinct designs, artwork and mockups as private files', async () => {
  const response = await post(body());
  assert.equal(response.status, 201);
  const order = data().orders[0];
  assert.deepEqual(Object.keys(order.designs), ['design-one', 'design-two']);
  const first = order.designs['design-one'];
  assert.equal(first.front[0].image.src, undefined);
  assert.equal((await readArtwork(order.id, first.front[0].image.file)).type, 'image/png');
  assert.equal((await readArtwork(order.id, first.mockups.front.file)).type, 'image/png');
  assert.equal((await readArtwork(order.id, first.prints.front.file)).type, 'image/png');
  assert.equal(first.prints.front.widthPx,1);
  assert.equal(first.prints.front.src,undefined);
  assert.notEqual(first.prints.front.file,first.mockups.front.file);
  assert.notEqual(first.mockups.front.file, order.designs['design-two'].mockups.front.file);
});
test('invalid print-only exports are rejected before an order or files are created',async()=>{
  const payload=body();payload.designs['design-one'].prints.front.src='data:image/png;base64,YmFk';
  const count=data().orders.length;assert.equal((await post(payload)).status,400);assert.equal(data().orders.length,count);
});

test('missing mockup refuses the order before saving files', async () => {
  const payload = body();
  delete payload.designs['design-one'].mockups;
  const response = await post(payload);
  assert.equal(response.status, 400);
});

test('R2-required mode refuses local fallback', async () => {
  process.env.R2_REQUIRED = 'true';
  try { assert.equal((await post(body())).status, 503); }
  finally { process.env.R2_REQUIRED = 'false'; }
});

test('booking, unknown scans and manual status never trigger retention', async () => {
  for (const status of ['', 'Unknown', 'Manifested', 'Not Picked', 'Pickup Pending']) {
    assert.equal(stageOf(status), 'booked', status);
  }
  assert.equal(stageOf('RTO Delivered', 'DL'), 'returned');
  const order = { id: 'test', status: 'shipped', shipment: {}, history: [] };
  applyTracking(order, { stage: 'booked' });
  assert.equal(order.dispatchedAt, undefined);
  assert.equal(await cleanupOrderAssets(order, { remove: () => assert.fail('must retain') }), false);
});

test('courier dispatch triggers deletion once; failed deletion can retry', async () => {
  const order = { id: 'dispatch-test', status: 'ready', shipment: {}, history: [] };
  applyTracking(order, { stage: stageOf('In Transit') });
  assert.equal(order.status, 'shipped');
  assert.ok(order.dispatchedAt);
  const options = { persist: async () => {}, record: () => {}, remove: async () => { throw new Error('offline'); } };
  await assert.rejects(cleanupOrderAssets(order, options), /offline/);
  assert.equal(order.assetsDeletedAt, undefined);
  let removed = 0;
  options.remove = async () => { removed++; };
  assert.equal(await cleanupOrderAssets(order, options), true);
  assert.ok(order.assetsDeletedAt);
  assert.equal(await cleanupOrderAssets(order, options), false);
  assert.equal(removed, 1);
});

test('missing R2 configuration preserves pending R2 cleanup', async () => {
  const order = { id: 'r2-test', dispatchedAt: new Date().toISOString(), assetStorage: 'r2' };
  assert.equal(await cleanupOrderAssets(order, { r2Available: false, remove: () => assert.fail('must retain') }), false);
  assert.equal(order.assetsDeletedAt, undefined);
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  // The target is the exact directory returned by mkdtemp inside the OS temp directory.
  assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
  await fs.rm(directory, { recursive: true, force: true });
});
