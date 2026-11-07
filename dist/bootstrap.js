'use strict';
(async()=>{
 const preview=new URLSearchParams(location.search).get('preview');
 if(!preview){try{const cached=JSON.parse(localStorage.getItem('starlight-content-cache'));if(cached&&!GameContent.validate(cached.data).length){window.GameData=cached.data;window.GameVersion=cached.id;}}catch{}}
 window.GamePreview=!!preview;window.GameVersion=preview||window.GameVersion||'bundled';
 try{
  const response=await fetch(preview?'/api/admin/preview?version='+encodeURIComponent(preview):'/api/content',{signal:AbortSignal.timeout(5000)});
  if(response.ok){const published=await response.json(),errors=GameContent.validate(published.data);if(errors.length)throw new Error(errors.join('\n'));window.GameData=published.data;window.GameVersion=published.id;window.GameBackend=true;if(!preview){try{localStorage.setItem('starlight-content-cache',JSON.stringify(published));}catch{}}}
  else if(preview)throw new Error('プレビューを読み込めません');
 }catch(error){if(preview){document.querySelector('main').textContent='プレビューを開けませんでした。元の進行は変更していません。';document.getElementById('loadingMessage')?.remove();return;}}
 if(!preview){try{const saved=JSON.parse(localStorage.getItem('starlight-rpg-v1'));if(saved?.enemy&&saved.battleContent&&!GameContent.validate(saved.battleContent).length)window.GameData=saved.battleContent;if(saved?.v===2&&saved.node&&(!GameData.nodes.some(n=>n.id===saved.node)||saved.owned?.some(id=>!GameData.items.some(item=>item.id===id)))){document.getElementById('loadingMessage').textContent='現在の進行に必要なゲームデータを取得できませんでした。再読み込みしてください。進行は保持されています。';return;}}catch{}}
 if(preview){const note=document.createElement('p');note.className='preview-banner';note.textContent='定義のプレビュー（進行は通常プレイと別保存）';document.querySelector('header').append(note);}
 for(const src of ['storage.js','combat.js','game.js','party.js','cloud-save.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src+'?v=backend-5';script.onload=resolve;script.onerror=reject;document.body.append(script);});
 document.getElementById('loadingMessage')?.remove();document.documentElement.dataset.gameReady='true';
})();
