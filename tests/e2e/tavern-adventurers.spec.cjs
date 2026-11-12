const { test, expect } = require('./fixtures.cjs');

test('酒場で街の冒険者詳細を確認し、探索・道中行動tickを保存する', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto('/');
  await expect(page).toHaveTitle('星灯りの旅団 | Starlight Chronicle');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('#screen-adventure')).toBeVisible();

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(saved, {
      node: 'home',
      lastTown: 'home',
      zone: 0,
      village: true,
      journey: null,
      enemy: null,
      adventurerState: AdventurerRules.initialState(GameData.nodes),
    });
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.locator('[data-action="tavern"]').click();
  await expect(page.locator('#tavernTitle')).toHaveText('はじまりの村の酒場');
  await expect(page.locator('[data-tavern-view="adventurers"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tavernAdventurerCount')).toHaveText('34人');
  await expect(page.locator('#tavernAdventurerList .tavern-adventurer')).toHaveCount(34);
  await expect(page.locator('[data-action="tavern-close"]')).toBeInViewport();
  const first = page.locator('#tavernAdventurerList .tavern-adventurer').first();
  const firstName = await first.locator('strong').textContent();
  await page.screenshot({ path: testInfo.outputPath('tavern-adventurer-list.png') });
  await first.click();
  await expect(page.locator('#tavernAdventurerDetail')).toBeVisible();
  const detailControls = await page.evaluate(() => {
    const back = document.querySelector('[data-action="adventurer-back"]').getBoundingClientRect();
    const detail = document.querySelector('#tavernAdventurerDetail').getBoundingClientRect();
    const menu = document.querySelector('#tavernMenu').getBoundingClientRect();
    return {
      backTop: back.top,
      backBottom: back.bottom,
      detailTop: detail.top,
      detailBottom: detail.bottom,
      menuTop: menu.top,
      menuBottom: menu.bottom,
      viewportHeight: innerHeight,
    };
  });
  expect(detailControls.backTop).toBeGreaterThanOrEqual(Math.max(detailControls.detailTop, detailControls.menuTop));
  expect(detailControls.backBottom).toBeLessThanOrEqual(
    Math.min(detailControls.detailBottom, detailControls.menuBottom, detailControls.viewportHeight)
  );
  await expect(page.locator('#tavernAdventurerDetailContent h3')).toHaveText(firstName);
  await expect(page.locator('#tavernAdventurerDetailContent')).toContainText('剣士');
  await expect(page.locator('#tavernAdventurerDetailContent')).toContainText('現在地：はじまりの村');
  for (const stat of ['HP', 'MP', '攻撃', '防御', '賢さ', '運', '速さ'])
    await expect(page.locator('#tavernAdventurerDetailContent')).toContainText(stat);
  await page.screenshot({ path: testInfo.outputPath('tavern-adventurer-detail.png') });
  await page.locator('[data-action="adventurer-back"]').click();
  await expect(page.locator('#tavernAdventurerList')).toBeVisible();
  await expect(first).toBeFocused();

  await page.locator('[data-tavern-view="quests"]').click();
  await expect(page.locator('#tavernQuestView')).toBeVisible();
  await expect(page.locator('#tavernQuests .tavern-quest')).toHaveCount(3);
  await expect(page.locator('#tavernQuests')).toContainText('魔物を累計5体倒す');
  await page.locator('[data-action="tavern-close"]').click();

  // A location change affects only the town's list; it does not share a live world with another save.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    saved.adventurerState.locations.adventurer_001 = 'luna';
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.locator('[data-action="tavern"]').click();
  await expect(page.locator('#tavernAdventurerCount')).toHaveText('33人');
  await expect(page.locator('[data-action="adventurer-detail:adventurer_001"]')).toHaveCount(0);
  await page.locator('[data-action="tavern-close"]').click();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(saved, { node: 'luna', lastTown: 'luna', zone: 1, village: true, cleared: [true, false, false] });
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.locator('[data-action="tavern"]').click();
  await expect(page.locator('#tavernTitle')).toHaveText('月見の街ルナの酒場');
  await expect(page.locator('#tavernAdventurerCount')).toHaveText('34人');
  await page.locator('[data-action="adventurer-detail:adventurer_001"]').click();
  await expect(page.locator('#tavernAdventurerDetailContent')).toContainText('現在地：月見の街ルナ');
  await page.locator('[data-action="tavern-close"]').click();

  // One tick belongs to each successful road step, not route selection or page reload.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(saved, { node: 'meadow', lastTown: 'home', zone: 0, village: false, journey: null, enemy: null });
    saved.adventurerState = AdventurerRules.initialState(GameData.nodes);
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.locator('[data-screen="map"]').click();
  await page.locator('#regions [data-action="move:home"]').click();
  let progress = await page.evaluate(() => ({ tick: state.adventurerState.tick, step: state.journey.step }));
  expect(progress).toEqual({ tick: 0, step: 0 });
  await page.locator('[data-action="travel-next"]').click();
  progress = await page.evaluate(() => ({ tick: state.adventurerState.tick, step: state.journey.step }));
  expect(progress).toEqual({ tick: 1, step: 1 });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect.poll(() => page.evaluate(() => state.adventurerState.tick)).toBe(1);
  await page.locator('[data-action="travel-next"]').click();
  await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('#location')).toHaveText('はじまりの村');
  await expect.poll(() => page.evaluate(() => state.adventurerState.tick)).toBe(3);
  await page.screenshot({ path: testInfo.outputPath('adventurer-tick-after-arrival.png') });
});
