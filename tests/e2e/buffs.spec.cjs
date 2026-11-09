const {test,expect}=require('@playwright/test');
async function setup(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,r=>r.abort());
 await page.addInitScript(()=>{Math.random=()=>.5;});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();state.companions.forEach(c=>{c.hp=maxhp();c.mp=maxmp();});render();});
 return errors;
}
async function toInput(page){for(let i=0;i<100&&await page.locator('#messageNext').isVisible();i++)await page.locator('#fieldMessage').click();await expect(page.locator('[data-action="attack"]')).toBeEnabled();}
async function cast(page,index){await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:inspire"]:visible').click();await page.locator(`[data-ally-target="${index}"] img`).click();}
test('鼓舞の対象・開始確認・アイコン・詳細・再使用・3ターン解除と保存再開',async({page})=>{
 test.setTimeout(120000);
 const errors=await setup(page);
 // Field use is disabled and processing rejects it without spending MP.
 await page.locator('[data-screen="bag"]').click();await page.locator('[data-tab="skills"]').click();await expect(page.locator('[data-action="skill:inspire"]:visible')).toBeDisabled();
 expect(await page.evaluate(()=>{const mp=state.mp;return useSkill('inspire',0)===false&&state.mp===mp;})).toBe(true);
 await page.locator('[data-screen="adventure"]').click();await page.locator('[data-action="explore"]').click();await toInput(page);
 await page.evaluate(()=>{state.enemies.forEach(e=>{e.hp=100000;e.max=100000;e.atk=0;});render(false);});
 const before=await page.evaluate(()=>({mp:state.mp,attack:attack()}));
 await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:inspire"]:visible').click();
 await expect(page.locator('#skillDetail')).toContainText('攻撃力を1.5倍');await expect(page.locator('#partyStatus')).toBeVisible();
 await page.locator('[data-action="skill-list"]').click();await page.locator('[data-action="skill-back"]').click();
 expect(await page.evaluate(()=>state.mp)).toBe(before.mp);
 await cast(page,0);
 expect(await page.evaluate(()=>({mp:state.mp,buffs:state.buffs.length}))).toEqual({mp:before.mp,buffs:0});
 await page.locator('#fieldMessage').click();
 await expect(page.locator('#partyStatus .buff-icon')).toHaveCount(1);
 await expect(page.locator('#partyStatus .buff-icon')).toHaveAttribute('aria-label',/鼓舞.*1.5.*残り3ターン/);
 expect(await page.evaluate(()=>state.mp)).toBe(before.mp-4);
 await toInput(page);
 await page.locator('[data-battle-character="0"] img').click();
 await expect(page.locator('#modal .buff-details')).toContainText('残り3ターン');await expect(page.locator('#modal dd').nth(2)).toHaveText(String(Math.floor(before.attack*1.5)));
 await page.screenshot({path:test.info().outputPath('buff-popup.png')});await page.keyboard.press('Escape');
 await page.locator('[data-screen="party"]').click();await page.locator('[data-character="0"]').click();await expect(page.locator('#partyDetails .buff-details')).toContainText('攻撃力1.5倍');
 await page.locator('[data-screen="adventure"]').click();
 const viewport=page.viewportSize();
 for(const size of [viewport,{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(size);
  const rects=await page.locator('#partyStatus .party-member').first().evaluate(el=>({card:el.getBoundingClientRect().toJSON(),icon:el.querySelector('.buff-icon').getBoundingClientRect().toJSON(),portrait:el.querySelector('img').getBoundingClientRect().toJSON()}));
  expect(rects.icon.x).toBeGreaterThanOrEqual(rects.card.x);expect(rects.icon.right).toBeLessThanOrEqual(rects.card.right);expect(rects.icon.y).toBeLessThanOrEqual(rects.portrait.y+10);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.screenshot({path:test.info().outputPath(`buff-icon-${size.width}.png`)});
 }
 await page.setViewportSize(viewport);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await toInput(page);
 expect(await page.evaluate(()=>state.buffs[0].remainingTurns)).toBe(3);
 await cast(page,0);await page.locator('#fieldMessage').click();await toInput(page);
 expect(await page.evaluate(()=>state.buffs.length)).toBe(1);expect(await page.evaluate(()=>state.buffs[0].remainingTurns)).toBe(3);
 for(const remaining of [2,1,0]){await page.locator('[data-action="guard"]').click();await toInput(page);expect(await page.evaluate(()=>state.buffs[0]?.remainingTurns||0)).toBe(remaining);}
 await expect(page.locator('#partyStatus .buff-icon')).toHaveCount(0);
 expect(await page.evaluate(()=>state.log.some(t=>t.includes('鼓舞の効果が切れた')))).toBe(true);
 expect(errors).toEqual([]);
});
