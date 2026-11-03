import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const isProd = process.env.NODE_ENV === 'production';
export const PORT = Number(process.env.PORT) || 5000;

// Where orders, admin accounts and uploaded artwork are kept. Back this folder up.
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, '../data'));
fs.mkdirSync(DATA_DIR, { recursive: true });

// Websites allowed to call the API (comma separated). The admin panel only works from these.
export const ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);

// The secret that signs admin login cookies. Set JWT_SECRET in production. In development one is made and kept on disk.
function loadSecret() {
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
    return process.env.JWT_SECRET;
  }
  if (isProd) throw new Error('JWT_SECRET is required in production.');
  const file = path.join(DATA_DIR, '.dev-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}
export const JWT_SECRET = loadSecret();

// If the website and the API are on different domains, set COOKIE_SAMESITE=none (needs https).
export const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'lax';
export const COOKIE_NAME = 'pe_admin';
export const SESSION_HOURS = 8;
