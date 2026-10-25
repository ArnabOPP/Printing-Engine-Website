# Printing Engine Website

React (Vite) frontend + Node.js (Express) backend, managed as npm workspaces.

## Structure

```
client/   React app (Vite, React Router)
server/   Express API (/api/*), serves client/dist in production
```

## Getting started

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

- Client: http://localhost:5173 (proxies `/api` to the server)
- API: http://localhost:5000/api/health

## Production

```bash
npm run build
NODE_ENV=production npm start
```

The server then serves the built client and the API on one port.

Requires Node.js 20.6+ (uses `--env-file`).
