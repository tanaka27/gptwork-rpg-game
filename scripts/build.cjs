const fs=require('node:fs'),path=require('node:path');const {buildSync}=require('esbuild');require('./sync-content.cjs');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png'};
const assets={};function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else{const ext=path.extname(file),data=fs.readFileSync(file);assets['/'+path.relative('dist',file).split(path.sep).join('/')]=ext==='.png'?{type:mime[ext],base64:true,body:data.toString('base64')}:{type:mime[ext]||'application/octet-stream',body:data.toString('utf8')};}}}
walk('dist');fs.writeFileSync('server/assets.generated.mjs','export default '+JSON.stringify(assets)+';');
fs.rmSync('build',{recursive:true,force:true});fs.mkdirSync('build/.openai',{recursive:true});
buildSync({entryPoints:['server/worker.mjs'],outfile:'build/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
fs.copyFileSync('.openai/hosting.json','build/.openai/hosting.json');fs.cpSync('drizzle','build/drizzle',{recursive:true});
console.log('Worker bundle: '+fs.statSync('build/server/index.js').size+' bytes; '+Object.keys(assets).length+' embedded assets');
