const {test,expect}=require('./fixtures.cjs');
const collectErrors=page=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});return errors;};
const ready=page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true',{timeout:15000});

async function waitForActor(page,characterId){
 for(let i=0;i<160;i++){
  const flags=await page.evaluate(()=>({input:!!commandResolve,message:!!battleMessageResolve,actor:actingAlly,character:initialParty[actingAlly]?.id,battle:!!state.enemy}));
  if(flags.input&&flags.character===characterId)return;
  if(!flags.battle)return;
  if(flags.input)await page.locator('[data-action="guard"]').click();
  else if(flags.message)await page.locator('#fieldMessage').click();
  else await page.waitForTimeout(10);
 }
 throw Error('input not reached for '+characterId);
}

test('仲間一覧と個別詳細にジョブ・固有特技・習得状態を表示する',async({page})=>{
 const errors=collectErrors(page);
 await page.goto('/');await ready(page);
 await page.evaluate(()=>{state.lv=3;allies();render();});
 await page.locator('[data-screen="party"]').click();
 const expected=[['アステル','星剣士',['火花の魔法','星のいやし','流星斬り','星光の魔法','鼓舞']],['リナ','弓使い',['ねらい撃ち','彗星の矢']],['ガルド','戦士',['気合い','渾身斬り']],['ノエル','僧侶',['祈りの光','聖なる光']]];
 await expect(page.locator('[data-character]')).toHaveCount(4);
 for(let i=0;i<4;i++)await expect(page.locator(`[data-character="${i}"]`)).toContainText(expected[i][1]);
 await page.screenshot({path:test.info().outputPath('party-jobs-list.png')});
 for(let i=0;i<expected.length;i++){
  await page.locator(`[data-character="${i}"]`).click();
  const detail=page.locator('#partyDetails .character-card');await expect(detail).toContainText(expected[i][1]);
  for(const skill of expected[i][2])await expect(detail).toContainText(skill);
  await expect(detail).toContainText('習得済み');
  if(i===0)await page.screenshot({path:test.info().outputPath('astel-job-skills.png')});
  if(i===1){await expect(detail).toContainText('Lv.5で習得');await page.screenshot({path:test.info().outputPath('rina-job-skills.png')});}
  if(i===2)await expect(detail).toContainText('自分の攻撃力');
  await page.locator('#backToParty').click();
 }
 expect(errors).toEqual([]);
});

test('各行動者の技だけを出し、ガルドの気合いを本人に適用する',async({page})=>{
 const errors=collectErrors(page);
 await page.addInitScript(()=>{Math.random=()=>.99;});
 await page.goto('/');await ready(page);
 await page.evaluate(()=>{
  state.lv=3;state.mp=24;state.hp=maxhp();allies();state.companions.forEach(c=>{c.hp=allyStats(1).maxHP;c.mp=20;});
  startBattle();state.enemies.forEach(e=>Object.assign(e,{name:'試験の敵',hp:1000,max:1000,atk:0,def:0,speed:0}));state.enemy=state.enemies[0];render(false);
 });
 await waitForActor(page,'gald');
 await page.locator('[data-battle-character="2"]').click();await expect(page.locator('#modal')).toContainText('戦士');
 await expect(page.locator('#modal')).toContainText('気合い');await page.screenshot({path:test.info().outputPath('gald-battle-status.png')});
 await page.locator('#closeModal').click();
 await page.locator('[data-action="skills"]').click();
 await expect(page.locator('.skill-list button')).toHaveCount(1);
 await expect(page.locator('[data-action="skill:gald_kiai"]')).toBeVisible();
 expect(await page.evaluate(()=>useSkill('flame'))).toBe(false);
 await page.locator('[data-action="skill:gald_kiai"]').click();
 await expect(page.locator('#skillDetail')).toContainText('自分の状態欄');
 await expect(page.locator('[data-ally-target="0"]')).toBeDisabled();
 await expect(page.locator('[data-ally-target="1"]')).toBeDisabled();
 await expect(page.locator('[data-ally-target="2"]')).toBeEnabled();
 await expect(page.locator('[data-ally-target="3"]')).toBeDisabled();
 const mp=await page.evaluate(()=>state.companions[1].mp);
 expect(await page.evaluate(()=>castPendingSkill(1,'ally'))).toBe(false,'self-only buff rejects a different recipient');
 await page.locator('[data-ally-target="2"]').click();
 await expect(page.locator('#latestLog')).toHaveText('ガルドの気合い！');
 expect(await page.evaluate(()=>state.companions[1].mp)).toBe(mp,'skill waits for the manual confirmation');
 await page.locator('#fieldMessage').click();
 expect(await page.evaluate(()=>state.companions[1].mp)).toBe(mp-3);
 expect(await page.evaluate(()=>state.buffs.some(b=>b.characterId==='gald'&&b.skillId==='gald_kiai'))).toBe(true);
 expect(await page.locator('#partyStatus .party-member').nth(2).locator('.buff-icon').getAttribute('aria-label')).toContain('気合い');
 expect(errors).toEqual([]);
});

