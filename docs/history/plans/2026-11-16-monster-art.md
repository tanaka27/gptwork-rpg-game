# モンスター画像のイラスト化

- 状態：反映完了
- 設計版：v1
- 要求・背景：現在SVGで描画するモンスターを、生成したフラットなアニメ調イラストに置き換える。写実的な表現は使わない。
- 設計作成者（子）：Codex

## 目的・受け入れ条件
- 現行の通常魔物12種・ボス3種すべてに、名前と固定IDに対応した個別の生成画像を割り当てる。
- 草原・遺跡・火山の4体編成とボス戦で画像が欠けず、既存の名前、HP、状態異常、対象選択、ダメージ表示、応答性を保つ。
- 平坦な色面、明瞭な輪郭、セル塗りを使い、写実・3D・写真調にしない。
- 初期定義、公開済みコンテンツ、セーブ形式、戦闘仕様を変更しない。既知IDの画像欠落時も名前と操作を保つ。

## 対象範囲
- 変更するファイル・機能：
  - `dist/assets/monsters/{id}.png` にID別15画像を追加。
  - `dist/game.js` の `monster(e)` を固定IDから画像URLを解決する描画へ変更。既存の単体表示と `party.js` の4体表示で同じ画像を使う。
  - `dist/style.css`・`dist/workspace.css` のSVG寸法指定を画像用へ置き換え、既存のレイアウト・選択・ダメージ表示を維持。`dist/index.html` のキャッシュ用クエリを更新。
  - `tests/content.test.cjs`・`tests/worker-assets.test.cjs` とPC／モバイルの戦闘E2Eを更新または追加。
  - `docs/CHARACTER_ART.md`・`docs/DESIGN.md`・`docs/HANDOFF.md`・`CHANGELOG.md` を現状に合わせて更新。
- 影響する既存仕様・関連文書：戦闘表示と敵数は `docs/GAME_SPEC.md`、画像・画面方針は `docs/DESIGN.md`、画像仕様は `docs/CHARACTER_ART.md`、配信方法は `docs/DEVELOPMENT.md`。
- 対象外：敵の定義・数値・戦闘計算、初期ゲームデータ、DB、セーブ、人物・背景画像。

## 実装設計
- 変更内容（処理・画面・データ・API）：
  - `image_gen` で透過背景の4×4アトラスを作り、行優先で次の15種を切り出して個別PNG化する。16枠目は空にする。各絵は1体全身、中央配置、環境・文字・枠なし、濃色の明瞭な線と少数色のフラットなセル塗りとし、各種の輪郭・色・小物で識別できるようにする。生成原画と切り出し確認用シートは `work/` に置き、配信用15 PNGのみを管理対象にする。アトラスの分割や透過に不備があれば、該当絵を個別生成して補う。

| ID | 名前 | 絵の主題 |
| --- | --- | --- |
| `leaf_jelly` | リーフジェリー | 葉冠のある若草色スライム |
| `young_wolf` | 若葉ウルフ | 葉色の毛並みと尾を持つ小型狼 |
| `echo_bat` | こだまコウモリ | 大きな耳と反響模様の翼 |
| `walking_mushroom` | 歩きキノコ | 斑点帽子と短い手足のキノコ |
| `mist_jelly` | ミストジェリー | 月青色、霧の房と小さな月紋のスライム |
| `moon_owl` | 月夜のフクロウ | 月紋の羽と大きな目のフクロウ |
| `ruin_sentinel` | 遺跡の歩哨 | 石板の胴と幾何学的な顔の番兵 |
| `lake_spirit` | 湖の精霊 | 水滴・波形の髪を持つ親しみやすい精霊 |
| `magma_jelly` | マグマジェリー | 溶岩色の割れ模様を持つスライム |
| `ash_hound` | 灰の猟犬 | 炭色の毛並みと橙の差し色の猟犬 |
| `lava_golem` | 溶岩ゴーレム | 岩の体と赤橙の溶岩筋を持つ巨体 |
| `ember_spirit` | 火花の精霊 | 炎形の髪と火花の尾を持つ精霊 |
| `grass_guardian` | 草原の番人 | 若木の角・葉の外套を持つ森の守護者 |
| `moon_golem` | 月影のゴーレム | 月紋と大きな石板で構成する重厚な巨人 |
| `crimson_dragon` | 紅蓮の竜 | 角・翼・尾が明瞭な赤い竜 |

  - PNGは透過を維持した512×512正方形に整える。1枚80 KiB以下、合計1.2 MiB以下を目標とする。ゲーム内は `img` の `object-fit: contain` で表示し、ボタンの既存 `aria-label` を使うため `alt` は空にする。
  - 既知15 IDは固定IDマップから画像を選び、番号・エリア・表示名順には依存させない。読み込み失敗時は画像だけを中立の空プレースホルダーへ置き換え、名前、HP、状態、対象ボタンを残す。追加の公開コンテンツにある未登録IDは既存SVG描画へフォールバックし、互換性を保つ。
  - `scripts/build.cjs` は `dist/assets` を自動走査するため変更不要。ローカル開発ではPNG、本番Workerでは既存方式により同一URLのlossless WebP・`image/webp` MIMEで配信する。Worker用アセット検査に15 URLとPNG画素一致を加える。
