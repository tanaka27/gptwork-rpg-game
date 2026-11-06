const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
if(!fs.existsSync('build/server/index.js'))throw new Error('先にnpm run buildを実行してください');
const blocks=[];
function octal(header,value,start,length){header.write(value.toString(8).padStart(length-1,'0')+'\0',start,length,'ascii');}
function add(directory,prefix){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name),name=prefix+'/'+entry.name;if(entry.isDirectory()){add(file,name);continue;}if(!entry.isFile())throw new Error('通常ファイル以外はパッケージ化できません');
 if(Buffer.byteLength(name)>100)throw new Error('アーカイブのパスが長すぎます: '+name);
 const data=fs.readFileSync(file),header=Buffer.alloc(512);header.write(name,0,100,'utf8');octal(header,0o644,100,8);octal(header,0,108,8);octal(header,0,116,8);octal(header,data.length,124,12);octal(header,0,136,12);header.fill(32,148,156);header.write('0',156);header.write('ustar\0',257,6,'ascii');header.write('00',263,2,'ascii');const checksum=header.reduce((sum,b)=>sum+b,0);header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');blocks.push(header,data,Buffer.alloc((512-data.length%512)%512));
}}
add('build/.openai','.openai');add('build/server','dist/server');add('build/drizzle','drizzle');blocks.push(Buffer.alloc(1024));fs.mkdirSync('work',{recursive:true});const archive=path.resolve('work/site.tar.gz');fs.writeFileSync(archive,zlib.gzipSync(Buffer.concat(blocks)));console.log(archive);
