# キャラクター画像

初期4人の固定IDに対応するオリジナルの顔画像です。ゲーム定義のジョブ・能力・進行データとは独立した表示素材です。

| ID | 人物 | ファイル |
| --- | --- | --- |
| astel | アステル | `dist/assets/characters/astel.png` |
| rina | リナ | `dist/assets/characters/rina.png` |
| gald | ガルド | `dist/assets/characters/gald.png` |
| noel | ノエル | `dist/assets/characters/noel.png` |

配信画像は512×512のPNGです。生成原画を保持し、配信用の縮小以外にトリミングや色の描き替えをしません。冒険中の味方欄、仲間一覧、個別詳細で再利用します。隣に名前を表示するため画像のaltは空です。未知の固定IDには既存4人の画像を割り当てません。

## 再生成条件

1人ずつ独立した正方形の顔・肩上ポートレートを作ります。64pxでも表情が読めるよう顔を中央の約55%に配置し、頭頂の余白と肩を残します。日本の2DアニメRPG風の明瞭な線画とセル塗りを使い、リアル調・3D・水彩調にはしません。背景は単色の暗い青緑 `#203638` とし、風景・文字・UI・枠・透かしを含めません。月夜のファンタジーに合う抑えた宝石色、生成り、銀色を使います。

生成後は元のIDとファイル名を対応させ、512×512 PNGへ高品質で縮小します。顔の切り抜き、別キャラクターの流用、色の塗り替えは行いません。固定IDの追加や変更時はこの表と[UIデザイン指針](DESIGN.md)の表示規約も更新します。

## キャラクター別の指定

各画像の制作・再生成では、共通指定に次の人物指定を組み合わせます。

### 共通指定

Use case: stylized-concept. Asset type: square character portrait for the original Japanese browser RPG 星灯りの旅団. Create ONE original character only, head and shoulders portrait centered, facing slightly three-quarter but looking toward the viewer. 2D Japanese anime game illustration, crisp clean dark outlines, flat cel shading with two shadow tones, expressive clear eyes, polished hand-drawn JRPG portrait, readable at 64 pixels. NOT realistic, NOT 3D, NOT painterly or watercolor. Face fills central 55 percent, complete hair visible with small top margin, shoulders visible at bottom, no hands, no weapons in front of face. Square composition. Simple uniform dark desaturated teal background (#203638), no scenery, no letters, no UI, no frame, no watermark. Color harmony: moonlit fantasy, muted jewel colors, cream and silver accents.

### アステル（astel）

Astel / アステル: an original young adult male wandering hero, short tousled dark navy-blue hair, warm amber eyes, calm brave friendly expression, navy traveling cloak over cream tunic, small silver shoulder armor and a simple star-shaped silver clasp.

### リナ（rina）

Rina / リナ: an original young adult female agile adventurer, warm auburn-red hair in a high ponytail with loose side bangs, bright hazel-green eyes, lively confident friendly smile, forest green traveling cape, ochre scarf and practical brown leather collar armor.

### ガルド（gald）

Gald / ガルド: an original broad-shouldered adult male guardian in his thirties, short slate charcoal hair swept back, neatly trimmed short dark beard, brown eyes, strong eyebrows and kind dependable serious expression, dark steel shoulder armor with restrained warm copper trim, deep brown mantle.

### ノエル（noel）

Noel / ノエル: an original young adult male healer, soft silver-mint hair in a medium short rounded cut with long side fringe, gentle violet eyes, serene kind expression, ivory healer robe with muted teal collar, small silver star hair ornament. Delicate graceful features while clearly distinct from the navy-haired hero.