- 既存セーブ・公開済み定義との互換性と移行：ゲーム定義・DB・保存値を変えないため移行なし。敵のIDを画像参照に使い、公開済み定義の未登録IDは現行SVGへフォールバックする。
- 異常系・リスクと対策：アトラスの枠ずれ、絵の重なり、透過漏れ、個体識別不足を切り出し後の一覧と各画像の目視で検出し、該当絵を再生成する。欠落ファイル、誤対応、過大サイズはコンテンツ検査・Worker配信検査で検出する。画像失敗時も敵の操作性を維持する。

## 検証計画
- `npm test`：書式、既存ロジック、15 IDと画像ファイルの対応を確認。
- `npm run build` と `npm run qa:worker-assets`：Workerビルドサイズ、15 URLの応答、WebP MIME・シグネチャ、PNGとの画素一致を確認。
- 対象のPlaywright E2Eをデスクトップ幅とスマートフォン相当幅で実行。通常戦とボス戦の画像表示・ロード済み寸法、既存ターゲット選択・攻撃・状態表示、画面内レイアウト、console/pageerrorを確認し、スクリーンショットを目視する。
- 対象外の検証：セーブ移行、API、iOS/Android実機はデータ・API仕様を変えず、実機環境も対象外のため実行しない。
- 反映・復旧方法：親がレビュー後に通常の反映手順でcommit・push・既存Siteへデプロイする。問題時は本変更をrevertし、画像ファイルを含む差分を戻す。セーブデータの復元作業は不要。

## 親エージェントのレビュー・承認記録
- v1・design-review-1・2026-11-16 15:51 JST・設計レビュー・適合・全15種の生成画像、固定ID対応、透過、互換性、欠損時の操作維持、Worker配信とPC/モバイル検証を確認。
- v1・design-approve-1・2026-11-16 15:51 JST・設計承認・承認・条件なし。

- v1・implementation-review-1・2026-11-16 16:30 JST・実装レビュー・適合・15画像の全体目視、ID描画・fallback・CSS・cache・文書・検査差分を確認。npm test/build/WorkerQAおよびPC/mobile E2E計26件の成功報告を受領。
- v1・implementation-approve-1・2026-11-16 16:30 JST・実装承認・承認・条件なし。

## 設計変更履歴
- v1：初版。現行15種のID対応画像、Worker配信、UI互換性と検証を定義。

## 実装・検証結果
- 受け入れ条件と結果：15種の個別画像と固定ID対応、戦闘表示、画像失敗後の対象操作維持を確認。親が全画像とPC/モバイル画面を目視し適合を確認。画像合計602,522 bytes。
- `npm test`：成功。画像ID対応・寸法・透過・重複・容量、既存ロジック・APIを確認。
- `npm run build`：成功。Worker gzip 8,948,344 bytes。
- `npm run qa:worker-assets`：成功。PNG原本15件を含む121画像URLのMIME・cache・PNG画素一致・HEAD・404を確認。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --project=game-desktop --project=game-mobile tests/e2e/monster-art.spec.cjs`：10件成功。15種の画像ロード、通常戦・3ボス、攻撃とHP低下、画像失敗後の操作維持、console/pageerrorを確認。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --project=game-desktop --project=game-mobile tests/e2e/battle-flow.spec.cjs tests/e2e/battle-layout.spec.cjs`：既存16件成功。PC・モバイル幅の戦闘回帰を確認。
- 設計との差異・未検証事項：生成アトラスの出力寸法が均等な4×4ピクセル分割に適さなかったため、個体ごとの領域から512×512の透過PNG8へ切り出した。iOS/Android実機は未確認。
- push・デプロイ結果：GitHub main `19162c3` をpush。Sitesソース `d5c3a08`、デプロイ `appgdep_6afab1a5348081919dbc921b3097d4aa` 成功（所有者限定・D1維持）。公開パッケージは通過済みbuildから作成。Sitesヘルパー不在のため通常Gitと既存パッケージ手順を使用。
