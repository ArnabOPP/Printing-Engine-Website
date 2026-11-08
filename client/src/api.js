// Talks to the shop's server. In development Vite forwards /api to it; when the website and the server are on
// different addresses, set VITE_API_URL (for example https://api.example.com) when building the website.
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const apiUrl = (path) => `${BASE}${path}`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, signal, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        // Changes made from the admin panel must carry this (the server checks it).
        ...(method !== 'GET' ? { 'X-Admin-Request': '1' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  // A host with no server behind it answers with a web page instead of JSON.
  if (res.ok && !(res.headers.get('content-type') || '').includes('json')) throw new ApiError('The shop server is not available right now. Please try again later.', 503);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', res.status);
  return data;
}

// Downloads a protected file (customer artwork) and returns a temporary address the browser can show.
export async function fileUrl(path) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError('Could not load the file.', res.status);
  return URL.createObjectURL(await res.blob());
}

// Pictures the team uploads live on the shop's server (/uploads/…). Everything else is used as it is.
export const assetUrl = (src) => {
  if(typeof src!=='string')return src;
  if(src.startsWith('/uploads/')||src.startsWith('/api/catalog/media/')||src.startsWith('/api/media/'))return `${BASE}${src}`;
  if(/^\/[A-Za-z0-9][A-Za-z0-9._ -]*\.(png|jpe?g|webp|gif|svg|avif)$/i.test(src))return `${BASE}/api/media/assets/${encodeURIComponent(src.slice(1))}`;
  return src;
};
