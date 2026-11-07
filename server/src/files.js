// Where customers' artwork is kept. With Cloudflare R2 set up (R2_* in .env) the files go to a private bucket, so the
// server's disk is not needed for them. Without it they are kept in DATA_DIR/uploads, as before.
// Orders only ever store the file's name; this module is the only place that knows where the bytes live.
import fs from 'node:fs';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { UPLOAD_DIR, PUBLIC_DIR } from './store.js';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT } = process.env;

export const r2Enabled = Boolean(R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && (R2_ACCOUNT_ID || R2_ENDPOINT));

const client = r2Enabled
  ? new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    // R2 does not need the SDK's extra checksums.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  : null;

const key = (orderId, name) => `artwork/${orderId}/${name}`;
const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
export const typeOf = (name) => TYPES[String(name).split('.').pop()] || 'application/octet-stream';

// Catalogue templates have a separate, permanent prefix from disposable order files.
export async function saveCatalogMedia(name, buf) {
  if (!r2Enabled) return fs.promises.writeFile(path.join(PUBLIC_DIR, name), buf);
  await client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: `catalog/${name}`, Body: buf, ContentType: typeOf(name) }));
}
export async function readCatalogMedia(name) {
  if (!/^catalog-[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(name)) return null;
  const local = path.join(PUBLIC_DIR, name);
  if (fs.existsSync(local)) return { body: await fs.promises.readFile(local), type: typeOf(name) };
  if (!r2Enabled) return null;
  try {
    const value = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: `catalog/${name}` }));
    return { body: Buffer.from(await value.Body.transformToByteArray()), type: typeOf(name) };
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export async function saveArtwork(orderId, name, buf) {
  if (!r2Enabled) {
    const dir = path.join(UPLOAD_DIR, orderId);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, name), buf);
    return;
  }
  await client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key(orderId, name), Body: buf, ContentType: typeOf(name) }));
}

// Returns { body: Buffer, type } or null when there is no such file.
export async function readArtwork(orderId, name) {
  const local = path.join(UPLOAD_DIR, orderId, name);
  if (fs.existsSync(local)) return { body: await fs.promises.readFile(local), type: typeOf(name) }; // also covers files saved before R2 was switched on
  if (!r2Enabled) return null;
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key(orderId, name) }));
    return { body: Buffer.from(await res.Body.transformToByteArray()), type: typeOf(name) };
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export async function deleteArtwork(orderId) {
  if (!/^[A-Za-z0-9_-]+$/.test(orderId)) throw new Error('Invalid order file reference.');
  const target = path.resolve(UPLOAD_DIR, orderId);
  if (!target.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) throw new Error('Invalid artwork directory.');
  await fs.promises.rm(target, { recursive: true, force: true });
  if (!r2Enabled) return;
  let continuation;
  do {
    const list = await client.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: `artwork/${orderId}/`, ContinuationToken: continuation }));
    const results = await Promise.allSettled((list.Contents || []).map((o) => client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: o.Key }))));
    if (results.some((r) => r.status === 'rejected')) throw new Error('Some artwork could not be deleted. Cleanup will retry.');
    continuation = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuation);
}
