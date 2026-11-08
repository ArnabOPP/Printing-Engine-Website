import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pe-media-test-'));
const assets=path.join(dir,'builtins');fs.mkdirSync(assets);
Object.assign(process.env,{DATA_DIR:dir,SHOP_ASSET_DIR:assets,ADMIN_AUTH_PROVIDER:'local',JWT_SECRET:'media-test-secret-at-least-32-characters',R2_BUCKET:'private-test',R2_PUBLIC_BUCKET:'public-test',R2_PUBLIC_BASE_URL:'https://images.test',R2_PUBLIC_DELIVERY:'true',R2_ACCOUNT_ID:'test',R2_ACCESS_KEY_ID:'test',R2_SECRET_ACCESS_KEY:'test',R2_REQUIRED:'true'});
const files=await import('../src/files.js');
const objects=new Map();const writes=[];
let failWrite=false;let dispatchOnUpload=null;
mock.method(files.r2Client,'send',async(command)=>{
  const p=command.input;const key=`${p.Bucket}/${p.Key}`;
  if(command.constructor.name==='PutObjectCommand'){
    if(failWrite)throw new Error('Storage offline');
    objects.set(key,{body:Buffer.from(p.Body),date:new Date()});writes.push(key);
    if(dispatchOnUpload&&p.Key.startsWith(`artwork/${dispatchOnUpload.id}/`))dispatchOnUpload.dispatchedAt=new Date().toISOString();
    return {};
  }
  if(command.constructor.name==='ListObjectsV2Command')return {Contents:[...objects].filter(([k])=>k.startsWith(`${p.Bucket}/${p.Prefix}`)).map(([k,v])=>({Key:k.slice(p.Bucket.length+1),LastModified:v.date,Size:v.body.length}))};
  if(command.constructor.name==='DeleteObjectCommand'){objects.delete(key);return {};}
  const value=objects.get(key);
  if(!value)throw Object.assign(new Error('Not found'),{name:'NoSuchKey',$metadata:{httpStatusCode:404}});
  if(command.constructor.name==='HeadObjectCommand')return {ContentLength:value.body.length};
  if(command.constructor.name==='GetObjectCommand')return {Body:{transformToByteArray:async()=>value.body}};
  throw new Error('Unexpected command');
});
const {data,PUBLIC_DIR,UPLOAD_DIR}=await import('../src/store.js');
const {syncAllImages,cleanupAbandonedImages,mediaStatus}=await import('../src/mediaStorage.js');
const {mediaRouter,uploadsRouter}=await import('../src/routes/media.js');
const {default:adminRouter}=await import('../src/routes/admin.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ZkAAAAASUVORK5CYII=','base64');
fs.writeFileSync(path.join(assets,'product.png'),png);fs.writeFileSync(path.join(assets,'not-an-image.txt'),'skip');
fs.writeFileSync(path.join(PUBLIC_DIR,'old-upload.png'),png);
const legacy=`catalog-${'a'.repeat(24)}.png`;
objects.set(`private-test/catalog/${legacy}`,{body:png,date:new Date()});
objects.set('private-test/public/uploads/earlier-r2.png',{body:png,date:new Date()});
data().orders.push({id:'PE-local',assetStorage:'local'});
fs.mkdirSync(path.join(UPLOAD_DIR,'PE-local'));fs.writeFileSync(path.join(UPLOAD_DIR,'PE-local','art.png'),png);
data().reviews.push({id:'rv_abc',status:'published',photos:['photo-1.webp'],assetStorage:'local'});
fs.mkdirSync(path.join(UPLOAD_DIR,'review-rv_abc'));fs.writeFileSync(path.join(UPLOAD_DIR,'review-rv_abc','photo-1.webp'),png);
data().admins.push({id:'staff',name:'Staff',email:'staff@test.example',role:'staff',tokenVersion:0});
const cookie=`pe_admin=${jwt.sign({sub:'staff',tv:0},process.env.JWT_SECRET)}`;
const app=express();app.use(express.json(),cookieParser());app.use('/api/media',mediaRouter);app.use('/uploads',uploadsRouter);app.use('/admin',adminRouter);app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
const server=app.listen(0,'127.0.0.1');await new Promise((resolve)=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
test('public bucket variables alone cannot activate CDN delivery or change the default storage bucket',async()=>{
  delete process.env.R2_PUBLIC_DELIVERY;
  try{const defaults=await import('../src/files.js?api-default');assert.equal(defaults.publicBucket,'private-test');assert.equal(defaults.publicBase,'');defaults.r2Client.destroy();}
  finally{process.env.R2_PUBLIC_DELIVERY='true';}
});
test('migration copies public assets and legacy images while originals and review photos stay private',async()=>{
  await syncAllImages();assert.equal(mediaStatus().lastSync.errorCount,0);
  for(const key of ['public-test/public/assets/product.png','public-test/public/uploads/old-upload.png',`public-test/public/catalog/${legacy}`,'public-test/public/uploads/earlier-r2.png','private-test/artwork/PE-local/art.png','private-test/artwork/review-rv_abc/photo-1.webp'])assert.ok(objects.has(key),key);
  assert.ok(![...objects.keys()].some((k)=>k.startsWith('public-test/')&&k.includes('artwork/')));
  assert.equal(data().orders[0].assetStorage,'r2');assert.equal(data().reviews[0].assetStorage,'r2');
  assert.ok(fs.existsSync(path.join(UPLOAD_DIR,'PE-local','art.png')));
  const count=writes.length;await syncAllImages();assert.equal(writes.length,count,'unchanged sources must not be uploaded again');
});
test('public delivery uses the CDN only for migrated public images and never exposes private keys',async()=>{
  const r=await fetch(`${base}/api/media/assets/product.png`,{redirect:'manual'});assert.equal(r.status,302);assert.match(r.headers.get('location'),/^https:\/\/images.test\/public\/assets\/product.png\?v=/);
  assert.equal(r.headers.get('access-control-allow-origin'),'*');
  const record=data().mediaObjects['assets/product.png'];delete data().mediaObjects['assets/product.png'];
  const proxied=await fetch(`${base}/api/media/assets/product.png`);assert.equal(proxied.status,200);assert.equal(proxied.headers.get('x-image-storage'),'r2');
  data().mediaObjects['assets/product.png']=record;
  assert.equal((await fetch(`${base}/api/media/assets/art.png`)).status,404);
  assert.equal((await fetch(`${base}/uploads/artwork%2FPE-local%2Fart.png`)).status,404);
  assert.equal((await fetch(`${base}/admin/media-status`)).status,401);
});
test('new admin product and home images write to R2, and invalid images or failed storage return no success',async()=>{
  const upload=(body)=>fetch(`${base}/admin/uploads`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-Admin-Request':'1'},body:JSON.stringify(body)});
  assert.equal((await upload({data:'data:image/png;base64,YmFk'})).status,400);
  const r=await upload({data:`data:image/png;base64,${png.toString('base64')}`});assert.equal(r.status,201,await r.clone().text());
  const {url}=await r.json();assert.ok(objects.has(`public-test/public/uploads/${url.split('/').pop()}`));
  assert.equal((await fetch(base+url,{redirect:'manual'})).status,302);
  failWrite=true;try{assert.equal((await upload({data:`data:image/png;base64,${png.toString('base64')}`})).status,500);}finally{failWrite=false;}
});
test('migration cannot resurrect artwork if dispatch occurs while the upload is in flight',async()=>{
  const order={id:'PE-race',assetStorage:'local'};data().orders.push(order);fs.mkdirSync(path.join(UPLOAD_DIR,order.id));fs.writeFileSync(path.join(UPLOAD_DIR,order.id,'art.png'),png);
  dispatchOnUpload=order;try{await syncAllImages();}finally{dispatchOnUpload=null;}
  assert.ok(![...objects.keys()].some((k)=>k.startsWith('private-test/artwork/PE-race/')));
});
test('abandoned-file cleanup removes only old unattached artwork, protecting current orders and public images',async()=>{
  const old=new Date(Date.now()-8*86400000);
  objects.set('private-test/artwork/PE-failed/leftover.png',{body:png,date:old});
  objects.set('private-test/artwork/PE-fresh/pending.png',{body:png,date:new Date()});
  objects.get('private-test/artwork/PE-local/art.png').date=old;
  await cleanupAbandonedImages();
  assert.ok(!objects.has('private-test/artwork/PE-failed/leftover.png'));
  assert.ok(objects.has('private-test/artwork/PE-fresh/pending.png'));
  assert.ok(objects.has('private-test/artwork/PE-local/art.png'));
  assert.ok(objects.has('public-test/public/assets/product.png'));
});
test.after(async()=>{await new Promise((resolve)=>server.close(resolve));mock.restoreAll();assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));await fs.promises.rm(dir,{recursive:true,force:true});});
