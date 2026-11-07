const {test,expect}=require('@playwright/test');
async function seed(page,{fallen=false,lethal=false,weak=false}={}){
 await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/,r=>r.abort());
 await page.addInitScript(()=>{Math.random=()=>0;});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await page.locator('[data-action="explore"]').click();
 await page.evaluate(({fallen,lethal,weak})=>{
  const s=JSON.parse(localStorage.getItem('starlight-rpg-v1'));
  s.hp=fallen?0:80;s.mp=10;s.companions.forEach(c=>{c.hp=80;c.mp=20;});
  s.enemies.forEach((e,i)=>{Object.assign(e,{name:'敵'+i,hp:weak?1:1000,max:weak?1:1000,atk:lethal?10000:20,def:0,speed:[30,11,9,1][i]});});s.enemy=s.enemies[0];
  localStorage.setItem('starlight-rpg-v1',JSON.stringify(s));
 },{fallen,lethal,weak});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
}
async function advance(page){await page.locator('#fieldMessage').click();}
async function toInput(page){for(let i=0;i<100;i++){if(!await page.locator('#messageNext').isVisible())return;await advance(page);}throw Error('no input');}
test('素早さ順に先行し、主人公の番で選択・取消・防御して次ラウンドへ進む',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_FAILED'))errors.push(m.text());});
 await seed(page);
 const save=await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'));
 const hp=()=>page.locator('#partyStatus').innerHTML();
 const before=await hp();
 await expect(page.locator('#latestLog')).toHaveText('敵0の攻撃！');
 await expect(page.locator('[data-action="guard"]')).toBeDisabled();
 expect(await page.evaluate(()=>combat('guard'))).toBe(false);
 await page.waitForTimeout(250);expect(await hp()).toBe(before);
 await page.screenshot({path:test.info().outputPath('before-action.png')});
 await advance(page);expect(await hp()).not.toBe(before);
 const damage=await page.evaluate(()=>80-state.hp);expect(damage).toBeGreaterThan(0);
 await advance(page);await expect(page.locator('#latestLog')).toHaveText('リナの攻撃！');
 await toInput(page);
 await expect(page.locator('#commandTitle')).toContainText('アステルの番');
 await expect(page.locator('#messageNext')).toBeHidden();
 await expect(page.locator('[data-action="guard"]')).toBeEnabled();
 expect(await page.evaluate(()=>state.lastRoundOrder)).toEqual(['敵0','リナ','ノエル']);
 expect(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'))).toBe(save);
 await page.locator('[data-action="skills"]').click();await page.locator('[data-action="skill-back"]').click();
 expect(await page.evaluate(()=>state.turn)).toBe(1);
 await page.screenshot({path:test.info().outputPath('choose-at-action.png')});
 await page.locator('[data-action="guard"]').click();
 expect(await page.evaluate(()=>combat('attack'))).toBe(false);
 await expect(page.locator('#latestLog')).toHaveText('アステルは身を守る！');
 expect(await page.evaluate(()=>state.mp)).toBe(10);
 await advance(page);expect(await page.evaluate(()=>state.mp)).toBe(13);
 await toInput(page);
 await expect(page.locator('#turn')).toHaveText('TURN 2');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('starlight-rpg-v1')));
 expect(saved.turn).toBe(2);expect(saved.mp).toBe(13);
 expect(saved.lastRoundOrder).toEqual(['敵0','リナ','ノエル','アステル','敵1','敵2','ガルド','敵3']);
 const hits=saved.log.filter(t=>/^敵[1-3]の攻撃！ アステルに/.test(t));expect(hits).toHaveLength(3);
 for(const hit of hits)expect(Number(hit.match(/に(\d+)/)[1])).toBeLessThan(damage);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-game-ready','true');
 await expect(page.locator('#latestLog')).toHaveText('敵0の攻撃！');
 expect(await page.evaluate(()=>state.hp)).toBe(saved.hp);
 expect(await page.evaluate(()=>localStorage.getItem('starlight-rpg-v1'))).toBe(JSON.stringify(saved));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 expect(errors).toEqual([]);
});
test('主人公が先に倒れたら入力を飛ばし、仲間の行動と全滅まで進む',async({page})=>{
 await seed(page,{lethal:true});
 await advance(page);await expect(page.locator('#partyStatus')).toContainText('戦闘不能');
 for(let i=0;i<100;i++){
  if(await page.locator('[data-action="rest"]').isVisible())break;
  await expect(page.locator('#messageNext')).toBeVisible();
  await expect(page.locator('[data-action="attack"]')).toBeDisabled();await advance(page);
 }
 await expect(page.locator('[data-action="rest"]')).toBeVisible();
 expect(await page.evaluate(()=>state.enemy)).toBeNull();expect(await page.evaluate(()=>state.hp)).toBe(80);
});
test('主人公戦闘不能でも仲間だけで勝利し、入力待ちにならない',async({page})=>{
 await seed(page,{fallen:true,weak:true});
 for(let i=0;i<100;i++){if(await page.evaluate(()=>!busy&&!roundActive&&!state.enemy))break;await expect(page.locator('#messageNext')).toBeVisible();await advance(page);}
 await expect(page.locator('[data-action="explore"]')).toBeVisible();expect(await page.evaluate(()=>state.total)).toBe(4);
});
