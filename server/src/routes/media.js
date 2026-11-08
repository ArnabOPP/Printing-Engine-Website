import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { ASSET_DIR, publicImageUrl } from '../mediaStorage.js';
import { readPublicMedia, readCatalogMedia, typeOf } from '../files.js';

export const mediaRouter=Router();
export const uploadsRouter=Router();
export async function servePublicImage(req,res,next,kind,name){
  try{
    if(!/^[A-Za-z0-9][A-Za-z0-9._ -]*\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name))return res.status(404).json({error:'Image not found.'});
    const direct=publicImageUrl(kind,name);
    res.set({'Cross-Origin-Resource-Policy':'cross-origin','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'});
    if(direct)return res.set('Cache-Control','public, max-age=300').redirect(302,direct);
    let file=kind==='catalog'?await readCatalogMedia(name):await readPublicMedia(kind,name);
    if(!file&&kind==='assets'){
      const local=path.join(ASSET_DIR,name);
      if(fs.existsSync(local)&&fs.statSync(local).isFile())file={body:await fs.promises.readFile(local),type:typeOf(name),storage:'bundled'};
    }
    if(!file)return res.status(404).json({error:'Image not found.'});
    res.set({'Content-Type':file.type,'X-Image-Storage':file.storage||'local','Cache-Control':kind==='assets'?'public, max-age=3600':'public, max-age=604800, immutable'}).send(file.body);
  }catch(err){next(err);}
}
mediaRouter.get('/assets/:name',(req,res,next)=>servePublicImage(req,res,next,'assets',req.params.name));
uploadsRouter.get('/:name',(req,res,next)=>servePublicImage(req,res,next,req.params.name.startsWith('catalog-')?'catalog':'uploads',req.params.name));
