// Workerの素材配信：ETagでの304、キャッシュ方針、HEAD・404・405、base64の復号を1回にすること。
import test from 'node:test';
import assert from 'node:assert/strict';
import {createStaticHandler,etagMatches,imageCacheControl,documentCacheControl} from '../../server/static-assets.mjs';

const png=Buffer.from([1,2,3,4]);
const assets={
 '/index.html':{type:'text/html; charset=utf-8',body:'<!doctype html>',etag:'"html-1"'},
 '/assets/a.png':{type:'image/webp',base64:true,body:png.toString('base64'),etag:'"img-1"'},
 '/old.js':{type:'text/javascript; charset=utf-8',body:'1'},
};
const serve=createStaticHandler(assets);
const get=(name,headers={},method='GET')=>serve(new Request('https://example.test'+name,{method,headers}),name);

test('ETag and cache policy per asset type',async()=>{
 const image=await get('/assets/a.png');
 assert.equal(image.status,200);assert.equal(image.headers.get('etag'),'"img-1"');
 assert.equal(image.headers.get('cache-control'),imageCacheControl);
 assert.deepEqual([...new Uint8Array(await image.arrayBuffer())],[...png]);
 const html=await get('/index.html');
 assert.equal(html.headers.get('cache-control'),documentCacheControl);assert.equal(html.headers.get('etag'),'"html-1"');
 assert.equal(await html.text(),'<!doctype html>');
});

test('matching If-None-Match returns 304 without a body and keeps the validators',async()=>{
 for(const header of ['"img-1"','W/"img-1"','"other", "img-1"','*']){
  const response=await get('/assets/a.png',{'if-none-match':header});
  assert.equal(response.status,304,header);assert.equal(response.headers.get('etag'),'"img-1"');
  assert.equal(response.headers.get('cache-control'),imageCacheControl);assert.equal((await response.arrayBuffer()).byteLength,0);
 }
 const changed=await get('/assets/a.png',{'if-none-match':'"img-0"'});
 assert.equal(changed.status,200);assert.equal((await changed.arrayBuffer()).byteLength,4);
 const head=await get('/index.html',{'if-none-match':'"html-1"'},'HEAD');assert.equal(head.status,304);
});

test('assets without an ETag never return 304; HEAD, 404 and 405 are unchanged',async()=>{
 const old=await get('/old.js',{'if-none-match':'*'});
 assert.equal(old.status,200);assert.equal(old.headers.get('etag'),null);
 const head=await get('/assets/a.png',{},'HEAD');
 assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'image/webp');assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await get('/missing.png')).status,404);
 assert.equal((await get('/index.html',{},'POST')).status,405);
 assert.equal(etagMatches('',"x"),false);assert.equal(etagMatches('"a"',undefined),false);
});

test('base64 assets are decoded once and reused',async()=>{
 const original=globalThis.atob;let calls=0;globalThis.atob=value=>{calls++;return original(value);};
 try{const fresh=createStaticHandler(assets);for(let i=0;i<3;i++)await fresh(new Request('https://example.test/assets/a.png'),'/assets/a.png').arrayBuffer();}
 finally{globalThis.atob=original;}
 assert.equal(calls,1);
});
