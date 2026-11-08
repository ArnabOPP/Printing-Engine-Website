import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pe-reviews-test-'));
Object.assign(process.env,{DATA_DIR:dir,ADMIN_AUTH_PROVIDER:'local',FIREBASE_PROJECT_ID:'review-test',JWT_SECRET:'review-test-secret-at-least-32-characters',R2_BUCKET:'',R2_REQUIRED:'false'});
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const {firebaseIdentity}=await import('../src/firebaseAdmin.js');
mock.method(firebaseIdentity(),'verifyIdToken',async(token,revoked)=>{
  assert.equal(revoked,true);
  if(token==='invalid')throw Object.assign(new Error('Invalid token'),{code:'auth/invalid-id-token'});
  return {uid:token,email:'private@example.com',name:'Account name'};
});
const {data}=await import('../src/store.js');
const {reviewsRouter}=await import('../src/routes/reviews.js');
const {default:adminRouter}=await import('../src/routes/admin.js');
data().admins.push({id:'admin',email:'admin@example.com',name:'Admin',role:'staff',tokenVersion:0});
const cookie=`pe_admin=${jwt.sign({sub:'admin',tv:0},process.env.JWT_SECRET)}`;
const app=express();app.use(cookieParser());app.use('/reviews',reviewsRouter);app.use(express.json());app.use('/admin',adminRouter);
app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
const server=app.listen(0,'127.0.0.1');await new Promise((resolve)=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const review=(extra={})=>({product:'shop:d1',name:'Customer',rating:5,comment:'The print quality is excellent.',photos:[],consent:true,...extra});
async function req(route,{body,token,admin=false,method=body===undefined?'GET':'POST'}={}){
  return fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(admin?{Cookie:cookie,'X-Admin-Request':'1'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
test('reviews require valid Firebase identity, validate inputs, and reject client identity spoofing',async()=>{
  assert.equal((await req('/reviews',{body:review()})).status,401);
  assert.equal((await req('/reviews',{body:review(),token:'invalid'})).status,401);
  for(const extra of [{rating:6},{rating:1.5},{comment:'x'},{consent:false},{product:'shop:missing'},{photos:[1,2,3,4]}])
    assert.ok([400,404].includes((await req('/reviews',{body:review(extra),token:'validation'})).status));
  const response=await req('/reviews',{body:review({uid:'someone-else',status:'removed',verified:true}),token:'customer-one'});
  assert.equal(response.status,201,await response.clone().text());
  const r=(await response.json()).review;
  assert.equal(data().reviews.find((x)=>x.id===r.id).uid,'customer-one');
  assert.ok(!('uid' in r));assert.ok(!('verified' in r));
});
test('one review per account and product is enforced even for concurrent submissions',async()=>{
  const responses=await Promise.all([1,2].map(()=>req('/reviews',{body:review(),token:'simultaneous'})));
  assert.deepEqual(responses.map((r)=>r.status).sort(),[201,409]);
  assert.equal((await(await req('/reviews/mine?product=shop%3Ad1',{token:'simultaneous'})).json()).submitted,true);
});
let photoReview;
test('photo uploads decode real images, strip EXIF and resize; corrupt and SVG payloads are rejected',async()=>{
  const jpg=await sharp({create:{width:2000,height:1000,channels:3,background:'#b6ff00'}}).jpeg().withExif({IFD0:{Artist:'Private camera metadata'}}).toBuffer();
  for(const photo of ['data:image/png;base64,YmFk','data:image/svg+xml;base64,PHN2Zz4='])
    assert.equal((await req('/reviews',{body:review({photos:[photo]}),token:`bad-${photo.length}`})).status,400);
  const response=await req('/reviews',{body:review({photos:[`data:image/jpeg;base64,${jpg.toString('base64')}`],rating:3}),token:'photo-customer'});
  assert.equal(response.status,201,await response.clone().text());photoReview=(await response.json()).review;
  const image=await req(photoReview.photos[0].replace('/api/reviews','/reviews'));
  assert.equal(image.status,200);assert.equal(image.headers.get('cache-control'),'no-store');
  const meta=await sharp(Buffer.from(await image.arrayBuffer())).metadata();
  assert.equal(meta.format,'webp');assert.equal(meta.width,1600);assert.equal(meta.exif,undefined);
});
test('only admins can delete; deletion erases review and photos and allows a new opinion',async()=>{
  const route=`/admin/reviews/${photoReview.id}`;
  assert.equal((await req(route,{method:'DELETE'})).status,401);
  assert.equal((await req(route,{admin:true,method:'DELETE'})).status,200);
  const listing=await(await req('/reviews?product=shop%3Ad1')).json();
  assert.equal(listing.count,2);assert.equal(listing.average,5);assert.ok(!listing.reviews.some((r)=>r.id===photoReview.id));
  assert.equal((await req(photoReview.photos[0].replace('/api/reviews','/reviews'))).status,404);
  assert.equal((await req(`/admin/reviews/${photoReview.id}/photos/photo-1.webp`,{admin:true})).status,404);
  assert.ok(!data().reviews.some((r)=>r.id===photoReview.id));
  assert.ok(!fs.existsSync(path.join(dir,'uploads',`review-${photoReview.id}`)));
  assert.equal((await(await req('/reviews/mine?product=shop%3Ad1',{token:'photo-customer'})).json()).submitted,false);
  assert.equal((await req('/reviews',{body:review(),token:'photo-customer'})).status,201);
  assert.equal((await req(route,{admin:true,method:'PATCH',body:{status:'published'}})).status,400);
  assert.equal((await(await req('/reviews?product=shop%3Ad1')).json()).count,3);
});
test('public pagination exposes no private identity or moderation details and renamed products retain reviews',async()=>{
  data().content.products=[{id:'d1',name:'Renamed product',active:true}];
  const r=await(await req('/reviews?product=shop%3Ad1')).json();assert.equal(r.count,3);
  assert.ok(!JSON.stringify(r).includes('private@example.com'));assert.ok(!JSON.stringify(r).includes('moderation'));assert.ok(!JSON.stringify(r).includes('photo-customer'));
  const empty=await(await req('/reviews?product=shop%3Ad1&page=2')).json();assert.equal(empty.reviews.length,0);
  assert.equal((await req('/reviews?product=shop%3Ad2')).status,404);
});
test('R2-required mode fails closed for photos and failed persistence does not accept a review',async()=>{
  process.env.R2_REQUIRED='true';
  assert.equal((await req('/reviews',{body:review({photos:['data:image/png;base64,YmFk']}),token:'no-storage'})).status,503);
  process.env.R2_REQUIRED='false';
  const count=data().reviews.length;
  const fail=mock.method(fs.promises,'rename',async()=>{throw new Error('Disk unavailable');});
  try {assert.equal((await req('/reviews',{body:review(),token:'no-disk'})).status,500);assert.equal(data().reviews.length,count);}finally{fail.mock.restore();}
});
test('failed deletion persistence preserves the review and photos; old admin clients delete permanently',async()=>{
  const target=data().reviews.find((r)=>r.uid==='photo-customer');
  const fail=mock.method(fs.promises,'rename',async()=>{throw new Error('Disk unavailable');});
  try {
    assert.equal((await req(`/admin/reviews/${target.id}`,{admin:true,method:'DELETE'})).status,500);
    assert.ok(data().reviews.includes(target));assert.equal(target.status,'published');
    assert.equal((await(await req('/reviews/mine?product=shop%3Ad1',{token:'photo-customer'})).json()).submitted,true);
  }finally{fail.mock.restore();}
  assert.equal((await req(`/admin/reviews/${target.id}`,{admin:true,method:'PATCH',body:{status:'removed'}})).status,200);
  assert.ok(!data().reviews.some((r)=>r.id===target.id));
});
test('legacy removed reviews are purged and failed cloud cleanup is retained for retry',async()=>{
  const {purgeRemovedReviews,cleanupReviewPhotos}=await import('../src/reviewDeletion.js');
  data().reviews.push({id:'rv_legacy',uid:'legacy-customer',status:'removed',productKey:'shop:d1',photos:['photo-1.webp'],assetStorage:'r2'});
  await purgeRemovedReviews();
  assert.ok(!data().reviews.some((r)=>r.id==='rv_legacy'));
  assert.equal((await(await req('/reviews/mine?product=shop%3Ad1',{token:'legacy-customer'})).json()).submitted,false);
  assert.ok(data().pendingReviewDeletes.some((j)=>j.id==='rv_legacy'));
  await cleanupReviewPhotos({r2Available:true,remove:async()=>{throw new Error('R2 unavailable');}});
  assert.ok(data().pendingReviewDeletes.some((j)=>j.id==='rv_legacy'));
  const deleted=[];
  await cleanupReviewPhotos({r2Available:true,remove:async(id)=>deleted.push(id)});
  assert.deepEqual(deleted,['review-rv_legacy']);
  assert.ok(!data().pendingReviewDeletes.some((j)=>j.id==='rv_legacy'));
});
test.after(async()=>{await new Promise((resolve)=>server.close(resolve));mock.restoreAll();});
