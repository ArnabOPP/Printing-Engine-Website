import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './config.js';

// A small JSON-file database: fine for a shop's orders at this size. All data is kept in memory and written to disk
// after every change (to a temporary file first, then renamed, so a crash never leaves a half-written file).
// To move to a real database later, only this file needs to change.

const FILE = path.join(DATA_DIR, 'db.json');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads'); // customers' artwork: private
export const PUBLIC_DIR = path.join(DATA_DIR, 'public'); // pictures the team uploads for the website: public
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const fresh = () => ({ admins: [], orders: [], catalog: {}, content: {}, coupons: [], audit: [] });

let db;
try {
  db = { ...fresh(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch {
  db = fresh();
}

let writing = Promise.resolve();
function persist() {
  const json = JSON.stringify(db);
  writing = writing.then(async () => {
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, json);
    await fs.promises.rename(tmp, FILE);
  }).catch((err) => console.error('Could not save the database:', err));
  return writing;
}

export const newId = (prefix = '') => prefix + crypto.randomBytes(6).toString('hex');

export const data = () => db;
export const save = persist;

export function audit(by, action, detail = '') {
  db.audit.unshift({ at: new Date().toISOString(), by, action, detail: String(detail).slice(0, 300) });
  if (db.audit.length > 500) db.audit.length = 500;
}
