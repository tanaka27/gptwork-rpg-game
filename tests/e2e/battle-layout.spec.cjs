const {test,expect}=require('@playwright/test');

async function toInput(page){
 for(let i=0;i<100&&await page.locator('#messageNext').isVisible();i++)await page.locator('#fieldMessage').click();
 await expect(page.locator('[data-action="attack"]')).toBeEnabled();
}
async function setup(page){
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,r=>r.abort());
 await page.addInitScript(()=>{Math.random=()=>0;});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await expect(page).toHaveTitle('星灯りの旅団 | Starlight Chronicle');
 await expect(page).toHaveURL('http://127.0.0.1:4173/');
 await page.evaluate(()=>{state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();state.companions.forEach(c=>{c.hp=maxhp();c.mp=maxmp();});render();});
 await page.locator('[data-action="explore"]').click();await toInput(page);
 await page.evaluate(()=>{state.enemies.forEach(e=>{e.hp=1000;e.max=1000;e.atk=0;});state.companions[0].hp=1;render(false);});
 return errors;
}
async function insideViewport(page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 for(const selector of ['.command','.screen-nav','#skillMenu:not([hidden])']){
  if(!await page.locator(selector).count())continue;
  const box=await page.locator(selector).boundingBox(),v=page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(v.width+1);expect(box.y+box.height).toBeLessThanOrEqual(v.height+1);
 }
}
test('参考配置で戦闘コマンド・2列の特技・敵対象選択を操作する',async({page})=>{
 const errors=await setup(page);
 const before=await page.evaluate(()=>[state.mp,state.turn]);
 const party=await page.locator('#partyStatus').boundingBox(),commands=await page.locator('#actions').boundingBox();
 expect(party.y+party.height).toBeLessThanOrEqual(commands.y);
 const buttons=await page.locator('#actions button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));
 expect(new Set(buttons).size).toBe(1);
 await expect(page.locator('.arena #partyStatus .party-member')).toHaveCount(4);
 await expect(page.locator('.party-member.acting')).toContainText('アステル');
 for(const bar of await page.locator('.enemy-hp').all())await expect(bar).toBeVisible();
 await insideViewport(page);await page.screenshot({path:test.info().outputPath('battle-commands.png')});
 await page.locator('[data-action="skills"]').click();
 const skills=await page.locator('.skill-list button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
 expect(skills[0].y).toBe(skills[1].y);expect(skills[0].x).toBe(skills[2].x);
 await expect(page.locator('#partyStatus')).toBeVisible();
 await insideViewport(page);await page.screenshot({path:test.info().outputPath('battle-skills.png')});
 await page.locator('[data-action="skill:flame"]').click();
 await expect(page.locator('#partyStatus')).toBeHidden();
 await expect(page.locator('#skillDetail')).toContainText('消費MP 4');
 await expect(page.locator('#skillDetail')).toContainText('だれにつかいますか');
 for(const bar of await page.locator('.enemy-hp').all())await expect(bar).toBeVisible();
 await insideViewport(page);await page.screenshot({path:test.info().outputPath('battle-target.png')});
 await page.locator('[data-action="skill-list"]').click();
 expect(await page.evaluate(()=>[state.mp,state.turn])).toEqual(before);
 await page.locator('[data-action="skill:flame"]').click();
 await page.locator('[data-target="2"]').click();
 expect(await page.evaluate(()=>state.mp)).toBe(before[0]);
 const announcement=await page.locator('#latestLog').textContent();
 await page.locator('.party-member').first().click();
 await expect(page.locator('#latestLog')).toHaveText(announcement);
 await page.locator('#fieldMessage').click();
 expect(await page.evaluate(()=>state.mp)).toBe(before[0]-4);
 expect(await page.evaluate(()=>state.enemies[2].hp)).toBeLessThan(1000);
 await toInput(page);
 await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:heal"]').click();
 await expect(page.locator('#partyStatus')).toBeVisible();
 await page.locator('[data-ally-target="1"]').focus();await page.keyboard.press('Enter');
 await page.locator('#fieldMessage').click();
 expect(await page.evaluate(()=>state.companions[0].hp)).toBeGreaterThan(1);
 await insideViewport(page);expect(errors).toEqual([]);
});

test('小さい縦画面と横画面で特技・戻る・HPバーが収まる',async({page})=>{
 const errors=await setup(page);
 for(const viewport of [{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  await page.locator('[data-action="skills"]').click();
  await insideViewport(page);
  await page.screenshot({path:test.info().outputPath(`battle-skills-${viewport.width}.png`)});
  await page.locator('[data-action="skill:flame"]').click();await insideViewport(page);
  for(const bar of await page.locator('.enemy-hp').all())await expect(bar).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`battle-target-${viewport.width}.png`)});
  await page.locator('[data-action="skill-list"]').click();await page.locator('[data-action="skill-back"]').click();
  await expect(page.locator('#partyStatus')).toBeVisible();await insideViewport(page);
 }
 expect(errors).toEqual([]);
});