test('旧battleContentを補完して再読込後も進行と技能を保ち、補完済みsnapshotを再保存する',async({page})=>{
 const errors=collectErrors(page);
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{
  const save=JSON.parse(localStorage.getItem('starlight-rpg-v1')),legacy=structuredClone(GameData);
  legacy.skills=legacy.skills.filter(skill=>['flame','heal','slash','nova','inspire'].includes(skill.id));
  legacy.characters.forEach(character=>delete character.job);legacy.skills.forEach(skill=>delete skill.characterId);
  const oldRarity={common:'normal',uncommon:'rare',rare:'epic',legendary:'legend'};legacy.items.filter(item=>item.category==='gear').forEach(item=>item.rarity=oldRarity[item.rarity]);
  Object.assign(save,{lv:3,xp:17,total:6,gold:77,turn:2,enemy:{name:'継続中の敵',hp:1000,max:1000,atk:0,def:0,speed:0},battleContent:legacy,buffs:[{characterId:'astel',skillId:'inspire',remainingTurns:2,appliedTurn:1}]});
  save.companions=[{characterId:'rina',hp:64,mp:24},{characterId:'gald',hp:100,mp:12},{characterId:'noel',hp:68,mp:32}];
  localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
 });
 await page.reload();await ready(page);
 expect(await page.evaluate(()=>[state.lv,state.xp,state.total,state.gold])).toEqual([3,17,6,77]);
 expect(await page.evaluate(()=>[GameData.characters.map(c=>c.job),state.battleContent.characters.map(c=>c.job),state.battleContent.skills.length])).toEqual([
  ['星剣士','弓使い','戦士','僧侶'],['星剣士','弓使い','戦士','僧侶'],11,
 ]);
 expect(await page.evaluate(()=>state.battleContent.items.filter(item=>item.category==='gear').map(item=>item.rarity))).toEqual(['common','common','common','common','common','common','uncommon','uncommon','rare','legendary']);
 await waitForActor(page,'rina');await page.locator('[data-action="skills"]').click();
 await expect(page.locator('[data-action="skill:rina_aimed_shot"]')).toBeVisible();
 await expect(page.locator('[data-action="skill:flame"]')).toHaveCount(0);
 await page.locator('[data-action="skill-back"]').click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).battleContent.skills.some(s=>s.id==='gald_kiai'))).toBe(true);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).total)).toBe(6);
 expect(errors).toEqual([]);
});

test('狭い縦画面と横画面でもジョブ詳細・戦闘状態を画面幅に収める',async({page})=>{
 const errors=collectErrors(page);
 for(const size of [{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(size);await page.goto('/');await ready(page);
  await page.locator('[data-screen="party"]').click();await expect(page.locator('#characterList')).toContainText('弓使い');
  const suffix=`${size.width}x${size.height}`;
  await page.screenshot({path:test.info().outputPath(`party-list-${suffix}.png`)});
  await page.locator('[data-character="3"]').click();await expect(page.locator('#partyDetails')).toContainText('僧侶');
  await page.screenshot({path:test.info().outputPath(`noel-detail-${suffix}.png`)});
  const target=page.locator('#partyDetails .character-skill').nth(1);await target.scrollIntoViewIfNeeded();
  const targetBox=await target.boundingBox(),navBox=await page.locator('.screen-nav').boundingBox();
  expect(targetBox.y+targetBox.height).toBeLessThanOrEqual(navBox.y,`Noel's lower skill is obscured by navigation at ${suffix}`);
  await page.screenshot({path:test.info().outputPath(`noel-skill-reached-${suffix}.png`)});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`party layout overflows at ${suffix}`).toBe(true);
 }
 await page.setViewportSize({width:844,height:390});await page.locator('[data-screen="adventure"]').click();await page.evaluate(()=>startBattle());await waitForActor(page,'gald');
 await page.locator('[data-battle-character="2"]').click();await expect(page.locator('#modal')).toContainText('戦士');
 await page.screenshot({path:test.info().outputPath('gald-status-844x390.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 expect(errors).toEqual([]);
});
