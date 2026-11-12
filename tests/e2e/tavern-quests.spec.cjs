const { test, expect } = require('./fixtures.cjs');

async function winCurrentBattle(page) {
  for (let i = 0; i < 400; i++) {
    const flags = await page.evaluate(() => ({
      enemy: !!state.enemy,
      input: !!commandResolve,
      message: !!battleMessageResolve,
      done: !state.enemy && !busy && !roundActive,
    }));
    if (flags.done) return;
    if (flags.input) await page.locator('[data-action="attack"]').click();
    else if (flags.message) await page.locator('#fieldMessage').click();
    else await page.waitForTimeout(10);
  }
  throw new Error('battle did not finish through player actions');
}

test('街の酒場で依頼を受注・報告し、状態を保存して各街で利用する', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(saved, {
      node: 'home',
      lastTown: 'home',
      zone: 0,
      village: true,
      total: 0,
      gold: 30,
      claimed: false,
      lv: 30,
      weapon: 'starlight_blade',
      armor: 'starward_armor',
    });
    saved.owned = [...new Set([...saved.owned, 'starlight_blade', 'starward_armor'])];
    saved.companions?.forEach(companion =>
      Object.assign(companion, { weapon: 'starlight_blade', armor: 'starward_armor' })
    );
    delete saved.questState;
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await expect(page.locator('[data-action="claim"]')).toHaveCount(0);
  await expect(page.locator('[data-action="tavern"]')).toBeVisible();
  await page.locator('[data-action="tavern"]').click();
  await expect(page.locator('#tavernMenu')).toBeVisible();
  await expect(page.locator('#tavernTitle')).toHaveText('はじまりの村の酒場');
  await page.locator('[data-tavern-view="quests"]').click();
  await expect(page.locator('#tavernQuests .tavern-quest')).toHaveCount(3);
  await expect(page.locator('#tavernQuests')).toContainText('魔物を累計5体倒す');
  await expect(page.locator('#tavernQuests')).toContainText('受注後に魔物を3体倒す');
  await expect(page.locator('#tavernQuests')).toContainText('生命の霊薬 2個');
  await expect(page.locator('[data-action="tavern-close"]')).toBeInViewport();
  await expect(page.locator('[data-tavern-view="quests"]')).toBeFocused();
  const dimensions = await page.evaluate(() => {
    const menu = document.querySelector('#tavernMenu').getBoundingClientRect();
    const close = document.querySelector('[data-action="tavern-close"]').getBoundingClientRect();
    const list = document.querySelector('#tavernQuests');
    return {
      menuTop: menu.top,
      menuRight: menu.right,
      closeTop: close.top,
      closeRight: close.right,
      closeWidth: close.width,
      closeHeight: close.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      listWidth: list.scrollWidth,
      listClientWidth: list.clientWidth,
    };
  });
  expect(dimensions.menuRight).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.closeTop).toBeCloseTo(dimensions.menuTop, 0);
  expect(dimensions.closeRight).toBeCloseTo(dimensions.menuRight, 0);
  expect(dimensions.closeWidth).toBeGreaterThanOrEqual(44);
  expect(dimensions.closeHeight).toBeGreaterThanOrEqual(44);
  expect(dimensions.closeTop).toBeGreaterThanOrEqual(0);
  expect(dimensions.listWidth).toBeLessThanOrEqual(dimensions.listClientWidth);

  await page.locator('[data-action="quest-accept:apprentice_hunt"]').click();
  await expect(page.locator('#tavernQuests')).toContainText('受注中 · 0 / 3体');
  await page.locator('[data-action="tavern-close"]').click();
  await expect(page.locator('[data-action="tavern"]')).toBeFocused();
  await page.locator('[data-screen="map"]').click();
  await page.locator('#regions [data-action="move:meadow"]').click();
  for (let step = 0; step < 3; step++) await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('#location')).toHaveText('風そよぐ草原');
  await page.locator('[data-action="explore"]').click();
  await winCurrentBattle(page);
  await expect.poll(() => page.evaluate(() => state.total)).toBe(4);
  await page.locator('[data-screen="map"]').click();
  await page.locator('#regions [data-action="move:home"]').click();
  for (let step = 0; step < 3; step++) await page.locator('[data-action="travel-next"]').click();
  await expect(page.locator('#location')).toHaveText('はじまりの村');
  const beforeReport = await page.evaluate(() => ({ gold: state.gold, total: state.total }));
  expect(beforeReport.total).toBeGreaterThanOrEqual(3);
  await page.locator('[data-action="tavern"]').click();
  await page.locator('[data-tavern-view="quests"]').click();
  await expect(page.locator('#tavernQuests')).toContainText('受注中 · 3 / 3体');
  await expect(page.locator('[data-action="quest-report"]')).toBeEnabled();
  await page.locator('[data-action="quest-report"]').click();
  await expect(page.locator('#tavernQuests .tavern-quest[data-quest="apprentice_hunt"]')).toContainText('報告済み');
  const savedAfterReport = await page.evaluate(() => JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(savedAfterReport.questState).toEqual({ active: null, completedIds: ['apprentice_hunt'] });
  expect(savedAfterReport.gold).toBe(beforeReport.gold + 35);
  expect(savedAfterReport.total).toBe(beforeReport.total);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.locator('[data-action="tavern"]').click();
  await page.locator('[data-tavern-view="quests"]').click();
  await expect(page.locator('#tavernQuests .tavern-quest[data-quest="apprentice_hunt"]')).toContainText('報告済み');

  await page.locator('[data-action="tavern-close"]').click();
  await expect(page.locator('#tavernMenu')).toBeHidden();
  await expect(page.locator('[data-action="tavern"]')).toBeFocused();
  await page.locator('[data-action="shop"]').click();
  await expect(page.locator('#shopMenu')).toBeVisible();
  await expect(page.locator('#tavernMenu')).toBeHidden();
  await page.locator('[data-action="shop-close"]').click();
  await page.locator('[data-action="tavern"]').click();
  await page.locator('[data-screen="map"]').click();
  await expect(page.locator('#tavernMenu')).toBeHidden();
  await expect(page.locator('#screen-map')).toBeVisible();

  for (const [node, zone, name] of [
    ['home', 0, 'はじまりの村'],
    ['luna', 1, '月見の街ルナ'],
    ['forge', 2, '鍛冶の街ヴァル'],
  ]) {
    await page.evaluate(({ node, zone }) => {
      const saved = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
      Object.assign(saved, {
        node,
        lastTown: node,
        zone,
        village: true,
        enemy: null,
        journey: null,
        cleared: [true, true, false],
      });
      localStorage.setItem('starlight-rpg-v1', JSON.stringify(saved));
    }, { node, zone });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
    await page.locator('[data-action="tavern"]').click();
    await expect(page.locator('#tavernTitle')).toHaveText(name + 'の酒場');
    if (node === 'forge') {
      await page.locator('[data-tavern-view="quests"]').click();
      const veteranAccept = page.locator('[data-action="quest-accept:veteran_hunt"]');
      await veteranAccept.scrollIntoViewIfNeeded();
      await expect(veteranAccept).toBeInViewport();
      await veteranAccept.click();
      await expect(page.locator('#tavernQuests')).toContainText('受注中 · 0 / 8体');
    }
    await page.screenshot({ path: test.info().outputPath(`tavern-${node}.png`) });
    await page.locator('[data-action="tavern-close"]').click();
  }
  const finalSave = await page.evaluate(() => JSON.parse(localStorage.getItem('starlight-rpg-v1')));
  expect(finalSave.questState.active).toEqual({ id: 'veteran_hunt', acceptedAtTotal: 4 });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.locator('[data-action="tavern"]').click();
  await page.locator('[data-tavern-view="quests"]').click();
  await expect(page.locator('#tavernQuests')).toContainText('受注中 · 0 / 8体');
});
