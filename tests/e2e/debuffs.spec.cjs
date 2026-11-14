const {test,expect}=require('./fixtures.cjs');
const collectErrors=page=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});return errors;};
const ready=page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true',{timeout:15000});
// 指定の人物の入力待ちまで、他の人物は防御・メッセージは送って進める。
async function waitForActor(page,characterId){
 for(let i=0;i<200;i++){
  const flags=await page.evaluate(()=>({input:!!commandResolve,message:!!battleMessageResolve,character:initialParty[actingAlly]?.id,battle:!!state.enemy}));
  if(flags.input&&flags.character===characterId)return;
  if(!flags.battle)throw Error('battle ended before '+characterId);
  if(flags.input)await page.locator('[data-action="guard"]').click();
  else if(flags.message)await page.locator('#fieldMessage').click();
  else await page.waitForTimeout(10);
 }
 throw Error('input not reached for '+characterId);
}
async function startBattleAt(page,level){
 await page.addInitScript(()=>{Math.random=()=>.5;});
 await page.goto('/');await ready(page);
 await page.evaluate(level=>{state.lv=level;state.hp=maxhp();state.mp=maxmp();allies();state.companions.forEach((c,i)=>{c.hp=allyStats(i+1).maxHP;c.mp=allyStats(i+1).maxMP;});render();},level);
 await page.locator('[data-action="explore"]').click();
 await page.evaluate(()=>{state.enemies.forEach(e=>{e.hp=100000;e.max=100000;e.atk=0;e.actions=[];});render(false);});
}
async function layoutCheck(page,name,selector){
 const viewport=page.viewportSize();
 for(const size of [viewport,{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(size);
  const boxes=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>({unit:n.getBoundingClientRect().toJSON(),icons:n.querySelector('.status-icons').getBoundingClientRect().toJSON()})));
  expect(boxes.length).toBeGreaterThan(0);
  for(const box of boxes){expect(box.icons.width).toBeGreaterThan(0);expect(box.icons.x).toBeGreaterThanOrEqual(0);expect(box.icons.right).toBeLessThanOrEqual(size.width);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`${name}-${size.width}.png`)});
 }
 await page.setViewportSize(viewport);
}

test('影縫いの矢：開始確認・敵のアイコン・守備力低下・再読み込み・3ターンで解除',async({page})=>{
 test.setTimeout(120000);
 const errors=collectErrors(page);
 await startBattleAt(page,3);
 await waitForActor(page,'rina');
 const mp=await page.evaluate(()=>allyMP(1));
 await page.locator('[data-action="skills"]').click();
 await expect(page.locator('[data-action="skill:rina_pinning_arrow"]')).toContainText('弱体');
 await page.locator('[data-action="skill:rina_pinning_arrow"]').click();
 await expect(page.locator('#skillDetail')).toContainText('敵1体の守備力を0.5倍に下げる');
 await expect(page.locator('#skillDetail')).toContainText('どの敵の能力を下げますか');
 await page.locator('#enemy .enemy-unit').nth(2).click();
 expect(await page.evaluate(()=>({mp:allyMP(1),debuffs:state.debuffs.length}))).toEqual({mp,debuffs:0});
 await page.locator('#fieldMessage').click();
 await expect(page.locator('#latestLog')).toContainText('守備力が0.5倍に下がった（3ターン）');
 const icon=page.locator('#enemy .enemy-unit').nth(2).locator('.debuff-icon');
 await expect(icon).toHaveCount(1);await expect(icon).toHaveAttribute('aria-label',/影縫いの矢.*守備力0.5倍.*残り3ターン/);
 await expect(page.locator('#enemy .debuff-icon')).toHaveCount(1);
 expect(await page.evaluate(()=>allyMP(1))).toBe(mp-3);
 expect(await page.evaluate(()=>GameRules.enemyDefense(state,GameData,2)===Math.floor(state.enemies[2].def*.5))).toBe(true);
 await layoutCheck(page,'enemy-debuff','#enemy .enemy-unit:has(.status-icons)');
 // Reload mid-battle keeps the record and the badge.
 await waitForActor(page,'rina');
 await page.reload();await ready(page);
 await expect(page.locator('#enemy .enemy-unit').nth(2).locator('.debuff-icon')).toHaveCount(1);
 // The application round does not count down; each later round end does.
 expect(await page.evaluate(()=>state.debuffs[0].remainingTurns)).toBe(3);
 for(const remaining of [2,1,0]){await page.locator('[data-action="guard"]').click();await waitForActor(page,'rina');expect(await page.evaluate(()=>state.debuffs.length?state.debuffs[0].remainingTurns:0)).toBe(remaining);}
 await expect(page.locator('#enemy .debuff-icon')).toHaveCount(0);
 expect(await page.evaluate(()=>state.log.some(t=>t.includes('の守備力が元に戻った。')))).toBe(true);
 expect(errors).toEqual([]);
});

