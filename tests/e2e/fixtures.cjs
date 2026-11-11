const {test:base,expect}=require('@playwright/test');

const blockedFontUrl='https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Serif+JP:wght@500;600;700&display=swap';
const contextRules=new WeakMap();

function allowExpectedRequestFailure(page,url){
 const rules=contextRules.get(page.context());
 if(!rules)throw new Error('Browser diagnostics fixture is not active for this page');
 rules.expectedRequestFailures.add(new URL(url,rules.baseURL).href);
}

const test=base.extend({
 browserDiagnostics:[async({context},use,testInfo)=>{
  const baseURL=testInfo.project.use.baseURL;
  if(!baseURL)throw new Error(`Project ${testInfo.project.name} needs a baseURL`);
  const appOrigin=new URL(baseURL).origin;
  const errors=[];
  const expectedBlockedUrls=new Set();
  const failedRequests=new Set();
  const rules={baseURL,expectedRequestFailures:new Set(),failedRequests};
  contextRules.set(context,rules);

  await context.route('**/*',async route=>{
   const url=route.request().url();
   let origin='';
   try{origin=new URL(url).origin;}catch{}
   if(origin===appOrigin){await route.continue();return;}
   expectedBlockedUrls.add(url);
   await route.abort();
  });
  context.on('requestfailed',request=>failedRequests.add(request.url()));
  const watchPage=page=>{
   page.on('pageerror',error=>errors.push({type:'pageerror',message:error.message,stack:error.stack||''}));
   page.on('console',message=>{
    if(message.type()!=='error')return;
    const url=message.location().url;
    const knownFontAbort=message.text()==='Failed to load resource: net::ERR_FAILED'&&url===blockedFontUrl&&expectedBlockedUrls.has(url);
    const explicitAbort=message.text()==='Failed to load resource: net::ERR_FAILED'&&rules.expectedRequestFailures.has(url)&&failedRequests.has(url);
    if(!knownFontAbort&&!explicitAbort)errors.push({type:'console.error',message:message.text(),url});
   });
  };
  context.pages().forEach(watchPage);
  context.on('page',watchPage);

  await use(context);

  context.off('page',watchPage);
  contextRules.delete(context);
  if(errors.length){
   await testInfo.attach('browser-errors.json',{body:Buffer.from(JSON.stringify(errors,null,2)),contentType:'application/json'});
  }
  expect(errors,`Unexpected browser errors in ${testInfo.project.name}`).toEqual([]);
 },{auto:true}],
});

module.exports={test,expect,allowExpectedRequestFailure};
