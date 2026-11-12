import {handleApi} from './api.mjs';
import assets from './assets.generated.mjs';
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request,env);
 const name=url.pathname==='/'?'/index.html':url.pathname==='/admin'||url.pathname==='/admin/'?'/admin/index.html':url.pathname;
 const asset=assets[name];if(!asset)return new Response('Not found',{status:404});if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const bytes=asset.base64?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':asset.type,'cache-control':asset.type.startsWith('image/')?'public, max-age=300':'no-cache','x-content-type-options':'nosniff'}});
}};
