const { test, expect, allowExpectedRequestFailure } = require('./fixtures.cjs');
const { heroInput } = require('./party-helpers.cjs');
const monsters = require('../../content/game.json').monsters;
const normalMonsters = monsters.filter(monster => !monster.boss);
const bossMonsters = monsters.filter(monster => monster.boss);

async function assertMonsterImages(page, expected) {
  const units = page.locator('#enemy .enemy-unit');
  await expect(units).toHaveCount(expected.length);
  await expect.poll(() => units.evaluateAll(nodes => nodes.every(node => {
    const image = node.querySelector('.monster-art');
    return image?.complete && image.naturalWidth === 512 && image.naturalHeight === 512;
  }))).toBe(true);
  const actual = await units.evaluateAll(nodes => nodes.map(node => {
    const image = node.querySelector('.monster-art');
    const bounds = node.getBoundingClientRect();
    const imageBounds = image.getBoundingClientRect();
    return {
      id: new URL(image.src).pathname.split('/').at(-1).replace(/\.png$/, ''),
      name: node.querySelector('strong').textContent,
      alt: image.alt,
      width: image.naturalWidth,
      height: image.naturalHeight,
      fitsUnit: imageBounds.width <= bounds.width && imageBounds.bottom <= bounds.bottom,
    };
  }));
  expect(actual.map(image => image.id)).toEqual(expected.map(monster => monster.id));
  expect(actual.map(image => image.name)).toEqual(expected.map(monster => monster.name));
  for (const image of actual) {
    expect(image.alt).toBe('');
    expect(image.width).toBe(512);
    expect(image.height).toBe(512);
    expect(image.fitsUnit).toBe(true);
  }
}

async function setEnemies(page, ids) {
  await page.evaluate(monsterIds => {
    const enemies = monsterIds.map(id => {
      const definition = GameData.monsters.find(monster => monster.id === id);
      return { ...definition, hp: definition.hp, max: definition.hp, boss: !!definition.boss };
    });
    state.enemies = enemies;
    state.enemy = enemies[0];
    render(false);
  }, ids);
}

async function attackTarget(page, index, targetName) {
  const target = page.locator(`[data-target="${index}"]`);
  const before = await page.evaluate(enemyIndex => state.enemies[enemyIndex].hp, index);
  const actorName = await page.evaluate(() => partyNames[actingAlly]);
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="attack"]').click();
  await expect(page.locator('#latestLog')).toContainText(`${actorName}の攻撃！ `);
  await expect.poll(() => page.evaluate(enemyIndex => state.enemies[enemyIndex].hp, index)).toBeLessThan(before);
  await expect(page.locator('#latestLog')).toContainText(`${targetName}に`);
  await expect(page.locator('#messageNext')).toBeVisible();
}

test('通常戦ですべての通常魔物画像を表示し、対象選択と攻撃を続ける', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle('星灯りの旅団 | Starlight Chronicle');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  for (let offset = 0; offset < normalMonsters.length; offset += 4) {
    const batch = normalMonsters.slice(offset, offset + 4);
    await setEnemies(page, batch.map(monster => monster.id));
    await assertMonsterImages(page, batch);
  }

  await page.screenshot({ path: testInfo.outputPath('monster-art-normal.png') });
  // Reload the initial save before starting a real encounter for the interaction check.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.locator('[data-action="explore"]').click();
  await heroInput(page);
  await expect(page.locator('#phase')).toHaveText('BATTLE');
  const currentNames = await page.locator('#enemy .enemy-unit strong').allTextContents();
  await attackTarget(page, 2, currentNames[2]);
  await expect(page.locator('#enemy .enemy-unit')).toHaveCount(4);
});

for (const boss of bossMonsters) {
  test(`${boss.name}のボス戦で個別画像を表示し、攻撃対象にできる`, async ({ page }, testInfo) => {
    const zoneIndex = { grassland: 0, moon_ruins: 1, volcano: 2 }[boss.zoneId];
    const bossNode = { grassland: 'crossing', moon_ruins: 'altar', volcano: 'dragon' }[boss.zoneId];
    expect(zoneIndex).toBeDefined();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
    await page.evaluate(({ node, index }) => {
      state.node = node;
      state.zone = index;
      state.kills = zones.map(area => area.kills);
      state.cleared = [false, false, false];
      state.enemy = null;
      state.enemies = [];
      state.journey = null;
      render();
    }, { node: bossNode, index: zoneIndex });
    await expect(page.locator('[data-action="boss"]')).toBeEnabled();
    await page.locator('[data-action="boss"]').click();
    await heroInput(page);
    await expect(page.locator('#phase')).toHaveText('BOSS BATTLE');
    const expected = [boss, ...normalMonsters.filter(monster => monster.zoneId === boss.zoneId).slice(0, 3)];
    await assertMonsterImages(page, expected);
    await page.screenshot({ path: testInfo.outputPath(`monster-art-${boss.id}.png`) });
    await attackTarget(page, 0, boss.name);
    await expect(page.locator('#enemy .enemy-unit')).toHaveCount(4);
  });
}

test('画像ロード失敗時も敵名と対象操作を維持する', async ({ page }, testInfo) => {
  const blockedUrl = new URL('/assets/monsters/leaf_jelly.png', testInfo.project.use.baseURL).href;
  allowExpectedRequestFailure(page, blockedUrl);
  await page.route(blockedUrl, route => route.abort());
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-game-ready', 'true');
  await page.locator('[data-action="explore"]').click();
  await heroInput(page);
  const fallback = page.locator('[data-target="0"] .monster-art-fallback');
  await expect(fallback).toBeVisible();
  await expect(page.locator('[data-target="0"] img.monster-art')).toHaveCount(0);
  await expect(page.locator('[data-target="0"]')).toContainText('リーフジェリー');
  await expect(page.locator('[data-target="0"] .enemy-hp')).toBeVisible();
  await expect(page.locator('[data-target="0"]')).toBeEnabled();
  await expect(page.locator('#enemy .enemy-unit')).toHaveCount(4);
  const expectedEncounter = [normalMonsters[0], ...normalMonsters.filter(monster => monster.zoneId === 'grassland').slice(0, 3)];
  const failedImageCount = expectedEncounter.filter(monster => monster.id === 'leaf_jelly').length;
  const successfulImageCount = expectedEncounter.length - failedImageCount;
  await expect(page.locator('#enemy .enemy-unit strong')).toHaveText(expectedEncounter.map(monster => monster.name));
  await expect(page.locator('#enemy .monster-art-fallback')).toHaveCount(failedImageCount);
  await expect(page.locator('#enemy .enemy-unit img.monster-art')).toHaveCount(successfulImageCount);
  await expect.poll(() => page.locator('#enemy .enemy-unit img.monster-art').evaluateAll((images, count) =>
    images.length === count && images.every(image => image.complete && image.naturalWidth === 512), successfulImageCount
  )).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('monster-art-fallback.png') });
  await attackTarget(page, 0, 'リーフジェリー');
  await expect(fallback).toBeVisible();
});
