const { test, expect } = require('./fixtures.cjs');

const {heroInput:readBattleRound}=require('./party-helpers.cjs');

test('スキル一覧・詳細から上部の味方や敵をクリックして発動する', async ({ page }) => {
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(save,{lv:3,hp:114,mp:28});save.companions[0].hp=1;save.companions[1].hp=0;
    localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
  });
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
  await page.locator('[data-screen="bag"]').click();await page.locator('[data-tab="skills"]').click();
  await page.locator('[data-action="skill:heal"]').click();
  await expect(page.locator('#screen-adventure')).toBeVisible();
  await expect(page.locator('#skillDetail')).toContainText('星のいやし');
  await expect(page.locator('#actions')).toBeHidden();
  await expect(page.locator('[data-ally-target="0"]')).toBeDisabled();
  await expect(page.locator('[data-ally-target="1"]')).toBeEnabled();
  await expect(page.locator('[data-ally-target="2"]')).toBeDisabled();
  await page.locator('[data-action="skill-list"]').click();
  await expect(page.locator('.skill-list')).toBeVisible();
  await page.locator('[data-action="skill-back"]').click();
  await expect(page.locator('#actions')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).mp)).toBe(28);
  await page.locator('[data-screen="bag"]').click();
  await page.locator('[data-action="skill:heal"]').click();await page.locator('[data-ally-target="1"]').click();
  await expect(page.locator('#skillMenu')).toBeHidden();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(saved.companions[0].hp).toBe(53);expect(saved.hp).toBe(114);expect(saved.mp).toBe(23);
  await page.locator('[data-action="explore"]').click();await readBattleRound(page);
  await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    save.enemies.forEach((e,i)=>{e.name='対象'+i;e.hp=1000;e.max=1000;e.atk=0;});save.enemy=save.enemies[0];
    localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));
  });
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);
  await page.locator('[data-action="skills"]').click();
  await expect(page.locator('#actions')).toBeHidden();await expect(page.locator('.skill-list')).toBeVisible();
  await page.locator('[data-action="skill-back"]').click();await expect(page.locator('[data-action="attack"]')).toBeVisible();
  await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill:flame"]').click();
  await expect(page.locator('#skillDetail')).toContainText('消費MP 4');
  await expect(page.locator('#skillDetail')).toContainText('フィールドの敵');
  await expect(page.locator('#skillTargetDialog')).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).mp)).toBe(23);
  await page.locator('[data-target="2"]').click();await readBattleRound(page);
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(saved.enemies[0].hp).toBeLessThan(1000);expect(saved.enemies[2].hp).toBeLessThan(1000);
  expect(saved.mp).toBe(19);expect(saved.turn).toBe(2);
});

test('横向きでもスキル一覧・詳細と戻るが画面内に収まる', async ({ page }) => {
  await page.setViewportSize({width:844,height:390});await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('starlight-rpg-v1'));Object.assign(save,{lv:7,hp:182,mp:44});save.companions[0].hp=1;localStorage.setItem('starlight-rpg-v1',JSON.stringify(save));});
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');await readBattleRound(page);await page.locator('[data-action="explore"]').click();await readBattleRound(page);await page.locator('[data-action="skills"]').click();
  await expect(page.locator('.skill-list button')).toHaveCount(5);
  for(const selector of ['#skillMenu','[data-action="skill-back"]']){
    const b=await page.locator(selector).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(844);expect(b.y+b.height).toBeLessThanOrEqual(390);
  }
  await page.locator('[data-action="skill:heal"]').click();await expect(page.locator('#skillDetail')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#actions')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')).mp)).toBe(44);
});
