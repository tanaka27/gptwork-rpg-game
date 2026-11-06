(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.SaveRules=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
function validate(state,content){
 const errors=[];if(JSON.stringify(state)?.includes('<'))errors.push('セーブにHTMLを含めることはできません');if(!state||typeof state!=='object')return ['セーブが不正です'];
 if(![1,2].includes(state.v))errors.push('未対応のセーブ形式です');
 for(const key of ['lv','xp','hp','mp','gold','turn','total'])if(!Number.isSafeInteger(state[key])||state[key]<(key==='lv'||key==='turn'?1:0))errors.push(key+'が不正です');
 if(state.lv>content.rules.growth.maxLevel)errors.push('レベルが上限を超えています');
 const nodes=new Set(content.nodes.map(e=>e.id)),items=new Set(content.items.map(e=>e.id)),materials=new Set(content.materials.map(e=>e.id));
 if(!nodes.has(state.node)||!nodes.has(state.lastTown))errors.push('位置が不正です');
 for(const key of ['weapon','armor'])if(!content.items.some(e=>e.id===state[key]&&e.type===key))errors.push(key+'が不正です');
 if(!Array.isArray(state.owned)||state.owned.some(id=>!items.has(id)))errors.push('装備リストが不正です');
 for(const [key,ids]of [['items',items],['materials',materials]]){if(!state[key]||typeof state[key]!=='object'||Array.isArray(state[key]))errors.push(key+'が不正です');else for(const [id,n]of Object.entries(state[key]))if(!ids.has(id)||!Number.isSafeInteger(n)||n<0)errors.push(key+'.'+id+'が不正です');}
 for(const key of ['kills','cleared'])if(!Array.isArray(state[key]))errors.push(key+'が不正です');
 if(state.companions&&(!Array.isArray(state.companions)||state.companions.length!==3||state.companions.some(e=>!Number.isSafeInteger(e.hp)||e.hp<0||!Number.isSafeInteger(e.mp)||e.mp<0)))errors.push('仲間の状態が不正です');
 if(!Array.isArray(state.log)||state.log.some(s=>typeof s!=='string'||s.length>2000)||state.log.length>100)errors.push('ログが不正です');
 if(state.journey&&(!nodes.has(state.journey.from)||!nodes.has(state.journey.to)||!Number.isInteger(state.journey.step)||state.journey.step<0||state.journey.step>content.rules.travel.steps))errors.push('道中が不正です');
 if(state.enemies&&(!Array.isArray(state.enemies)||state.enemies.length>16||state.enemies.some(e=>!e||!Number.isFinite(e.hp)||e.hp<0||!Number.isFinite(e.max)||e.max<e.hp||typeof e.name!=='string')))errors.push('敵の状態が不正です');
 return errors;
}
return {validate};
});
