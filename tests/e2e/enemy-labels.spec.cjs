const {test,expect}=require('./fixtures.cjs');
const {heroInput,messageSeq,expectMessageAdvanced}=require('./party-helpers.cjs');

test('同じ名前の敵にA・Bを付けて画面・メッセージ・保存で区別する',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 // 草原の先頭の魔物（リーフジェリー）が抽選されると、固定の3体と名前が重なる。
 await page.evaluate(()=>{const random=Math.random;Math.random=()=>0;startBattle(false,false,true);Math.random=random;});
 expect(await page.evaluate(()=>state.enemies.map(e=>e.name))).toEqual(['リーフジェリーA','リーフジェリーB','若葉ウルフ','こだまコウモリ']);
 expect(await page.evaluate(()=>state.enemies.map(e=>e.baseName??null))).toEqual(['リーフジェリー','リーフジェリー',null,null]);
 await expect(page.locator('.enemy-unit strong')).toHaveText(['リーフジェリーA','リーフジェリーB','若葉ウルフ','こだまコウモリ']);
 await expect(page.locator('.enemy-unit[data-target="1"]')).toHaveAttribute('aria-label','リーフジェリーBを攻撃対象に選択');
 expect(await page.evaluate(()=>state.log.includes('リーフジェリーAが あらわれた！'))).toBe(true);
 await page.screenshot({path:test.info().outputPath('enemy-labels.png')});
 // Bを狙うと、メッセージにもBの名前が出る。
 await heroInput(page);
 await page.locator('.enemy-unit[data-target="1"]').click();await page.locator('[data-action="attack"]').click();
 const seen=[];
 for(let i=0;i<40;i++){
  const waiting=await page.evaluate(()=>!!battleMessageResolve);
  if(!waiting){if(await page.evaluate(()=>!!commandResolve||!state.enemy))break;await page.waitForTimeout(20);continue;}
  seen.push(await page.locator('#latestLog').textContent());
  const seq=await messageSeq(page);await page.locator('#fieldMessage').click();await expectMessageAdvanced(page,seq);
 }
 expect(seen.some(line=>line.startsWith('アステルの攻撃！ リーフジェリーBに'))).toBe(true);
 expect(seen.every(line=>!/リーフジェリー(?![AB])/.test(line))).toBe(true);
 // 再読み込みしても名前は変わらない。
 const names=await page.evaluate(()=>state.enemies.map(e=>e.name));
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 expect(await page.evaluate(()=>state.enemies.map(e=>e.name))).toEqual(names);
 expect(errors).toEqual([]);
});

test('区別の記号がない戦闘中の旧セーブも、読み込み時にA・Bを付ける',async({page})=>{
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.evaluate(()=>{const random=Math.random;Math.random=()=>0;startBattle(false,false,true);Math.random=random;});
 await page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
  for(const e of s.enemies){if(e.baseName){e.name=e.baseName;delete e.baseName;}}
  s.enemy=s.enemies[0];
  localStorage.setItem('starlight-rpg-v1',JSON.stringify(s));
 });
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await expect(page.locator('.enemy-unit strong')).toHaveText(['リーフジェリーA','リーフジェリーB','若葉ウルフ','こだまコウモリ']);
 expect(await page.evaluate(()=>SaveRules.validate(state,GameData))).toEqual([]);
});
