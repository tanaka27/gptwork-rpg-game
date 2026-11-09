const {test,expect}=require('@playwright/test');
async function toInput(page){for(let i=0;i<100&&await page.locator('#messageNext').isVisible();i++)await page.locator('#fieldMessage').click();await expect(page.locator('[data-action="attack"]')).toBeEnabled();}
test('キャラ詳細の補正後攻撃力を上昇は青・下降は赤・通常は元の色で表示する',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,r=>r.abort());await page.addInitScript(()=>{Math.random=()=>.5;});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{state.lv=7;state.hp=maxhp();state.mp=maxmp();allies();state.companions.forEach(c=>c.hp=maxhp());render();});
 await page.locator('[data-action="explore"]').click();await toInput(page);
 await page.evaluate(()=>{state.enemies.forEach(e=>{e.hp=100000;e.max=100000;e.atk=0;});render(false);});
 await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:inspire"]:visible').click();await page.locator('[data-ally-target="0"] img').click();await page.locator('#fieldMessage').click();await toInput(page);
 const baseline=await page.evaluate(()=>JSON.stringify(state));
 await page.locator('[data-battle-character="0"] img').click();
 const attack=page.locator('#modal dd').nth(2);
 await expect(attack).toHaveText('55');await expect(attack).toHaveCSS('color','rgb(119, 186, 255)');await expect(attack).toHaveAttribute('aria-label',/55.*37.*上昇/);
 await expect(page.locator('#modal dd.stat-up')).toHaveCount(1);await expect(page.locator('#modal dd.stat-down')).toHaveCount(0);
 await page.screenshot({path:test.info().outputPath('attack-up-blue.png')});await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(baseline);
 await page.locator('[data-battle-character="1"] img').click();await expect(attack).toHaveText('37');await expect(page.locator('#modal .stat-up,#modal .stat-down')).toHaveCount(0);const normalColor=await attack.evaluate(el=>getComputedStyle(el).color);await page.keyboard.press('Escape');
 await page.locator('[data-screen="party"]').click();await page.locator('[data-character="0"]').click();await expect(page.locator('#partyDetails dd.stat-up')).toHaveText('55');await expect(page.locator('#partyDetails dd.stat-up')).toHaveCSS('color','rgb(119, 186, 255)');
 await page.locator('[data-screen="adventure"]').click();
 // Down effects are not yet game content; substitute only the display getter in this disposable browser.
 await page.evaluate(()=>{window.originalAttackDisplay=allyAttack;allyAttack=i=>i===0?attack()-5:window.originalAttackDisplay(i);});
 await page.locator('[data-battle-character="0"] img').click();
 await expect(attack).toHaveText('32');await expect(attack).toHaveCSS('color','rgb(255, 143, 143)');await expect(attack).toHaveAttribute('aria-label',/32.*37.*下降/);await expect(page.locator('#modal dd.stat-down')).toHaveCount(1);
 await page.screenshot({path:test.info().outputPath('attack-down-red.png')});await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>JSON.stringify(state))).toBe(baseline);
 await page.evaluate(()=>{allyAttack=window.originalAttackDisplay;delete window.originalAttackDisplay;state.buffs=[];render(false);});
 await page.locator('[data-battle-character="0"] img').click();await expect(attack).toHaveText('37');await expect(attack).toHaveCSS('color',normalColor);await expect(page.locator('#modal .stat-up,#modal .stat-down')).toHaveCount(0);
 await page.screenshot({path:test.info().outputPath('attack-normal.png')});expect(errors).toEqual([]);
});
