const {test,expect}=require('./fixtures.cjs');
const ready=page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true',{timeout:15000});
async function waitForActor(page,characterId){
 for(let i=0;i<160;i++){
  const f=await page.evaluate(()=>({input:!!commandResolve,message:!!battleMessageResolve,character:initialParty[actingAlly]?.id,battle:!!state.enemy}));
  if(f.input&&f.character===characterId)return;
  if(!f.battle)throw Error('battle ended before '+characterId);
  if(f.input)await page.locator('[data-action="guard"]').click();
  else if(f.message)await page.locator('#fieldMessage').click();
  else await page.waitForTimeout(10);
 }
 throw Error('input not reached for '+characterId);
}
async function startBattle(page,lv){
 await page.goto('/');await ready(page);
 await page.evaluate(lv=>{
  state.lv=lv;state.hp=maxhp();state.mp=maxmp();allies();state.companions.forEach((c,i)=>{c.hp=allyStats(i+1).maxHP;c.mp=allyStats(i+1).maxMP;});
  startBattle();state.enemies.forEach((e,i)=>Object.assign(e,{name:'試験の敵'+i,atk:0,speed:0,hp:1000,max:1000,def:0}));state.enemy=state.enemies[0];render(false);
 },lv);
}
const popups=page=>page.locator('#enemy .enemy-unit').evaluateAll(nodes=>nodes.map(n=>n.querySelector('.damage-popup')?.textContent??null));

test('通常攻撃で、攻撃した敵の上にだけダメージ数値を表示する',async({page})=>{
 await startBattle(page,1);
 await waitForActor(page,'astel');
 await page.locator('[data-target="1"]').click();
 const before=await page.evaluate(()=>state.enemies.map(e=>e.hp));
 await page.locator('[data-action="attack"]').click();
 await expect(page.locator('#latestLog')).toHaveText('アステルの攻撃！');
 await expect(page.locator('.damage-popup')).toHaveCount(0);
 await page.locator('#fieldMessage').click();
 await expect(page.locator('#latestLog')).toContainText('アステルの攻撃！ 試験の敵1に');
 const dealt=before[1]-await page.evaluate(()=>state.enemies[1].hp);
 expect(dealt).toBeGreaterThan(0);
 expect(await popups(page)).toEqual([null,String(dealt),null,null]);
 const popup=page.locator('[data-target="1"] .damage-popup');
 await expect(popup).toBeVisible();
 await expect(popup).toHaveCSS('opacity','1');
 await page.screenshot({path:test.info().outputPath('single-damage.png')});
 // 数値は敵ユニットの中央付近に重なり、フィールド内に収まる
 const box=await popup.boundingBox(),unit=await page.locator('[data-target="1"]').boundingBox(),field=await page.locator('.arena').boundingBox();
 expect(box.x).toBeGreaterThanOrEqual(unit.x-box.width);expect(box.x+box.width).toBeLessThanOrEqual(unit.x+unit.width+box.width);
 expect(box.y).toBeGreaterThanOrEqual(field.y);
 // 一定時間後に消え、次の再描画で要素も取り除く
 await expect(popup).toHaveCSS('opacity','0',{timeout:3000});
 await page.evaluate(()=>render(false));
 await expect(page.locator('.damage-popup')).toHaveCount(0);
});

test('全体攻撃で、敵ごとのダメージ数値と会心を個別に表示する',async({page})=>{
 await startBattle(page,3);
 await waitForActor(page,'rina');
 await page.locator('[data-action="skills"]').click();
 await page.locator('[data-action="skill:rina_scatter_shot"]').click();
 const before=await page.evaluate(()=>state.enemies.map(e=>e.hp));
 // 1・3体目は会心、2・4体目は通常
 await page.evaluate(()=>{const seq=[0,0,.99,0];let n=0;Math.random=()=>seq[n++%seq.length];});
 await page.locator('#enemy .enemy-unit').nth(0).click();
 await page.locator('#fieldMessage').click();
 await expect(page.locator('#latestLog')).toContainText('敵4体に平均');
 const after=await page.evaluate(()=>state.enemies.map(e=>e.hp)),dealt=before.map((hp,i)=>hp-after[i]);
 expect(await popups(page)).toEqual(dealt.map(String));
 const critical=await page.locator('#enemy .enemy-unit').evaluateAll(nodes=>nodes.map(n=>n.querySelector('.damage-popup').classList.contains('critical')));
 expect(critical).toEqual([true,false,true,false]);
 await expect(page.locator('.damage-popup').first()).toHaveCSS('opacity','1');
 await page.screenshot({path:test.info().outputPath('all-damage.png')});
});
