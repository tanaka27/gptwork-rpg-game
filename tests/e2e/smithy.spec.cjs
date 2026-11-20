const { test, expect } = require('./fixtures.cjs');

async function placeAt(page, patch) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.evaluate(patch => {
    const save = JSON.parse(localStorage.getItem('starlight-rpg-v1'));
    Object.assign(save, { village: true, enemy: null, journey: null, cleared: [true, true, false] }, patch);
    localStorage.setItem('starlight-rpg-v1', JSON.stringify(save));
  }, patch);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
}

test('ヴァルの鍛冶屋で素材とゴールドを使ってレア以上の装備を作製する', async ({ page }) => {
  await placeAt(page, { node: 'forge', zone: 2, gold: 1000, materials: { fur: 3, fang: 2, ore: 1 } });
  await page.locator('#actions [data-action="smithy"]').click();
  await expect(page.locator('#smithyMenu')).toBeVisible();
  await expect(page.locator('#actions')).toBeHidden();
  await expect(page.locator('#smithyTitle')).toBeFocused();
  await expect(page.locator('#smithyTitle')).toHaveText('鍛冶の街ヴァルの鍛冶屋');
  await expect(page.locator('#smithyItems [data-recipe]')).toHaveCount(6);
  // 素材がそろったレシピだけ選べる。
  const iron = page.locator('#smithyItems [data-recipe="craft_iron"]');
  await expect(iron.getByRole('button', { name: '120 G' })).toBeEnabled();
  for (const id of ['craft_leather', 'craft_moon', 'craft_moonsteel_blade', 'craft_starward_armor', 'craft_star'])
    await expect(page.locator(`#smithyItems [data-recipe="${id}"] button`)).toHaveText('素材不足');
  for (const id of ['craft_leather', 'craft_moon', 'craft_moonsteel_blade', 'craft_starward_armor', 'craft_star'])
    await expect(page.locator(`#smithyItems [data-recipe="${id}"] button`)).toBeDisabled();
  await expect(page.locator('#smithyItems [data-recipe="craft_star"] .smithy-needs')).toContainText('火山鉱 1/4');
  await page.screenshot({ path: test.info().outputPath('smithy-list.png') });

  const before = await page.evaluate(() => state.gear.length);
  await iron.getByRole('button', { name: '120 G' }).click();
  await expect(page.locator('#smithyGold')).toHaveText('880 G');
  const crafted = await page.evaluate(() => ({
    gear: state.gear.at(-1),
    count: state.gear.length,
    materials: state.materials,
  }));
  expect(crafted.count).toBe(before + 1);
  expect(crafted.gear.baseId).toBe('iron');
  expect(['rare', 'epic', 'legendary']).toContain(crafted.gear.rarity);
  expect(crafted.materials.fur).toBe(0);
  expect(crafted.materials.fang).toBe(0);
  await expect(page.locator('#smithyItems .smithy-result')).toContainText('鉄のつるぎ');
  await expect(page.locator('#latestLog')).toContainText('鉄のつるぎを作製した！');
  // 素材を使い切ったので、もう一度は作れない。
  await expect(iron.locator('button')).toBeDisabled();
  await expect(iron.locator('button')).toHaveText('素材不足');
  expect(
    await page.evaluate(() => SaveRules.validate(JSON.parse(localStorage.getItem('starlight-rpg-v1')), GameData))
  ).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('smithy-crafted.png') });

  // 再読み込み後も作製品が残る。
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  expect(await page.evaluate(uid => state.gear.some(e => e.uid === uid), crafted.gear.uid)).toBe(true);
  await page.locator('#actions [data-action="smithy"]').click();
  await page.locator('[data-action="smithy-close"]').click();
  await expect(page.locator('#smithyMenu')).toBeHidden();
  await expect(page.locator('#actions [data-action="smithy"]')).toBeFocused();
});

test('所持金が足りないと作製できず、ほかの街には鍛冶屋がない', async ({ page }) => {
  await placeAt(page, { node: 'forge', zone: 2, gold: 50, materials: { fur: 4, sap: 2 } });
  await page.locator('#actions [data-action="smithy"]').click();
  await expect(page.locator('#smithyItems [data-recipe="craft_leather"] button')).toHaveText('100 G');
  await expect(page.locator('#smithyItems [data-recipe="craft_leather"] button')).toBeDisabled();
  for (const node of ['home', 'luna']) {
    await placeAt(page, { node, zone: node === 'home' ? 0 : 1 });
    await expect(page.locator('#actions [data-action="shop"]')).toBeVisible();
    await expect(page.locator('#actions [data-action="smithy"]')).toHaveCount(0);
  }
});

test('鍛冶屋の「購入」でコモン・アンコモンの装備を定価で買う', async ({ page }) => {
  await placeAt(page, { node: 'forge', zone: 2, gold: 500, materials: {} });
  await page.locator('#actions [data-action="smithy"]').click();
  await expect(page.locator('[data-smithy-view="craft"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-smithy-view="buy"]').click();
  await expect(page.locator('[data-smithy-view="buy"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-smithy-view="buy"]')).toBeFocused();
  await expect(page.locator('#smithyNote')).toContainText('コモン・アンコモン');
  await expect(page.locator('#smithyItems [data-recipe]')).toHaveCount(0);
  await expect(page.locator('#smithyItems [data-smithy-buy]')).toHaveCount(6);
  await expect(page.locator('#smithyItems [data-smithy-buy="moonsteel_blade"] .rarity')).toHaveText('アンコモン');
  await expect(page.locator('#smithyItems [data-smithy-buy="star"] button')).toHaveText('220 G');
  await expect(page.locator('#smithyItems [data-smithy-buy="moonsteel_blade"] button')).toBeEnabled();
  // 押下中の見た目へ切り替わってから撮る（ボタンには短いtransitionがある）。
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-smithy-view="buy"]')).toHaveCSS('background-color', 'rgb(37, 56, 47)');
  await expect(page.locator('[data-smithy-view="craft"]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: test.info().outputPath('smithy-buy.png') });

  await page.locator('#smithyItems [data-smithy-buy="moonsteel_blade"] button').click();
  await expect(page.locator('#smithyGold')).toHaveText('80 G');
  await expect(page.locator('#latestLog')).toContainText('月鋼の剣を購入した。');
  await expect(page.locator('#smithyItems [data-smithy-buy="moonsteel_blade"]')).toContainText('所持1');
  await expect(page.locator('#smithyItems [data-smithy-buy="moonsteel_blade"] button')).toBeDisabled();
  await expect(page.locator('#smithyItems [data-smithy-buy="leather"] button')).toBeEnabled();
  const bought = await page.evaluate(() => state.gear.at(-1));
  expect(bought).toMatchObject({ baseId: 'moonsteel_blade', rarity: 'uncommon' });
  expect(
    await page.evaluate(() => SaveRules.validate(JSON.parse(localStorage.getItem('starlight-rpg-v1')), GameData))
  ).toEqual([]);

  // 作製へ戻すとレシピ一覧になる。
  await page.locator('[data-smithy-view="craft"]').click();
  await expect(page.locator('#smithyItems [data-recipe]')).toHaveCount(6);
  await expect(page.locator('#smithyItems [data-smithy-buy]')).toHaveCount(0);
});
