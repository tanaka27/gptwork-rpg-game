import {handleApi} from './api.mjs';
import assets from './assets.generated.mjs';
import {createStaticHandler} from './static-assets.mjs';
const serveAsset=createStaticHandler(assets);
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request,env);
 const name=url.pathname==='/'?'/index.html':url.pathname==='/admin'||url.pathname==='/admin/'?'/admin/index.html':url.pathname;
 return serveAsset(request,name);
}};
