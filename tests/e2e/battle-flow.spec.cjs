const { test, expect } = require('./fixtures.cjs');

const {heroInput:readBattleRound}=require('./party-helpers.cjs');

test('探索から攻撃で敵ターンへ進み、再読込で進行を保持する', async ({ page }) => {
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.locator('[data-action="explore"]').click();await readBattleRound(page);
  await expect(page.locator('[data-action="attack"]')).toBeVisible();
  await page.locator('[data-action="attack"]').click();
  await readBattleRound(page);
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  await expect(page.locator('#turn')).toContainText('2');
  const save = await page.evaluate(() => localStorage.getItem('starlight-rpg-v1'));
  expect(JSON.parse(save).turn).toBe(2);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
  await expect(page.locator('[data-action="attack"]')).toBeVisible();
  await expect(page.locator('#turn')).toContainText('2');
  expect(await page.evaluate(() => localStorage.getItem('starlight-rpg-v1'))).toBe(save);
});

test('4対4で素早さ順に行動し、隊列を保存する', async ({ page }) => {
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.locator('[data-action="explore"]').click();await readBattleRound(page);
  await expect(page.locator('.party-member')).toHaveCount(4);
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  await expect(page.locator('#battleOrder')).toContainText('リナ');
  const units=await page.locator('.enemy-unit').evaluateAll(nodes=>nodes.map(n=>({box:n.getBoundingClientRect().toJSON(),svg:n.querySelector('svg').getBoundingClientRect().toJSON()})));
  for(const u of units) expect(u.svg.width).toBeLessThanOrEqual(u.box.width);
  const message=await page.locator('.field-message').boundingBox();
  for(const u of units) expect(u.box.bottom).toBeLessThanOrEqual(message.y);
  await page.locator('[data-action="guard"]').click();
  await readBattleRound(page);
  await expect(page.locator('[data-action="guard"]')).toBeEnabled();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(saved.lastRoundOrder[0]).toBe('リナ');
  expect(saved.lastRoundOrder.length).toBeGreaterThan(4);
  expect(saved.companions).toHaveLength(3);
  expect(saved.enemies).toHaveLength(4);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
  await expect(page.locator('.enemy-unit')).toHaveCount(4);
  await page.screenshot({path: test.info().outputPath('party-battle.png')});
});

test('敵は背景枠とHP数値なしのバーで表示し、対象に矢印を付ける', async ({ page }) => {
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.locator('[data-action="explore"]').click();await readBattleRound(page);
  await expect(page.locator('#enemy .enemy-hp')).toHaveCount(4);
  for(const style of await page.locator('.enemy-unit').evaluateAll(nodes=>nodes.map(n=>({background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderTopWidth,text:n.innerText})))){
    expect(style.background).toBe('rgba(0, 0, 0, 0)');expect(style.border).toBe('0px');
    expect(style.text).not.toMatch(/HP|速|\d+\s*\//);
  }
  const selected=page.locator('[data-target="2"]');
  await selected.click();
  await expect(selected).toHaveAttribute('aria-pressed','true');
  await expect(selected.locator('.enemy-target-marker')).toBeVisible();
  await expect(page.locator('[data-target="0"] .enemy-target-marker')).toBeHidden();
  const field=await page.locator('.arena').boundingBox();
  const marker=await selected.locator('.enemy-target-marker').boundingBox();
  expect(marker.y).toBeGreaterThanOrEqual(field.y);
  await page.locator('[data-target="0"]').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-target="1"]')).toBeFocused();
  await expect(page.locator('[data-target="1"] .enemy-target-marker')).toBeVisible();
  await expect(selected.locator('.enemy-target-marker')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-target="1"]')).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    save.enemies[1].hp=save.enemies[1].max/2;save.lv=3;save.hp=114;save.mp=28;
    localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
  });
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
  await expect(page.locator('[data-target="1"] .enemy-hp')).toHaveAttribute('aria-valuenow','50');
  expect(await page.locator('[data-target="1"] .enemy-hp i').evaluate(n=>n.style.width)).toBe('50%');
  await page.locator('[data-action="skills"]').click();
  await page.locator('[data-action="skill:flame"]').click();
  await expect(page.locator('#skillDetail')).toBeVisible();
  await expect(page.locator('#enemy .enemy-hp')).toHaveCount(4);
  await page.locator('[data-action="skill-list"]').click();
  await page.setViewportSize({width:320,height:568});
  await expect.poll(()=>page.evaluate(()=>{
    const field=document.querySelector('.arena').getBoundingClientRect();
    const party=document.querySelector('#partyStatus').getBoundingClientRect();
    return [...document.querySelectorAll('.enemy-unit')].every(node=>{
      const box=node.getBoundingClientRect();return box.y>=field.y&&box.bottom<=party.y;
    });
  })).toBe(true);
});

