import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
import {fileURLToPath} from 'node:url';import {handleApi} from './api.mjs';import {openDatabase} from './local-db.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url)),port=Number(process.env.PORT||4173),db=openDatabase(process.env.RPG_DB_PATH||'.local/rpg.sqlite');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:'+port);
 if(url.pathname.startsWith('/api/')){
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>2_000_000){res.writeHead(413);res.end('Too large');return;}chunks.push(chunk);}
  // Development-only identity: server binds loopback and production Worker never uses this adapter.
  const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-owner');
  const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await handleApi(request,{DB:db,OWNER_ID:'local-owner'});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 const pathname=url.pathname==='/'?'/index.html':url.pathname==='/admin'||url.pathname==='/admin/'?'/admin/index.html':decodeURIComponent(url.pathname);
 const target=path.resolve(root,'.'+pathname);if(!target.startsWith(root)){res.writeHead(403);res.end();return;}
 const data=await fs.readFile(target);res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream','cache-control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(error.code==='ENOENT'?'Not found':'Server error');if(error.code!=='ENOENT')console.error(error);}
});server.listen(port,'127.0.0.1',()=>console.log('RPG + SQLite http://127.0.0.1:'+port));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
