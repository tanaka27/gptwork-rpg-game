// tests/game/*.test.cjs を順に実行する。1件でも失敗したら非0で終了する。
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.cjs')).sort();
for(const file of files){
 console.log(`# ${file}`);
 execFileSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
}
