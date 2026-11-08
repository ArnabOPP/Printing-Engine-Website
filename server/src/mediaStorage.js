import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GetObjectCommand, ListObjectsV2Command, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { data, save, PUBLIC_DIR, UPLOAD_DIR } from './store.js';
import { r2Enabled, r2Client, publicBucket, publicBase, savePublicMedia, saveArtwork, deleteArtwork, typeOf } from './files.js';
import { withReviewLock } from './reviewDeletion.js';

const here=path.dirname(fileURLToPath(import.meta.url));
export const ASSET_DIR=process.env.SHOP_ASSET_DIR || (fs.existsSync(path.join(here,'../assets')) ? path.join(here,'../assets') : path.join(here,'../../client/public'));
const imageName=(name)=>/^[A-Za-z0-9][A-Za-z0-9._ -]*\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name);
let syncing=false;
export function mediaStatus(){return {enabled:r2Enabled,syncing,directPublicDelivery:!!publicBase,lastSync:data().mediaSync || null};}
export function publicImageUrl(kind,name){
  const record=data().mediaObjects?.[`${kind}/${name}`];
  return publicBase && record?.bucket===publicBucket ? `${publicBase}/public/${kind}/${encodeURIComponent(name)}${kind==='assets'?`?v=${record.hash.slice(0,16)}`:''}` : null;
}
async function syncPublic(kind,name,buf){
  const hash=crypto.createHash('sha256').update(buf).digest('hex');
  const key=`${kind}/${name}`;
  const old=data().mediaObjects?.[key];
  if(old?.hash===hash && old.bucket===publicBucket)return false;
  await savePublicMedia(kind,name,buf);
  // Verify successful writes without downloading each original a second time.
  const head=await r2Client.send(new HeadObjectCommand({Bucket:publicBucket,Key:`public/${key}`}));
  if(head.ContentLength!==buf.length)throw new Error('Image migration verification failed.');
  data().mediaObjects ||= {};
  data().mediaObjects[key]={hash,bucket:publicBucket};
  await save();
  return true;
}
async function listObjects(Bucket,Prefix){
  const all=[];let token;
  do{const page=await r2Client.send(new ListObjectsV2Command({Bucket,Prefix,ContinuationToken:token}));all.push(...(page.Contents||[]));token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
  return all;
}
export async function syncAllImages(){
  if(syncing || !r2Enabled)return;
  syncing=true;let uploaded=0;const errors=[];
  const attempt=async(fn)=>{try{await fn();}catch(err){errors.push(err.name || 'StorageError');}};
  try{
    // Catalogue, home page, readymade products, logos, size charts and blank mockups.
    for(const [dir,kindFor] of [[ASSET_DIR,()=> 'assets'],[PUBLIC_DIR,(n)=>n.startsWith('catalog-')?'catalog':'uploads']]){
      if(!fs.existsSync(dir))continue;
      for(const entry of await fs.promises.readdir(dir,{withFileTypes:true}))if(entry.isFile()&&imageName(entry.name))await attempt(async()=>{
        if(await syncPublic(kindFor(entry.name),entry.name,await fs.promises.readFile(path.join(dir,entry.name))))uploaded++;
      });
    }
    // Templates saved by earlier releases already exist in the private catalogue prefix.
    if(!data().legacyCatalogCopiedTo || data().legacyCatalogCopiedTo!==publicBucket)await attempt(async()=>{
      for(const obj of await listObjects(process.env.R2_BUCKET,'catalog/')){
        const name=obj.Key.slice('catalog/'.length);if(!/^catalog-[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(name))continue;
        const image=await r2Client.send(new GetObjectCommand({Bucket:process.env.R2_BUCKET,Key:obj.Key}));
        if(await syncPublic('catalog',name,Buffer.from(await image.Body.transformToByteArray())))uploaded++;
      }
      data().legacyCatalogCopiedTo=publicBucket;await save();
    });
    if(publicBucket!==process.env.R2_BUCKET&&data().privatePublicCopiedTo!==publicBucket)await attempt(async()=>{
      for(const obj of await listObjects(process.env.R2_BUCKET,'public/')){
        const relative=obj.Key.slice('public/'.length);const slash=relative.indexOf('/');
        const kind=relative.slice(0,slash),name=relative.slice(slash+1);
        if(!['assets','uploads','catalog'].includes(kind)||!imageName(name))continue;
        if(kind==='assets'&&fs.existsSync(path.join(ASSET_DIR,name)))continue;
        const image=await r2Client.send(new GetObjectCommand({Bucket:process.env.R2_BUCKET,Key:obj.Key}));
        if(await syncPublic(kind,name,Buffer.from(await image.Body.transformToByteArray())))uploaded++;
      }
      data().privatePublicCopiedTo=publicBucket;await save();
    });
    // Older local order artwork and review photos retain private access and original quality.
    for(const order of data().orders.filter((o)=>o.assetStorage!=='r2'&&!o.dispatchedAt&&!o.assetsDeletedAt))await attempt(async()=>{
      const dir=path.join(UPLOAD_DIR,order.id);if(!fs.existsSync(dir))return;
      for(const entry of await fs.promises.readdir(dir,{withFileTypes:true}))if(entry.isFile()&&imageName(entry.name)){await saveArtwork(order.id,entry.name,await fs.promises.readFile(path.join(dir,entry.name)));uploaded++;}
      if(order.dispatchedAt||order.assetsDeletedAt){await deleteArtwork(order.id);return;}
      order.assetStorage='r2';await save();
    });
    await withReviewLock(async()=>{
      for(const review of data().reviews.filter((r)=>r.status==='published'&&r.assetStorage!=='r2'))await attempt(async()=>{
        const dir=path.join(UPLOAD_DIR,`review-${review.id}`);
        if(!fs.existsSync(dir))return;
        for(const name of review.photos){await saveArtwork(`review-${review.id}`,name,await fs.promises.readFile(path.join(dir,name)));uploaded++;}
        review.assetStorage='r2';await save();
      });
    });
    data().mediaSync={at:new Date().toISOString(),uploaded,errorCount:errors.length,errors:[...new Set(errors)]};await save();
    console.log(`R2 image sync: ${uploaded} copied, ${errors.length} errors.`);
  }finally{syncing=false;}
}

// Failed/abandoned checkouts have no order record. Only remove objects older than 7 days.
export async function cleanupAbandonedImages(){
  if(!r2Enabled)return;
  const known=new Set([...data().orders.map((o)=>o.id),...data().reviews.map((r)=>`review-${r.id}`),...(data().pendingReviewDeletes||[]).map((j)=>`review-${j.id}`)]);
  const cutoff=Date.now()-7*24*60*60*1000;
  for(const obj of await listObjects(process.env.R2_BUCKET,'artwork/')){
    const id=obj.Key.split('/')[1];
    if(!/^(PE-[A-Za-z0-9_-]+|review-rv_[a-f0-9]+)$/.test(id)||known.has(id)||!obj.LastModified||new Date(obj.LastModified).getTime()>cutoff)continue;
    // Recheck live records after network I/O, never delete a newly accepted order.
    if(data().orders.some((o)=>o.id===id)||data().reviews.some((r)=>`review-${r.id}`===id))continue;
    await r2Client.send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key:obj.Key}));
  }
}
