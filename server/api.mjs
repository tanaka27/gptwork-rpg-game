import contentModule from '../shared/content.js';
import saveModule from '../shared/save.js';
import seed from '../content/game.json' with {type:'json'};
const {validate,categories,withJobs}=contentModule;
const now=()=>new Date().toISOString();
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const check=(condition,status,message)=>{if(!condition)throw new ApiError(status,message);};
async function body(request){check(Number(request.headers.get('content-length')||0)<2_000_000,413,'データが大きすぎます');const text=await request.text();check(text.length<2_000_000,413,'データが大きすぎます');try{return JSON.parse(text);}catch{throw new ApiError(400,'JSONが不正です');}}
async function active(db){const setting=await db.prepare("SELECT value FROM app_settings WHERE key='active_content'").first();if(!setting||setting.value==='bundled')return {id:'bundled',data:seed};const row=await db.prepare("SELECT id,data FROM content_versions WHERE id=? AND status='published'").bind(setting.value).first();check(row,503,'公開データが見つかりません');return {id:row.id,data:JSON.parse(row.data)};}
function authorize(request,env){const id=request.headers.get('oai-authenticated-user-id');check(id,401,'サインインが必要です');const email=request.headers.get('oai-authenticated-user-email');const allowedId=!!env.OWNER_ID&&id===env.OWNER_ID,allowedEmail=!!env.OWNER_EMAIL&&!!email&&email.toLowerCase()===env.OWNER_EMAIL.toLowerCase();check(allowedId||allowedEmail,403,'所有者のみ利用できます');if(!['GET','HEAD'].includes(request.method)){const origin=request.headers.get('origin');check(origin===new URL(request.url).origin,403,'同じサイトから操作してください');}return id;}
export async function handleApi(request,env){
 try{
  check(env.DB,503,'データベースが接続されていません');const owner=authorize(request,env),db=env.DB,url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==='/api/health'&&method==='GET'){await db.prepare('SELECT 1 AS ready').first();return json({ok:true,database:'ready'});}
  if(path==='/api/content'&&method==='GET'){const result=await active(db);return json({...result,data:withJobs(result.data,seed),categories});}
  if(path==='/api/admin/versions'&&method==='GET')return json({versions:[{id:'bundled',label:'初期定義',status:'published',revision:0},...(await db.prepare('SELECT id,label,status,revision,created_at,updated_at FROM content_versions ORDER BY created_at DESC LIMIT 100').all()).results],activeId:(await active(db)).id});
  if(path==='/api/admin/drafts'&&method==='POST'){
   const input=await body(request);const source=input.sourceId&&input.sourceId!=='bundled'?await db.prepare('SELECT data FROM content_versions WHERE id=?').bind(input.sourceId).first():null;
   check(!input.sourceId||input.sourceId==='bundled'||source,404,'複製元がありません');const rawData=source?JSON.parse(source.data):input.data||((await active(db)).data);const data=source||!input.data?withJobs(rawData,seed):rawData;const errors=validate(data);check(!errors.length,422,errors.join('\n'));
   const id=crypto.randomUUID(),stamp=now(),label=String(input.label||'新しい下書き').trim().slice(0,100);check(label,400,'名前を入力してください');
   await db.prepare('INSERT INTO content_versions (id,label,data,status,revision,created_at,updated_at) VALUES (?,?,?,\'draft\',1,?,?)').bind(id,label,JSON.stringify(data),stamp,stamp).run();return json({id,revision:1},201);
  }
  const versionMatch=path.match(/^\/api\/admin\/versions\/([a-zA-Z0-9_-]+)(?:\/(validate|publish))?$/);
  if(versionMatch){
   const [,id,operation]=versionMatch,row=id==='bundled'?{id,label:'初期定義',status:'published',revision:0,data:JSON.stringify(seed)}:await db.prepare('SELECT * FROM content_versions WHERE id=?').bind(id).first();check(row,404,'定義がありません');
   if(method==='GET'&&!operation)return json({...row,data:JSON.parse(row.data)});
   if(method==='POST'&&operation==='validate'){const data=row.status==='published'?withJobs(JSON.parse(row.data),seed):JSON.parse(row.data);return json({errors:validate(data)});}
   if(method==='PUT'&&!operation){const input=await body(request);check(row.status==='draft',409,'公開済みの定義は変更できません。複製して編集してください');const errors=validate(input.data);check(!errors.length,422,errors.join('\n'));check(input.revision===row.revision,409,'別の操作で更新されました。再読み込みしてください');
    const updated=await db.prepare("UPDATE content_versions SET data=?,label=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND status='draft'").bind(JSON.stringify(input.data),String(input.label||row.label).slice(0,100),now(),id,input.revision).run();check(updated.meta.changes===1,409,'更新が競合しました');return json({id,revision:row.revision+1});}
   if(method==='POST'&&operation==='publish'){const input=await body(request);check(input.revision===row.revision,409,'別の操作で更新されました');const errors=validate(JSON.parse(row.data));check(!errors.length,422,errors.join('\n'));
    const runtimeData=withJobs(JSON.parse(row.data),seed),saves=(await db.prepare('SELECT state FROM saves').all()).results;for(const saved of saves){const issues=saveModule.validate(JSON.parse(saved.state),runtimeData);check(!issues.length,422,'既存セーブから参照されています: '+issues.join(', '));}
    if(id==='bundled'){await db.prepare("INSERT INTO app_settings(key,value) VALUES ('active_content','bundled') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();return json({id,published:true});}
    const published=await db.batch([db.prepare("UPDATE content_versions SET status='published',updated_at=? WHERE id=? AND revision=?").bind(now(),id,input.revision),db.prepare("INSERT INTO app_settings(key,value) SELECT 'active_content',id FROM content_versions WHERE id=? AND revision=? AND status='published' ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(id,input.revision)]);check(published[0].meta.changes===1,409,'公開対象が更新されています');return json({id,published:true});}
  }
  if(path==='/api/admin/preview'&&method==='GET'){const row=url.searchParams.get('version')==='bundled'?{id:'bundled',data:seed}:await db.prepare('SELECT id,data FROM content_versions WHERE id=?').bind(url.searchParams.get('version')).first();check(row,404,'プレビュー対象がありません');return json({id:row.id,data:withJobs(typeof row.data==='string'?JSON.parse(row.data):row.data,seed),preview:true});}
  if(path==='/api/admin/export'&&method==='GET'){const row=await active(db);return new Response(JSON.stringify(row.data,null,2),{headers:{'content-type':'application/json','content-disposition':'attachment; filename="game-content.json"','cache-control':'no-store'}});}
  if(path==='/api/save'&&method==='GET'){const row=await db.prepare('SELECT state,revision,updated_at FROM saves WHERE owner_id=?').bind(owner).first();return json(row?{state:JSON.parse(row.state),revision:row.revision,updatedAt:row.updated_at}:{state:null,revision:0});}
  if(path==='/api/save'&&method==='PUT'){
   const input=await body(request),errors=saveModule.validate(input.state,withJobs((await active(db)).data,seed));check(!errors.length,422,errors.join('\n'));check(Number.isSafeInteger(input.revision)&&input.revision>=0,400,'更新番号が不正です');const stamp=now(),serialized=JSON.stringify(input.state);
   let result;if(input.revision===0)result=await db.prepare('INSERT INTO saves(owner_id,state,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(owner_id) DO NOTHING').bind(owner,serialized,stamp).run();
   else{const results=await db.batch([db.prepare('INSERT INTO save_history(id,owner_id,state,revision,created_at) SELECT ?,owner_id,state,revision,? FROM saves WHERE owner_id=? AND revision=?').bind(crypto.randomUUID(),stamp,owner,input.revision),db.prepare('UPDATE saves SET state=?,revision=revision+1,updated_at=? WHERE owner_id=? AND revision=?').bind(serialized,stamp,owner,input.revision)]);result=results[1];}
   check(result.meta.changes===1,409,'クラウドセーブが更新されています。読み直してから選択してください');return json({revision:input.revision+1,updatedAt:stamp});
  }
  if(path==='/api/save/history'&&method==='GET')return json({history:(await db.prepare('SELECT id,revision,created_at FROM save_history WHERE owner_id=? ORDER BY created_at DESC LIMIT 20').bind(owner).all()).results});
  const history=path.match(/^\/api\/save\/history\/([a-zA-Z0-9_-]+)$/);
  if(history&&method==='GET'){const row=await db.prepare('SELECT state,revision,created_at FROM save_history WHERE id=? AND owner_id=?').bind(history[1],owner).first();check(row,404,'バックアップがありません');return json({state:JSON.parse(row.state),revision:row.revision,createdAt:row.created_at});}
  return json({error:'APIが見つかりません'},404);
 }catch(error){if(error instanceof ApiError)return json({error:error.message},error.status);console.error('API failure',error.message);return json({error:'処理に失敗しました。元のデータはそのままです。'},500);}
}
