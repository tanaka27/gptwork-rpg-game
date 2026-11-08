# キャラクター画像

2026-11-08。内蔵ImageGenで1人ずつ新規生成した、2Dアニメ調のオリジナル顔画像。CLI/APIキーは使用していません。初期4人の固定IDに対応し、職業・能力などのゲーム定義は変更しません。

- アステル：`dist/assets/characters/astel.png`
- リナ：`dist/assets/characters/rina.png`
- ガルド：`dist/assets/characters/gald.png`
- ノエル：`dist/assets/characters/noel.png`

配信画像は512×512 PNG。生成原画は保持し、配信用に高品質縮小しています。トリミングや色の描き替えは行っていません。状態欄・仲間一覧・個別詳細で再利用します。名前を隣接表示するため画像のaltは空です。未知の固定IDには既存4人の画像を流用しません。

## 最終プロンプト

各画像には次の共通指定と個別指定を連結して使用しました。

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