test('星砕き：敵全体に対象マーク・1回のMP・全員にアイコン',async({page})=>{
 const errors=collectErrors(page);
 await startBattleAt(page,6);
 await waitForActor(page,'astel');
 const mp=await page.evaluate(()=>state.mp);
 await page.locator('[data-action="skills"]').click();
 await expect(page.locator('[data-action="skill:astel_star_break"]')).toContainText('弱体・全体');
 await page.locator('[data-action="skill:astel_star_break"]').click();
 await expect(page.locator('#skillDetail')).toContainText('敵全体に効きます');
 await expect(page.locator('#enemy .enemy-unit[aria-pressed="true"]')).toHaveCount(4);
 await page.locator('#enemy .enemy-unit').nth(1).click();
 await page.locator('#fieldMessage').click();
 await expect(page.locator('#latestLog')).toContainText('敵4体の守備力が0.7倍に下がった（3ターン）');
 await expect(page.locator('#enemy .debuff-icon.defenseDown')).toHaveCount(4);
 expect(await page.evaluate(()=>state.mp)).toBe(mp-7);
 await page.screenshot({path:test.info().outputPath('all-enemy-debuff.png')});
 expect(errors).toEqual([]);
});

test('魔物の行動で味方全体の守備力が下がり、状態欄・詳細・強化との併記を表示する',async({page})=>{
 test.setTimeout(120000);
 const errors=collectErrors(page);
 await startBattleAt(page,7);
 await page.evaluate(()=>{state.enemies[0].actions=[{id:'moonshadow_pressure',name:'月影の重圧',rate:1,target:'allAllies',effects:[{type:'defenseDown',multiplier:.75,turns:2}]}];render(false);});
 // Everyone guards through round 1; the first enemy uses its action instead of attacking.
 await waitForActor(page,'astel');await page.locator('[data-action="guard"]').click();
 await waitForActor(page,'astel');
 expect(await page.evaluate(()=>state.log.some(t=>t.includes('の月影の重圧！')))).toBe(true);
 expect(await page.evaluate(()=>state.log.some(t=>t.includes('味方4人の守備力が0.75倍に下がった（2ターン）')))).toBe(true);
 await expect(page.locator('#partyStatus .debuff-icon.defenseDown')).toHaveCount(4);
 await expect(page.locator('#partyStatus .debuff-icon').first()).toHaveAttribute('aria-label',/月影の重圧.*守備力0.75倍.*残り2ターン/);
 await page.evaluate(()=>{GameRules.applyAttackBuff(state,GameData,0,skillList.find(s=>s.id==='inspire'));render(false);});
 await expect(page.locator('#partyStatus .party-member').first().locator('.buff-icon')).toHaveCount(1);
 await layoutCheck(page,'ally-debuff','#partyStatus .party-member');
 await page.locator('[data-battle-character="0"] img').click();
 await expect(page.locator('#modal .debuff-details')).toContainText('月影の重圧');
 await expect(page.locator('#modal .debuff-details')).toContainText('守備力0.75倍');
 const defense=await page.evaluate(()=>({now:allyDefense(0),base:allyStats(0).defense}));
 expect(defense.now).toBe(Math.floor(defense.base*.75));
 await expect(page.locator('#modal dd.stat-down')).toHaveText(String(defense.now));
 await page.screenshot({path:test.info().outputPath('ally-debuff-detail.png')});
 await page.keyboard.press('Escape');
 // Round 2 reapplies (rate 1). Round 3 is a strong-attack turn, so the action is skipped and nothing refreshes it.
 await page.locator('[data-action="guard"]').click();await waitForActor(page,'astel');
 expect(await page.evaluate(()=>[state.turn,state.debuffs.filter(d=>d.side==='ally').map(d=>d.remainingTurns)])).toEqual([3,[2,2,2,2]]);
 await page.locator('[data-action="guard"]').click();await waitForActor(page,'astel');
 expect(await page.evaluate(()=>[state.turn,state.debuffs.filter(d=>d.side==='ally').map(d=>d.remainingTurns)])).toEqual([4,[1,1,1,1]]);
 expect(errors).toEqual([]);
});