test('戦闘メッセージはクリックするまで進まず、キーボードでも送れる', async ({page})=>{
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.locator('[data-action="explore"]').click();await readBattleRound(page);
  const save=await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'));
  await page.locator('[data-action="attack"]').click();
  await expect(page.locator('#messageNext')).toBeVisible();
  const first=await page.locator('#latestLog').textContent();
  await page.waitForTimeout(600);
  await expect(page.locator('#latestLog')).toHaveText(first);
  await expect(page.locator('[data-action="attack"]')).toBeDisabled();
  expect(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'))).toBe(save);
  await page.locator('#fieldMessage').click();
  await expect(page.locator('#latestLog')).not.toHaveText(first);
  await expect(page.locator('#turn')).toContainText('1');
  const second=await page.locator('#latestLog').textContent();
  await page.locator('#fieldMessage').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#latestLog')).not.toHaveText(second);
  await readBattleRound(page);
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  await expect(page.locator('#messageNext')).toBeHidden();
  await expect(page.locator('#turn')).toContainText('2');
});

test('行動待機で生存中の敵を薄くせず、攻撃を送った時だけ倒れた敵を薄くする', async ({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_FAILED'))errors.push(message.text());});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await expect(page).toHaveTitle('星灯りの旅団 | Starlight Chronicle');
  await expect(page).toHaveURL(new URL('/',testInfo.project.use.baseURL).href);
  await page.locator('[data-action="explore"]').click();await readBattleRound(page);
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    save.enemies.forEach((e,i)=>{e.name='敵'+i;e.hp=i===0?1:1000;e.max=e.hp;e.atk=0;e.def=0;});
    save.enemy=save.enemies[0];localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
  });
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.locator('[data-action="attack"]').click();
  const target=page.locator('[data-target="0"]');
  await expect(target).toHaveCSS('opacity','1');
  await expect(page.locator('#latestLog')).toHaveText('リナの攻撃！');
  for(const enemy of await page.locator('.enemy-unit').all()){
    await expect(enemy).toBeDisabled();
    await expect(enemy).toHaveCSS('opacity','1');
    await expect(enemy).not.toHaveClass(/fallen/);
    await expect(enemy.locator('.enemy-hp')).toHaveAttribute('aria-valuenow','100');
  }
  await page.screenshot({path:test.info().outputPath('before-message-confirmation.png')});
  await page.waitForTimeout(600);
  await expect(target).toHaveCSS('opacity','1');
  await page.locator('#fieldMessage').click();
  await expect(page.locator('#latestLog')).toContainText('敵0に');
  await expect(target).toHaveClass(/fallen/);
  await expect(target).toHaveCSS('opacity','0.4');
  await expect(target.locator('.enemy-hp')).toHaveAttribute('aria-valuenow','0');
  for(const enemy of await page.locator('.enemy-unit:not(.fallen)').all())await expect(enemy).toHaveCSS('opacity','1');
  await page.screenshot({path:test.info().outputPath('after-message-confirmation.png')});
  await page.waitForTimeout(600);
  await expect(page.locator('.enemy-unit.fallen')).toHaveCount(1);
  await page.locator('#fieldMessage').click();
  await expect(page.locator('#latestLog')).toHaveText('敵3の攻撃！');
  for(const enemy of await page.locator('.enemy-unit:not(.fallen)').all())await expect(enemy).toHaveCSS('opacity','1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await readBattleRound(page);
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));Object.assign(save,{lv:3,hp:114,mp:28});save.companions[0].hp=1;localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));});
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
  await readBattleRound(page);await page.locator('[data-action="skills"]').click();
  await page.locator('[data-action="skill:heal"]').click();
  await expect(page.locator('#skillDetail')).toBeVisible();
  for(const enemy of await page.locator('.enemy-unit:not(.fallen)').all()){
    await expect(enemy).toBeDisabled();await expect(enemy).toHaveCSS('opacity','1');
  }
  expect(errors).toEqual([]);
});
