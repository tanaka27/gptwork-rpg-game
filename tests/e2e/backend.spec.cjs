const {test,expect}=require('@playwright/test');
const seed=require('../../content/game.json');
const ready=page=>expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
test.describe.configure({mode:'serial'});
test.beforeEach(async({page})=>{await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,route=>route.abort());page.on('dialog',dialog=>dialog.accept());});
test('管理画面で編集・検証・プレビュー・公開・旧版への復帰を行う',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const publish=async()=>{await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('公開版を切り替えました');};
 try{
  await page.goto('/admin/');await expect(page).toHaveTitle('データ管理 | 星灯りの旅団');await expect(page.locator('#status')).toHaveText('定義を読み込みました。');
  await page.locator('#versions').selectOption('bundled');await expect(page.locator('#status')).toHaveText('定義を読み込みました。');
  await page.locator('#create').click();await expect(page.locator('#status')).toHaveText('下書きを作成しました。');
  const draft=await page.locator('#versions').inputValue();
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
 }finally{await page.request.post('/api/admin/versions/bundled/publish',{headers:{origin:'http://127.0.0.1:4173'},data:{revision:0}});}
});
test('ローカルの進行をクラウドへ保存・復元し、復元前の進行を保持する',async({page})=>{
 await page.goto('/');await ready(page);const original=JSON.parse(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1')));
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
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-before-cloud-restore')).node)).toBe('home');
 await page.locator('.utility-menu summary').click();await page.locator('#cloudSave').click();await expect(page.locator('#uploadCloud')).toBeEnabled();await page.locator('#uploadCloud').click();await expect(page.locator('#cloudStatus')).toContainText('クラウドに保存しました');await expect(page.locator('#restoreHistory')).toBeEnabled();
 await page.screenshot({path:test.info().outputPath('cloud-save.png')});
});

test('公開定義をキャッシュし、API切断時もローカルの進行を保持する',async({page})=>{
 await page.goto('/');await ready(page);
 const before=await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'));
 await page.route('**/api/content',route=>route.abort());
 await page.reload();await ready(page);
 expect(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'))).toBe(before);
 await expect(page.locator('[data-action="explore"]')).toBeVisible();
});
