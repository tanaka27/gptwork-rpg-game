import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export function openDatabase(filename=':memory:'){
 if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY,hash TEXT NOT NULL)');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){
  const sql=fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'),hash=crypto.createHash('sha256').update(sql).digest('hex'),existing=sqlite.prepare('SELECT hash FROM local_migrations WHERE name=?').get(file);
  if(existing){if(existing.hash!==hash)throw new Error('適用済みマイグレーションは変更できません: '+file);continue;}
  sqlite.exec('BEGIN');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO local_migrations(name,hash) VALUES (?,?)').run(file,hash);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
 }
 const db={prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},_run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};},async run(){return statement._run();},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};return statement;},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s._run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},close(){sqlite.close();}};return db;
}
