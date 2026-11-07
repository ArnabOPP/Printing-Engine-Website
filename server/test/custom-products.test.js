import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { buildCatalog, discounted, variantKey, visibleCatalog } from '../../shared/customCatalog.js';
import { customQuote, repeatCount } from '../../shared/customQuote.js';
import { garmentFor } from '../../shared/garments.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-products-test-'));
Object.assign(process.env, { DATA_DIR:dir, ADMIN_AUTH_PROVIDER:'local', JWT_SECRET:'product-tests-secret-with-at-least-32-characters', DELHIVERY_TOKEN:'', R2_BUCKET:'', R2_REQUIRED:'false' });
const { data, save } = await import('../src/store.js');
const { default: adminRouter } = await import('../src/routes/admin.js');
const { ordersRouter, catalogRouter } = await import('../src/routes/public.js');
const { cleanCustomProduct } = await import('../src/customProducts.js');
const { prepareCustomOrder } = await import('../src/inventory.js');
data().admins.push({ id:'owner',name:'Owner',email:'owner@example.com',role:'owner',tokenVersion:0 });
const cookie = `pe_admin=${jwt.sign({sub:'owner',tv:0},process.env.JWT_SECRET)}`;
const app = express();
app.use(express.json({limit:'12mb'}),cookieParser());
app.use('/admin',adminRouter); app.use('/orders',ordersRouter); app.use('/catalog',catalogRouter);
app.use((err,req,res,next) => res.status(err.status || 500).json({error:err.message}));
const server = app.listen(0,'127.0.0.1');
await new Promise((resolve) => server.once('listening',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const clone = (v) => JSON.parse(JSON.stringify(v));
async function request(route,body,method = body === undefined ? 'GET' : 'POST',auth = true) {
  return fetch(base+route,{ method,headers:{'Content-Type':'application/json',...(auth ? {Cookie:cookie,'X-Admin-Request':'1'} : {})},body:body === undefined ? undefined : JSON.stringify(body) });
}
async function products() { return (await request('/admin/custom-products')).json(); }
function product(slug = 'test-custom-tee') {
  const p = clone(buildCatalog().find((g) => g.id === 't-shirts').items[0]);
  return { ...p,slug,name:slug,sku:slug.toUpperCase(),status:'active',available:true,minQty:1,maxQty:5,stockTracked:true,
    colors:[{name:'white',hex:'#ffffff',available:true}], variants:[{colour:'white',material:'Pure cotton',size:'L',stock:1}],
    discount:{enabled:true,type:'percent',value:20,stackable:true},mockups:{photos:garmentFor(p).photos,areas:garmentFor(p).areas,tint:true} };
}
async function write(p, revision) {
  const current = revision ?? (await products()).revision;
  return request(`/admin/custom-products/${p.slug}`,{product:p,revision:current},'PUT');
}
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ZkAAAAASUVORK5CYII=';
const design = {front:[{id:'shape',type:'shape',shape:{kind:'rect',fill:'#000000'},x:50,y:50,w:20,rot:0}],back:[],left:[],right:[],mode:'normal',mockups:{front:png}};
function orderBody(p, overrides = {}) {
  const cfg={product:p.name,productSlug:p.slug,material:'Pure cotton',colour:'white',audience:'unisex',sizes:{L:1},quantity:1,method:'dtf',mockupVersion:p.updatedAt};
  return {customer:{name:'Test Customer',phone:'9876543210',email:'test@example.com',line1:'123 Test Street',city:'Kolkata',state:'West Bengal',pin:'700001'},payment:'cod',items:[{name:p.name,slug:p.slug,designId:'design',qty:1,unit:customQuote(p,cfg,design).perPiece,config:cfg}],designs:{design:clone(design)},...overrides};
}

test('custom product manager is protected, validates input, and detects stale saves', async () => {
  assert.equal((await request('/admin/custom-products',undefined,'GET',false)).status,401);
  const p=product();
  assert.equal((await write({...p,minQty:8,maxQty:2})).status,400);
  const revision=(await products()).revision;
  const saved=await write(p,revision);
  assert.equal(saved.status,200,await saved.clone().text());
  assert.equal((await write(p,revision)).status,409);
  assert.equal((await request(`/admin/custom-products/${p.slug}`,{product:p,revision:(await products()).revision,create:true},'PUT')).status,409);
  assert.equal((await write({...p,sheets:'invalid'})).status,400);
  assert.equal((await write({...product('other-tee'),sku:p.sku})).status,400);
});

test('draft, archived and scheduled launches are hidden until their launch time', async () => {
  const draft={...product('future-tee'),status:'draft',description:'PRIVATE DRAFT DESCRIPTION'};
  assert.equal((await write(draft)).status,200);
  const c=data().catalog;
  assert.ok(!visibleCatalog(c).flatMap((g) => g.items).some((p) => p.slug === draft.slug));
  const publicData=await (await request('/catalog')).json();
  assert.ok(!JSON.stringify(publicData.productEntries['future-tee']).includes('PRIVATE DRAFT DESCRIPTION'));
  const scheduled=cleanCustomProduct({...draft,status:'scheduled',launchAt:'2099-01-01T00:00:00Z'},draft.slug,c);
  const config={...c,productEntries:{...c.productEntries,[draft.slug]:scheduled}};
  assert.ok(!visibleCatalog(config,Date.parse('2098-01-01')).flatMap((g) => g.items).some((p) => p.slug === draft.slug));
  assert.ok(visibleCatalog(config,Date.parse('2099-01-02')).flatMap((g) => g.items).some((p) => p.slug === draft.slug));
});

test('product discounts obey dates, caps and deterministic browser/server quotes', () => {
  assert.equal(discounted(100,{enabled:true,type:'percent',value:20}),80);
  assert.equal(discounted(100,{enabled:true,type:'flat',value:200}),0);
  assert.equal(discounted(100,{enabled:true,type:'percent',value:20,startsAt:'2099-01-01'}),100);
  assert.equal(discounted(100,{enabled:true,type:'percent',value:20,endsAt:'2000-01-01'}),100);
  const p=product();const cfg=orderBody(p).items[0].config;
  const q=customQuote(p,cfg,design);
  assert.equal(q.perPiece,Math.round(q.originalPerPiece*0.8*100)/100);
  assert.ok(q.saving>0);
  assert.equal(repeatCount({type:'shape',w:20,x:10,y:10,rot:0,repeat:true,gap:0},{w:254,h:254}),25);
});

test('checkout refuses disabled colours, hidden products, changed prices and mismatched size totals', async () => {
  let p=(await products()).groups.flatMap((g) => g.items).find((p) => p.slug === 'test-custom-tee');
  const stale=orderBody(p);stale.items[0].unit=1;
  assert.equal((await request('/orders',stale)).status,409);
  const mismatched=orderBody(p);mismatched.items[0].qty=2;
  assert.equal((await request('/orders',mismatched)).status,409);
  const badColour=orderBody(p);badColour.items[0].config.colour='red';
  assert.equal((await request('/orders',badColour)).status,409);
  const hidden=orderBody(p);hidden.items[0].slug='future-tee';
  assert.equal((await request('/orders',hidden)).status,409);
});

test('concurrent orders cannot oversell the last variant; cancellation restores stock exactly once', async () => {
  const p=(await products()).groups.flatMap((g) => g.items).find((p) => p.slug === 'test-custom-tee');
  const body=orderBody(p);
  const responses=await Promise.all([request('/orders',body),request('/orders',body)]);
  assert.deepEqual(responses.map((r) => r.status).sort(),[201,409]);
  const key=variantKey('white','Pure cotton','L');
  assert.equal(data().catalog.stock[p.slug][key],0);
  const o=data().orders[0];
  assert.equal(o.items[0].originalUnit,customQuote(p,body.items[0].config,design).originalPerPiece);
  assert.equal(o.items[0].sku,p.sku);
  assert.equal((await request(`/admin/orders/${o.id}`,{status:'cancelled'},'PATCH')).status,200);
  assert.equal(data().catalog.stock[p.slug][key],1);
  await request(`/admin/orders/${o.id}`,{status:'cancelled'},'PATCH');
  assert.equal(data().catalog.stock[p.slug][key],1);
  assert.equal((await request(`/admin/orders/${o.id}`,{status:'placed'},'PATCH')).status,400);
});

test('product offers can disallow coupon stacking and invalid print areas or stock variants are rejected', () => {
  const c=data().catalog;
  const p=product('test-custom-tee');
  assert.throws(() => cleanCustomProduct({...p,mockups:{areas:{front:{left:90,top:0,width:30,height:100}}}},p.slug,c),/fit/);
  assert.throws(() => cleanCustomProduct({...p,variants:[{colour:'white',material:'Pure cotton',size:'INVALID',stock:1}]},p.slug,c),/size/);
  const saved=c.productEntries[p.slug];
  saved.discount.stackable=false;
  try {
    const live=buildCatalog(c).flatMap((g) => g.items).find((p) => p.slug === saved.slug);
    const body=orderBody(live);
    assert.throws(() => prepareCustomOrder(body.items,body.designs,'SAVE10'),/cannot be combined/);
  } finally {saved.discount.stackable=true;}
});

test('catalogue mockup images use a permanent public prefix without exposing order artwork', async () => {
  const upload=await request('/admin/custom-products/media',{data:png});
  assert.equal(upload.status,201);
  const media=await upload.json();
  assert.match(media.url,/^\/api\/catalog\/media\/catalog-/);
  const response=await request(media.url.replace('/api/catalog','/catalog'),undefined,'GET',false);
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/image\/png/);
  assert.equal((await request('/admin/custom-products/media',{data:'data:image/png;base64,dGVzdA=='})).status,400);
  assert.equal((await request('/catalog/media/secret.png',undefined,'GET',false)).status,404);
});

test('global price updates preserve individual products and their stock ledger', async () => {
  const before=clone(data().catalog.stock);
  const result=await request('/admin/catalog',{catalog:{dtf:{normalPerSqIn:2,fullPerSqIn:3}}},'PUT');
  assert.equal(result.status,200);
  assert.deepEqual(data().catalog.stock,before);
  assert.ok(data().catalog.productEntries['test-custom-tee']);
});

test.after(async () => {
  await save();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));
  fs.rmSync(dir,{recursive:true,force:true});
});
