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

ローカル開発では元PNGをimage/pngで配信します。WorkerビルドではPNG原本を保持したままlossless WebPへ変換し、元と同じPNG URLをimage/webp MIMEで配信します。変換後の画素は原本と一致します。

## 現行の画像生成規約

新規制作と今後の再生成は、初期4人を含めて全身立ち絵を使います。現行4人の画像をこの規約に合わせて作り直す必要はありません。各人物は別々に生成し、別の人物画像の流用・合成や顔の切り抜きをしません。

### 共通指定

Use case: stylized-concept. Asset type: full-body character illustration for the original Japanese browser RPG 星灯りの旅団. Create ONE original character only, centered, standing and facing slightly three-quarter while looking toward the viewer. Show the complete head, both hands, and both feet with small margins; the face and upper chest must fit within the top 28 percent of the portrait for the tavern crop. 2D Japanese anime game illustration, crisp clean dark outlines, flat cel shading with two shadow tones, expressive readable eyes, polished hand-drawn JRPG art. NOT realistic, NOT 3D, NOT painterly or watercolor. Portrait composition, 2:3 aspect ratio. Simple uniform dark desaturated teal background (#203638), no scenery, no letters, no UI, no frame, no watermark. Moonlit fantasy color harmony, varied muted jewel colors, cream and silver accents. Design a distinct face, hair, skin tone, build, silhouette, and accessories for this person; do not reuse another character design. Clothing and optional props should clearly match the assigned role, but never obscure the face.

### 初期4人の人物指定

今後この4人を再生成するときは、共通の全身指定に次の人物指定を組み合わせます。以下は外見の特徴を保つための補助指定で、既存PNGの再生成を求めるものではありません。

- アステル（astel）：young adult male wandering hero, short tousled dark navy-blue hair, warm amber eyes, calm brave friendly expression, navy traveling cloak over cream tunic, small silver shoulder armor and a simple star-shaped silver clasp.
- リナ（rina）：young adult female agile adventurer, warm auburn-red hair in a high ponytail with loose side bangs, bright hazel-green eyes, lively confident friendly smile, forest green traveling cape, ochre scarf and practical brown leather collar armor.
- ガルド（gald）：broad-shouldered adult male guardian in his thirties, short slate charcoal hair swept back, neatly trimmed short dark beard, brown eyes, strong eyebrows and kind dependable serious expression, dark steel armor with restrained warm copper trim, deep brown mantle.
- ノエル（noel）：young adult male healer, soft silver-mint hair in a medium short rounded cut with long side fringe, gentle violet eyes, serene kind expression, ivory healer robe with muted teal collar, small silver star hair ornament. Delicate graceful features while clearly distinct from the navy-haired hero.

## 酒場の冒険者100人

固定ID `adventurer_001`〜`adventurer_100` に1枚ずつ固有画像を割り当てます。ファイル名はIDと一致し、`adventurer_001` の配信先は `dist/assets/characters/adventurer_001.webp` です。全100枚のIDとジョブは `shared/adventurers.js` のロスターを正本とします。初期4人のPNGを酒場の人物へ流用しません。

### 人物と職業の差

1024×1536 PNGの全身原画をIDごとに生成します。顔立ち、髪型、肌色、体格、装身具を変え、同じ職業でも人物の顔・色・シルエットを重複させません。職業は `shared/adventurers.js` にある10種類を使います。剣士は実用的な旅行服と軽い剣装備、魔法使いは重ね着のローブ、弓使いは弓具を含む軽装、戦士は頑丈な鎧、僧侶は癒やし手の法衣、盗賊は軽い革装備、騎士は礼装鎧と外套、錬金術師は実用衣と調合道具、旅芸人は彩りのある舞台衣装、狩人は野外向けの装いを目安にします。武器・小道具で顔を隠しません。

生成原画は `work/npc100-originals/`、配信画像は `work/npc100-delivery/` で制作・確認し、原画はコミットせず配信WebPだけを収録します。配信画像は512×768 WebP、縮小は高品質、quality 78を目安とします。1枚50 KiB以下、100枚合計3.5 MiB以下を守ります。

### 酒場の表示

冒険者ID `adventurer_001`〜`adventurer_100` の配信先は、それぞれ `dist/assets/characters/adventurer_001.webp`〜`dist/assets/characters/adventurer_100.webp` です。未知IDへ他の人物画像を割り当てません。

一覧では固定正方形の `overflow:hidden` 枠に全身画像を置きます。初期値は画像幅240%、left -70%、top 6.8%とし、原画上部約28%（頭頂から胸上）を表示します。拡大率・焦点位置はCSS変数でID別に調整します。`object-fit:cover` のみでは全身が小さくなるので使いません。選択後の酒場NPC冒険者詳細では同じ画像をクロップせず全身表示します。「仲間」画面の初期4人とは別の詳細画面です。

一覧画像は `loading=lazy`、`decoding=async`、`width=512`、`height=768` を指定します。ボタン内の画像は装飾のためaltを空にし、ボタン名に人物名・職業・レベルを含めます。画像が欠けていても人物名と詳細操作は保ち、別人の画像や顔のプレースホルダーへ置き換えません。
