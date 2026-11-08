import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig(({mode})=>{
  const root=path.dirname(fileURLToPath(import.meta.url));
  const env=loadEnv(mode,root,'VITE_');
  const base=(env.VITE_API_URL||'').replace(/\/$/,'');
  const files=new Set(fs.readdirSync(path.join(root,'public')).filter((name)=>/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name)));
  const rewrite=(code)=>code.replace(/(["'`])(\/[^"'`\n]+\.(?:png|jpe?g|webp|gif|svg|avif))\1/gi,(full,quote,url)=>files.has(url.slice(1))?`${quote}${base}/api/media/assets/${encodeURIComponent(url.slice(1))}${quote}`:full);
  return {
  plugins: [{name:'r2-shop-image-urls',enforce:'pre',transform(code,id){if(!id.includes('node_modules')&&!id.replace(/\\/g,'/').includes('/shared/')&&/\.(jsx?|css)$/.test(id))return {code:rewrite(code),map:null};},transformIndexHtml:{order:'pre',handler:rewrite}},react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.API_URL || 'http://localhost:5000',
      '/uploads': process.env.API_URL || 'http://localhost:5000',
    },
  },
};});
