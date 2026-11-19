// Existing hero-focused regressions explicitly choose normal attacks for companions.
async function heroInput(page){
 for(let i=0;i<160;i++){
  const flags=await page.evaluate(()=>({waiting:!!battleMessageResolve,input:!!commandResolve,actor:actingAlly,battle:!!state.enemy}));
  if(flags.input){if(flags.actor===0)return;await page.locator('[data-action="attack"]').click();}
  else if(flags.waiting)await page.locator('#fieldMessage').click();
  else if(!flags.battle)return;
  else await page.waitForTimeout(10);
 }
 throw Error('hero input not reached');
}
// 戦闘メッセージの通し番号（メッセージ欄の data-message-seq）。同じ文が続いても、送ったかどうかを判定できる。
// メッセージが表示されてから読む。
async function messageSeq(page){
 const {expect}=require('@playwright/test');
 await expect.poll(()=>page.evaluate(()=>!!battleMessageResolve)).toBe(true);
 return Number(await page.locator('#fieldMessage').getAttribute('data-message-seq')||0);
}
// 送った後は、次のメッセージが出て番号が増えるか、待機中のメッセージがなくなる。
// 自動送りの画面では timeout を自動送りの間隔より短くし、操作で進んだことを確かめる。
async function expectMessageAdvanced(page,before,options={}){
 const {expect}=require('@playwright/test');
 await expect.poll(()=>page.evaluate(before=>Number(document.getElementById('fieldMessage').dataset.messageSeq||0)>before||!battleMessageResolve,before),options).toBe(true);
}
module.exports={heroInput,messageSeq,expectMessageAdvanced};
