# キャラクター画像

キャラクター画像は固定IDに対応する表示素材です。ジョブ、能力、位置、進行データとは独立して管理します。

## 現行の初期4人画像

| ID | 人物 | 元画像 |
| --- | --- | --- |
| astel | アステル | `dist/assets/characters/astel.png` |
| rina | リナ | `dist/assets/characters/rina.png` |
| gald | ガルド | `dist/assets/characters/gald.png` |
| noel | ノエル | `dist/assets/characters/noel.png` |

現在の初期4人は512×512 PNGの既存画像を使用します。「仲間」画面の味方一覧・個別ステータス詳細と、冒険中の味方欄で再利用します。隣に名前を表示するためaltは空です。未知の固定IDへ初期4人の画像を割り当てません。

ローカル開発では元PNGをimage/pngで配信します。WorkerビルドではPNG原本を保持したままWebPへ変換し、元と同じPNG URLをimage/webp MIMEで配信します。モンスターなどは lossless で画素が原本と一致します。初期4人の顔は表示が最大104pxのため、配信用だけ320pxに縮小した品質85のWebPにします（規則と例外の正本は[DEVELOPMENT.md](DEVELOPMENT.md)）。

## 現行の画像生成規約

新規制作と今後の再生成は、初期4人を含めて全身立ち絵を使います。現行4人の画像をこの規約に合わせて作り直す必要はありません。各人物は別々に生成し、別の人物画像の流用・合成や顔の切り抜きをしません。

### 共通指定

```text
RPG向けのキャラクター1人の全身立ち絵を描く。

【構図】
幅2：高さ3の縦長画面。人物を中央に立たせ、体は軽く斜めに、視線は鑑賞者に向ける。頭頂から靴先までと両手を画面内に収め、周囲に少し余白を取る。画像の上端から28％を切り出したときに、頭頂から胸の上部までが見えるように配置する。髪や装備、小道具で目や顔を隠さない。

【画風】
手描きの日本の2Dアニメゲーム風。濃く明瞭な輪郭線と、境界がはっきりした2段階の影で形を描く。全身を縮小しても姿勢と輪郭が読み取りやすく、顔を切り出したときに目と表情が見分けやすいようにする。写実、3D、水彩、絵画調の質感は避ける。

【背景】
暗い青緑（#203638）の均一な単色。風景、文字、UI、枠、透かしは入れない。
```

### 初期4人の人物指定

今後この4人を再生成するときは、共通の全身指定に次の人物指定を組み合わせます。以下は外見の特徴を保つための補助指定で、既存PNGの再生成を求めるものではありません。

- アステル（astel）：young adult male wandering hero, short tousled dark navy-blue hair, warm amber eyes, calm brave friendly expression, navy traveling cloak over cream tunic, small silver shoulder armor and a simple star-shaped silver clasp.
- リナ（rina）：young adult female agile adventurer, warm auburn-red hair in a high ponytail with loose side bangs, bright hazel-green eyes, lively confident friendly smile, forest green traveling cape, ochre scarf and practical brown leather collar armor.
- ガルド（gald）：broad-shouldered adult male guardian in his thirties, short slate charcoal hair swept back, neatly trimmed short dark beard, brown eyes, strong eyebrows and kind dependable serious expression, dark steel armor with restrained warm copper trim, deep brown mantle.
- ノエル（noel）：young adult male healer, soft silver-mint hair in a medium short rounded cut with long side fringe, gentle violet eyes, serene kind expression, ivory healer robe with muted teal collar, small silver star hair ornament. Delicate graceful features while clearly distinct from the navy-haired hero.

## 魔物イラスト

現行の通常魔物12種とボス3種は `dist/assets/monsters/{id}.png` にID別の画像を置き、`content/game.json` の固定IDに対応させます。各画像は透過背景の512×512 PNG8で、全身を中央に描きます。濃色の明瞭な輪郭、平坦な色面と2段階のセル塗りを使う、フラットな2Dアニメ調のオリジナルJRPGイラストにします。写実・3D・水彩、背景、文字、枠は使いません。

生成時は各モンスターのシルエット、主色、種別の特徴を分けます。原画と確認用シートは `work/` に置き、配信用PNGだけをコミットします。1枚80 KiB以下、15枚合計1.2 MiB以下を保ちます。Workerでは既存のPNG配信処理により同じURLでlossless WebPとして返します。未登録IDの公開コンテンツは既存のSVG描画で表示し、既知IDの画像取得に失敗したときは中立の空プレースホルダーを使って名前と対象操作を維持します。

## 酒場の冒険者100人

固定ID `adventurer_001`〜`adventurer_100` に1枚ずつ固有画像を割り当てます。ファイル名はIDと一致し、`adventurer_001` の配信先は `dist/assets/characters/adventurer_001.webp` です。全100枚のIDとジョブは `shared/adventurers.js` のロスターを正本とします。初期4人のPNGを酒場の人物へ流用しません。

### 人物と職業の差

1024×1536 PNGの全身原画をIDごとに生成します。顔立ち、髪型、肌色、体格、装身具を変え、同じ職業でも人物の顔・色・シルエットを重複させません。職業は `shared/adventurers.js` にある10種類を使います。剣士は実用的な旅行服と軽い剣装備、魔法使いは重ね着のローブ、弓使いは弓具を含む軽装、戦士は頑丈な鎧、僧侶は癒やし手の法衣、盗賊は軽い革装備、騎士は礼装鎧と外套、錬金術師は実用衣と調合道具、旅芸人は彩りのある舞台衣装、狩人は野外向けの装いを目安にします。武器・小道具で顔を隠しません。

生成原画は `work/npc100-originals/`、配信画像は `work/npc100-delivery/` で制作・確認し、原画はコミットせず配信WebPだけを収録します。配信画像は512×768 WebP、縮小は高品質、quality 78を目安とします。1枚50 KiB以下、100枚合計3.5 MiB以下を守ります。

### 酒場の表示

冒険者ID `adventurer_001`〜`adventurer_100` の配信先は、それぞれ `dist/assets/characters/adventurer_001.webp`〜`dist/assets/characters/adventurer_100.webp` です。未知IDへ他の人物画像を割り当てません。

一覧では固定正方形の `overflow:hidden` 枠に全身画像を置きます。初期値は画像幅240%、left -70%、top 6.8%とし、原画上部約28%（頭頂から胸上）を表示します。拡大率・焦点位置はCSS変数でID別に調整します。`object-fit:cover` のみでは全身が小さくなるので使いません。選択後の酒場NPC冒険者詳細では同じ画像をクロップせず全身表示します。「仲間」画面の初期4人とは別の詳細画面です。

一覧画像は `loading=lazy`、`decoding=async`、`width=512`、`height=768` を指定します。ボタン内の画像は装飾のためaltを空にし、ボタン名に人物名・職業・レベルを含めます。画像が欠けていても人物名と詳細操作は保ち、別人の画像や顔のプレースホルダーへ置き換えません。
