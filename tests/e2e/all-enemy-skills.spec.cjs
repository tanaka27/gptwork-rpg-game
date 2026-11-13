const {test,expect}=require('./fixtures.cjs');
const ready=page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true',{timeout:15000});
// 指定した人物のコマンド入力まで、他の味方は防御・メッセージは送りで進める
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
async function startBattle(page,lv,enemy){
 await page.goto('/');await ready(page);
 await page.evaluate(([lv,enemy])=>{
  state.lv=lv;state.hp=maxhp();state.mp=maxmp();allies();state.companions.forEach((c,i)=>{c.hp=allyStats(i+1).maxHP;c.mp=allyStats(i+1).maxMP;});
  startBattle();state.enemies.forEach((e,i)=>Object.assign(e,{name:'試験の敵'+i,atk:0,speed:0},enemy));state.enemy=state.enemies[0];render(false);
 },[lv,enemy]);
}

test('物理の全体攻撃：詳細で敵全員にマークを出し、敵ごとに会心を判定して平均ダメージを表示する',async({page})=>{
 await startBattle(page,3,{hp:1000,max:1000,def:0});
 await waitForActor(page,'rina');
 await page.locator('[data-action="skills"]').click();
 await expect(page.locator('[data-action="skill:rina_scatter_shot"]')).toContainText('物理・全体');
 await page.locator('[data-action="skill:rina_scatter_shot"]').click();
 const detail=page.locator('#skillDetail');
 await expect(detail).toContainText('物理・全体 · 敵全体に矢をばらまく物理攻撃（威力70%）');
 await expect(detail).toContainText('敵全体に当たります。フィールドの敵をどれか選んでください。');
 await expect(page.locator('#enemy')).toHaveClass(/all-targets/);
 const units=page.locator('#enemy .enemy-unit');await expect(units).toHaveCount(4);
 for(let i=0;i<4;i++){await expect(units.nth(i)).toHaveAttribute('aria-pressed','true');await expect(units.nth(i).locator('.enemy-target-marker')).toBeVisible();}
 // ホバー中も他の敵のマークを消さない
 await units.nth(0).hover();await expect(units.nth(3).locator('.enemy-target-marker')).toBeVisible();
 await expect(units.nth(1)).toHaveAccessibleName('敵全体にばらまき撃ちを使う（試験の敵1）');
 await page.screenshot({path:test.info().outputPath('all-targets.png')});
 const before=await page.evaluate(()=>({hp:state.enemies.map(e=>e.hp),mp:state.companions[0].mp,crit:Math.min(.5,allyStats(1).luck/512)}));
 expect(before.crit).toBeGreaterThan(0);
 // 1・3体目は会心、2・4体目は通常になる乱数列（rは0）
 await page.evaluate(()=>{const seq=[0,0,.99,0];let n=0;Math.random=()=>seq[n++%seq.length];});
 await units.nth(2).click();
 await expect(page.locator('#latestLog')).toHaveText('リナのばらまき撃ち！');
 expect(await page.evaluate(()=>state.companions[0].mp)).toBe(before.mp);
 await page.locator('#fieldMessage').click();
 const after=await page.evaluate(()=>({hp:state.enemies.map(e=>e.hp),mp:state.companions[0].mp}));
 const dealt=before.hp.map((hp,i)=>hp-after.hp[i]);
 expect(dealt.every(d=>d>0)).toBe(true);
 expect(dealt[0]).toBeGreaterThan(dealt[1]);expect(dealt[2]).toBeGreaterThan(dealt[3]);
 expect(after.mp).toBe(before.mp-4);
 const average=Math.round(dealt.reduce((a,b)=>a+b,0)/4);
 await expect(page.locator('#latestLog')).toHaveText(`リナのばらまき撃ち！ 会心の一撃×2！ 敵4体に平均${average}のダメージ。`);
 await page.screenshot({path:test.info().outputPath('all-result.png')});
});

test('魔法の全体攻撃で敵が全滅したら残りの行動を飛ばして勝利する',async({page})=>{
 await startBattle(page,4,{hp:5,max:5,def:0});
 await page.evaluate(()=>{state.enemies[3].hp=0;render(false);});
 await waitForActor(page,'astel');
 await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:astel_ember_shower"]').click();
 await expect(page.locator('#skillDetail')).toContainText('魔法・全体 · 敵全体に火の粉を降らせる魔法。賢さ参照・守備力の影響なし');
 await expect(page.locator('#enemy .enemy-unit').nth(3)).toBeDisabled();
 await expect(page.locator('#enemy .enemy-unit').nth(3)).toHaveAttribute('aria-pressed','false');
 const mp=await page.evaluate(()=>state.mp),wisdom=await page.evaluate(()=>allyStats(0).wisdom);
 await page.locator('#enemy .enemy-unit').nth(0).click();
 await expect(page.locator('#latestLog')).toHaveText('アステルの火の粉！');
 // 選んだ敵が反映前に倒れていても、生存中の敵がいれば見送らない
 await page.evaluate(()=>{state.enemies[0].hp=0;});
 await page.locator('#fieldMessage').click();
 await expect(page.locator('#latestLog')).toHaveText(`アステルの火の粉！ 敵2体に平均${Math.floor(5+wisdom*.8)}のダメージ。`);
 expect(await page.evaluate(()=>state.enemies.every(e=>e.hp<=0))).toBe(true);
 expect(await page.evaluate(()=>state.mp)).toBe(mp-5);
 for(let i=0;i<20&&await page.evaluate(()=>!!battleMessageResolve);i++)await page.locator('#fieldMessage').click();
 await expect.poll(()=>page.evaluate(()=>({enemy:state.enemy,busy}))).toEqual({enemy:null,busy:false});
 // アステルより遅いガルドは、全滅後に行動しない
 const order=await page.evaluate(()=>state.lastRoundOrder);expect(order.at(-1)).toBe('アステル');expect(order).not.toContain('ガルド');
 expect(await page.evaluate(()=>roundOrder().findIndex(a=>a.name==='ガルド')>roundOrder().findIndex(a=>a.name==='アステル'))).toBe(true);
});

test('仲間詳細に全体攻撃の特技と習得Lvを表示する',async({page})=>{
 await page.goto('/');await ready(page);
 await page.evaluate(()=>{state.lv=3;allies();render();});
 await page.locator('[data-screen="party"]').click();
 const expected=[[0,'火の粉','Lv.4で習得','敵全体に魔法攻撃（5 + 賢さ × 0.8）'],[1,'ばらまき撃ち','習得済み','敵全体に物理攻撃（威力70%）'],[2,'なぎ払い','Lv.4で習得','敵全体に物理攻撃（威力60%）'],[3,'光の粒','Lv.4で習得','敵全体に魔法攻撃（3 + 賢さ × 0.5）']];
 for(const [i,name,status,text] of expected){
  await page.locator(`[data-character="${i}"]`).click();
  const skill=page.locator('#partyDetails .character-skill').filter({hasText:name});
  await expect(skill).toContainText(status);await expect(skill).toContainText(text);
  if(i===1)await page.screenshot({path:test.info().outputPath('rina-detail.png')});
  await page.locator('#backToParty').click();
 }
});
