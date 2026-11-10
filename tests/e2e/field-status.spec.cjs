const {test,expect}=require('@playwright/test');
test('探索・道中・街の味方ステータスと回復対象選択を両立する',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,r=>r.abort());
 await page.addInitScript(()=>{Math.random=()=>.99;});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();state.companions[2].hp=0;render();});
 const names=['アステル','リナ','ガルド','ノエル'];
 async function inspect(location){
  const baseline=await page.evaluate(()=>({state:JSON.stringify(state),save:localStorage.getItem('starlight-rpg-v1')}));
  for(let i=0;i<4;i++){
   const trigger=page.locator(`[data-battle-character="${i}"]`);
   const expected=await page.evaluate(i=>{const a=allies()[i];return [`${allyHP(i)} / ${allyStats(i).maxHP}`,`${a.mp} / ${allyStats(i).maxMP}`,allyAttack(i),allyStats(i).defense,allyStats(i).wisdom,speedOf(i),allyStats(i).luck,gear[GameRules.memberState(state,GameData,i).weapon].name,gear[GameRules.memberState(state,GameData,i).armor].name].map(String);},i);
   if(i===0){await trigger.focus();await page.keyboard.press('Enter');}
   else if(i===1)await trigger.locator('strong').first().click();
   else if(i===2)await trigger.locator('.meter-head').first().click();
   else await trigger.locator('img').click();
   await expect(page.locator('#modal')).toBeVisible();
   await expect(page.locator('#battleCharacterName')).toHaveText(names[i]);
   await expect(page.locator('#modal dd')).toHaveText(expected);
   if(i===3)await expect(page.locator('#modal')).toContainText('戦闘不能');
   if(i===0)await page.screenshot({path:test.info().outputPath(`field-status-${location}.png`)});
   if(i%2)await page.keyboard.press('Escape');else await page.locator('#closeModal').click();
   await expect(trigger).toBeFocused();
   expect(await page.evaluate(()=>({state:JSON.stringify(state),save:localStorage.getItem('starlight-rpg-v1')}))).toEqual(baseline);
  }
 }
 await inspect('exploration');
 await page.evaluate(()=>{state.companions[0].hp=1;render();});
 await page.locator('[data-action="items"]').click();await page.locator('[data-action="use:herb"]:visible').click();
 await expect(page.locator('[data-battle-character]')).toHaveCount(0);
 await page.locator('[data-ally-target="1"] img').click();
 await expect(page.locator('#modal')).not.toBeVisible();expect(await page.evaluate(()=>state.companions[0].hp)).toBe(46);
 await page.locator('[data-action="skill-back"]').click();
 await expect(page.locator('[data-battle-character]')).toHaveCount(4);
 await page.locator('[data-screen="bag"]').click();await page.locator('[data-tab="skills"]').click();
 await page.locator('[data-action="skill:heal"]:visible').click();
 await page.locator('[data-action="skill-list"]').click();await expect(page.locator('[data-battle-character]')).toHaveCount(0);
 await page.locator('[data-action="skill:heal"]:visible').click();
 await page.locator('[data-ally-target="1"] img').click();
 await expect(page.locator('#modal')).not.toBeVisible();
 expect(await page.evaluate(()=>state.companions[0].hp)).toBeGreaterThan(46);
 await expect(page.locator('[data-battle-character]')).toHaveCount(4);
 await page.locator('[data-battle-character="1"] img').click();await expect(page.locator('#modal')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.locator('[data-screen="map"]').click();
 await page.locator('#regions [data-action="move:home"]').click();
 await expect(page.locator('[data-action="travel-next"]')).toBeVisible();
 await inspect('journey');
 for(let i=0;i<3;i++)await page.locator('[data-action="travel-next"]').click();
 expect(await page.evaluate(()=>state.village)).toBe(true);
 await inspect('town');
expect(errors).toEqual([]);
});

test('敵が消えた後の勝利報酬待ちでは味方クリックで送り、終了後に詳細を開く',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,r=>r.abort());
 await page.addInitScript(()=>{Math.random=()=>0;});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{state.lv=30;state.hp=maxhp();state.mp=maxmp();allies();state.companions.forEach(c=>c.hp=maxhp());render();});
 await page.locator('[data-action="explore"]').click();
 await page.evaluate(()=>{state.enemies.forEach(e=>{e.hp=1;e.atk=0;});render(false);});
 for(let i=0;i<100;i++){
  const flags=await page.evaluate(()=>({enemy:!!state.enemy,waiting:!!battleMessageResolve,input:!!commandResolve}));
  if(!flags.enemy&&flags.waiting)break;
  if(flags.input)await page.locator('[data-action="attack"]').click();
  else await page.locator('#partyStatus img').first().click();
 }
 expect(await page.evaluate(()=>!!state.enemy)).toBe(false);
 await expect(page.locator('#messageNext')).toBeVisible();
 await expect(page.locator('[data-battle-character]')).toHaveCount(0);
 const message=await page.locator('#latestLog').textContent();
 await page.locator('#partyStatus img').first().click();
 await expect(page.locator('#latestLog')).not.toHaveText(message);
 await expect(page.locator('#modal')).not.toBeVisible();
 for(let i=0;i<40&&await page.locator('#messageNext').isVisible();i++)await page.locator('#partyStatus img').first().click();
 await expect(page.locator('[data-battle-character]')).toHaveCount(4);
 await page.locator('[data-battle-character="0"] img').click();await expect(page.locator('#modal')).toBeVisible();
 expect(errors).toEqual([]);
});
