const {test,expect,allowExpectedRequestFailure}=require('./fixtures.cjs');
const seed=require('../../content/game.json');
const ready=page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
test.describe.configure({mode:'serial'});
test.beforeEach(async({page})=>{page.on('dialog',dialog=>dialog.accept());});
test('管理画面で編集・検証・プレビュー・公開・旧版への復帰を行う',async({page,context},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const publish=async()=>{await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('公開版を切り替えました');};
 try{
  await page.goto('/admin/');await expect(page).toHaveTitle('データ管理 | 星灯りの旅団');await expect(page.locator('#status')).toHaveText('定義を読み込みました。');
  await page.locator('#versions').selectOption('bundled');await expect(page.locator('#status')).toHaveText('定義を読み込みました。');
  await page.locator('#create').click();await expect(page.locator('#status')).toHaveText('下書きを作成しました。');
  const draft=await page.locator('#versions').inputValue();
  await page.locator('#category').selectOption('characters');await page.locator('#search').fill('リナ');await page.locator('#entries button').filter({hasText:'リナ'}).click();
  await expect(page.locator('#editor [data-field="job"]')).toHaveValue('弓使い');
  await page.locator('#category').selectOption('skills');await page.locator('#search').fill('気合い');await page.locator('#entries button').filter({hasText:'気合い'}).click();
  await expect(page.locator('#editor [data-field="characterId"]')).toHaveValue('gald');
  await expect(page.locator('#editor [data-field="target"]')).toHaveValue('self');
  await page.locator('#search').fill('');await page.locator('#category').selectOption('monsters');
  await page.locator('#editor [data-field="name"]').fill('検証用リーフジェリー');
  await page.locator('#validate').click();await expect(page.locator('#status')).toContainText('検証に合格');
  await page.locator('#save').click();await expect(page.locator('#status')).toHaveText('下書きを保存しました。');
  const game=await context.newPage();await game.goto('/');await ready(game);
  expect(await game.evaluate(()=>GameData.monsters[0].name)).toBe(seed.monsters[0].name);
  const before=await game.evaluate(()=>localStorage.getItem('starlight-rpg-v1'));
  const opened=context.waitForEvent('page');await page.locator('#preview').click();const preview=await opened;await preview.waitForLoadState();await ready(preview);
  expect(await preview.evaluate(()=>GameData.monsters[0].name)).toBe('検証用リーフジェリー');
  expect(await preview.evaluate(()=>GamePreview)).toBe(true);
  expect(await preview.evaluate(()=>localStorage.getItem('starlight-rpg-v1'))).toBe(before);
  await preview.close();await publish();
  await game.reload();await ready(game);expect(await game.evaluate(()=>GameData.monsters[0].name)).toBe('検証用リーフジェリー');
  const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadEvent;expect(download.suggestedFilename()).toContain(draft);
  await page.locator('#versions').selectOption('bundled');await expect(page.locator('#status')).toHaveText('定義を読み込みました。');await publish();
  await game.reload();await ready(game);expect(await game.evaluate(()=>GameData.monsters[0].name)).toBe(seed.monsters[0].name);
  await page.locator('#import').setInputFiles({name:'definition.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(seed))});await expect(page.locator('#status')).toContainText('下書きとして取り込みました');
  await page.locator('#category').selectOption('nodes');await page.locator('#remove').click();await expect(page.locator('#status')).toContainText('削除できません');
  await page.screenshot({path:test.info().outputPath('admin-data-editor.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  await game.close();
 }finally{await page.request.post('/api/admin/versions/bundled/publish',{headers:{origin:new URL(testInfo.project.use.baseURL).origin},data:{revision:0}});}
});
test('ローカルの進行をクラウドへ保存・復元し、復元前の進行を保持する',async({page})=>{
 await page.goto('/');await ready(page);await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('starlight-rpg-v1'));saved.total=2;saved.questState={active:{id:'apprentice_hunt',acceptedAtTotal:1},completedIds:[]};saved.adventurerState.tick=12;saved.adventurerState.explorationProgress=2;saved.adventurerState.locations.adventurer_001='grove';localStorage.setItem('starlight-rpg-v1',JSON.stringify(saved));});await page.reload();await ready(page);const original=JSON.parse(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1')));
 await page.locator('.utility-menu summary').click();await page.locator('#cloudSave').click();await expect(page.locator('#uploadCloud')).toBeEnabled();
 await page.locator('#uploadCloud').click();await expect(page.locator('#cloudStatus')).toContainText('クラウドに保存しました');
 await page.locator('#closeCloud').click();await page.locator('.utility-menu summary').click();
 await page.evaluate(()=>{Math.random=()=>.99;});
 await page.locator('[data-screen="map"]').click();await page.locator('#regions [data-action="move:home"]').click();
 for(let i=0;i<3;i++)await page.locator('[data-action="travel-next"]').click();
 await expect(page.locator('#location')).toHaveText('はじまりの村');
 await page.locator('.utility-menu summary').click();await page.locator('#cloudSave').click();await expect(page.locator('#restoreCloud')).toBeEnabled();await page.locator('#restoreCloud').click();
 await ready(page);await expect(page.locator('#location')).toHaveText('風そよぐ草原');
 const restored=JSON.parse(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1')));expect(restored.node).toBe(original.node);expect(restored.gold).toBe(original.gold);
 expect(restored.questState).toEqual(original.questState,'cloud restore keeps the accepted quest and its progress baseline');
 expect(restored.adventurerState).toEqual(original.adventurerState,'cloud restore keeps the per-save NPC world and exploration progress');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-before-cloud-restore')).node)).toBe('home');
 await page.locator('.utility-menu summary').click();await page.locator('#cloudSave').click();await expect(page.locator('#uploadCloud')).toBeEnabled();await page.locator('#uploadCloud').click();await expect(page.locator('#cloudStatus')).toContainText('クラウドに保存しました');await expect(page.locator('#restoreHistory')).toBeEnabled();
 await page.screenshot({path:test.info().outputPath('cloud-save.png')});
});

test('公開定義をキャッシュし、API切断時もローカルの進行を保持する',async({page})=>{
 await page.goto('/');await ready(page);
 const before=await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'));
 allowExpectedRequestFailure(page,'/api/content');
 await page.route('**/api/content',route=>route.abort());
 await page.reload();await ready(page);
 expect(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'))).toBe(before);
 await expect(page.locator('[data-action="explore"]')).toBeVisible();
});

test('管理画面でドロップ装備の抽選ルールと固有装備を編集・検証・保存する',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/admin/');await expect(page.locator('#status')).toHaveText('定義を読み込みました。');
 await page.locator('#versions').selectOption('bundled');await expect(page.locator('#status')).toHaveText('定義を読み込みました。');
 // 公開済みの版では編集できない。
 await page.locator('#rulesEditor').locator('xpath=..').locator('summary').click();
 const editor=page.locator('#gearRollEditor');
 await expect(editor.locator('legend')).toHaveText('ドロップ装備の抽選');
 await expect(editor.locator('[name="rate-common"]')).toBeDisabled();
 await page.locator('#create').click();await expect(page.locator('#status')).toHaveText('下書きを作成しました。');
 await expect(editor.locator('[name="rate-common"]')).toHaveValue('50');
 await expect(editor.locator('[name="rate-epic"]')).toHaveValue('5');
 await expect(page.locator('#gearRateTotal')).toHaveText('合計 100％');
 const preview=page.locator('#gearRollPreview');
 await expect(preview.locator('caption')).toContainText('装備Lv10');
 await expect(preview.locator('tr:has(th:text-is("攻撃力")) td')).toHaveText(['+2〜3','+3〜4','+4〜5','+4〜6']);
 // 合計が100％でないと警告し、検証も通らない。
 await editor.locator('[name="rate-common"]').fill('40');await editor.locator('[name="rate-common"]').blur();
 await expect(page.locator('#gearRateTotal')).toHaveText('合計 90％（100％にしてください）');
 await page.locator('#validate').click();await expect(page.locator('#status')).toContainText('確率の合計は1にしてください');
 await editor.locator('[name="rate-legendary"]').fill('12.5');await editor.locator('[name="rate-legendary"]').blur();
 await expect(page.locator('#gearRateTotal')).toHaveText('合計 100％');
 // 候補の能力を外すとプレビューから消え、係数と倍率の変更が範囲に反映される。
 await editor.locator('[name="stat-maxHP"]').uncheck();
 await expect(preview.locator('th:text-is("最大HP")')).toHaveCount(0);
 await editor.locator('[name="coef-attack"]').fill('0.5');await editor.locator('[name="coef-attack"]').blur();
 await editor.locator('[name="range-legendary-1"]').fill('2');await editor.locator('[name="range-legendary-1"]').blur();
 await page.locator('#gearPreviewLevel').fill('20');
 await expect(preview.locator('tr:has(th:text-is("攻撃力")) td')).toHaveText(['+6〜9','+8〜11','+10〜13','+12〜20']);
 // 固有装備のチェックは全装備に表示する。
 await page.locator('#category').selectOption('items');
 await page.locator('#entries button').filter({hasText:'鉄のつるぎ'}).click();
 await expect(page.locator('#editor [data-field="unique"]')).not.toBeChecked();
 await page.locator('#editor [data-field="unique"]').check();
 await page.locator('#entries button').filter({hasText:'星灯りの剣'}).click();
 await expect(page.locator('#editor [data-field="unique"]')).toBeChecked();
 await page.locator('#validate').click();await expect(page.locator('#status')).toContainText('検証に合格');
 await page.screenshot({path:testInfo.outputPath('admin-gear-roll.png'),fullPage:true});
 await page.locator('#save').click();await expect(page.locator('#status')).toHaveText('下書きを保存しました。');
 const id=await page.locator('#versions').inputValue();
 const saved=(await (await page.request.get('/api/admin/versions/'+encodeURIComponent(id))).json()).data;
 expect(saved.rules.gearRoll.rarityRates).toEqual({common:0.4,uncommon:0.3,rare:0.125,epic:0.05,legendary:0.125});
 expect(Object.keys(saved.rules.gearRoll.statRates)).not.toContain('maxHP');
 expect(saved.rules.gearRoll.statRates.attack).toBe(0.5);expect(saved.rules.gearRoll.rarityRanges.legendary).toEqual([1.2,2]);
 expect(saved.items.find(item=>item.id==='iron').unique).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
test('抽選ルールの変更前にクラウドへ保存した装備も、移行してから復元する',async({page})=>{
 await page.goto('/');await ready(page);
 const legacy=await page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
  s.gear.push({uid:s.nextGearUid,baseId:'star',rarity:'legendary',bonusEffects:[{stat:'attack',amount:3},{stat:'speed',amount:2},{stat:'luck',amount:3}]});
  s.nextGearUid++;s.owned=[...new Set(s.gear.map(e=>e.baseId))];s.gold=4321;
  return s;
 });
 expect(await page.evaluate(s=>SaveRules.validate(s,GameData).length,legacy)).toBeGreaterThan(0);
 // 旧ルールのときに保存されたクラウドセーブを返す。
 await page.route('**/api/save',route=>route.request().method()==='GET'?route.fulfill({json:{state:legacy,revision:1,updatedAt:new Date().toISOString()}}):route.continue());
 await page.locator('.utility-menu summary').click();await page.locator('#cloudSave').click();await expect(page.locator('#restoreCloud')).toBeEnabled();
 await page.locator('#restoreCloud').click();await ready(page);
 const restored=JSON.parse(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1')));
 expect(restored.gold).toBe(4321);
 expect(restored.gear.find(e=>e.baseId==='star')).toMatchObject({rarity:'epic',bonusEffects:[{stat:'attack',amount:4},{stat:'speed',amount:3},{stat:'luck',amount:4}]});
 expect(await page.evaluate(()=>SaveRules.validate(state,GameData))).toEqual([]);
});
