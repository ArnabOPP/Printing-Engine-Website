import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('production API-only server starts, serves JSON health and rejects unknown API routes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-startup-test-'));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, NODE_ENV: 'production', API_ONLY: 'true', JWT_SECRET: 'startup-test-secret-at-least-32-characters', DELHIVERY_TOKEN: '', R2_BUCKET: '', CLIENT_ORIGIN: 'https://printingengine.in' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not start in time.')), 10000);
      child.stdout.on('data', (data) => { if (String(data).includes('Server listening')) { clearTimeout(timer); resolve(); } });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited before startup: ${code}`)); });
      child.once('error', reject);
    });
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');
    const missing = await fetch(`http://127.0.0.1:${port}/api/not-a-route`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /json/);
    const preflight = await fetch(`http://127.0.0.1:${port}/api/admin/me`, { method: 'OPTIONS', headers: { Origin: 'https://printingengine.in', 'Access-Control-Request-Method': 'GET' } });
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://printingengine.in');
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  } finally {
    child.kill();
    await exited;
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
