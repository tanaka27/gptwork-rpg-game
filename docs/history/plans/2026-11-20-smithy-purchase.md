# 鍛冶屋での装備購入

- 状態：反映完了（GitHubのみ、Sites未反映）
- 設計版：v1
- 要求・背景：鍛冶屋で装備の作製だけでなく購入もできるようにする。購入できるのはコモンかアンコモンの装備。
- 設計作成者：Claude Code

## 目的・受け入れ条件
- 鍛冶屋の画面に「作製」「購入」の切り替えがあり、開いた直後は「作製」（従来どおり）。
- 「購入」では、鍛冶屋のレシピの装備のうち標準品がコモン・アンコモンのもの（鉄のつるぎ・革のよろい・月守りのよろい・月鋼の剣・星守りの鎧・星銀のつるぎ）を、装備定義の価格でゴールドだけで1本ずつ買える。購入品は標準品（定義どおりのレアリティ・追加効果）。
- 所持金不足は価格表示のまま無効、装着していない装備が上限（30本）なら「満杯」で無効。処理側でも場所・所持金・上限・購入可否を検証し、満たさなければ何も変えない。

## 対象範囲
- 変更：`shared/crafting.js`（購入品の判定・検証・購入処理）、`dist/game.js`・`dist/index.html`・`dist/workspace.css`（切り替えと購入一覧、遊び方の説明）、`dist/bootstrap.js`（キャッシュ更新）、テスト。
- 文書：GAME_SPEC（鍛冶屋）、README、HANDOFF、BACKEND、CHANGELOG。
- 対象外：公開定義・データ管理画面での品揃え編集、レア以上の購入、ヴァルの通常ショップの品揃え変更。

## 実装設計
- `CraftRules.purchasable(data, gearId)`：レシピにある装備で、定義に存在し、固有装備でなく、レアリティがコモン/アンコモン、価格が正の整数。`rules.gearRoll` には依存しない（標準品を加えるだけのため）。
- `purchaseList(data)`／`checkPurchase(state, data, gearId)`（`unavailable` / `gold` / `full`）／`buy(state, data, gearId)`（`GameRules.addGear` で標準品を加え、ゴールドを減らし、`owned` を同期）。
- 画面は酒場のタブと同じ `aria-pressed` のボタン2つ（`smithy-view:craft|buy`）。購入行は `data-smithy-buy`、操作は `smithy-buy:<装備ID>`。ログは「（装備名）を購入した。」。
- 互換性：セーブ形式・公開定義・DB schemaは変更なし。購入品は既存ショップ品と同じ標準品で、既存の保存検証を通る。

## 検証計画
- ロジック：`tests/game/crafting.test.cjs` に購入可否（固有・レア・価格なし・定義欠落）、所持金・上限の拒否と無変更、標準品の追加、保存検証、画面の切り替え・処理側の拒否・街の外の拒否を追加。`npm test` 全体。
- Playwright：`tests/e2e/smithy.spec.cjs` に購入のケースを追加し、game-desktop / game-mobile で実行。スクリーンショット目視。統合前に全E2E。
- 対象外：iOS/Android実機、Sites本番。
- 復旧：該当commitをrevertする（セーブ形式不変のため購入済み装備はそのまま残る）。

## 親エージェントのレビュー・承認記録
- v1・user-1・2026-11-20・方針合意・鍛冶屋で購入できるのはコモンかアンコモンの装備（標準品・定価）

## 設計変更履歴
- v1：初版

## 実装・検証結果
- `node tests/game/crafting.test.cjs`：購入可否、所持金・上限の拒否と無変更、標準品の追加、保存検証、画面の切り替え・処理側の拒否・街の外の拒否に成功。
- `npm test`：成功。
- `tests/e2e/smithy.spec.cjs`・`town.spec.cjs`（game-desktop / game-mobile）：成功。購入画面のスクリーンショットを両幅で目視（押下中のタブ表示はボタンのtransition後の色をE2Eで確認してから撮影）。
- `npm run test:e2e` 全体：150件成功。
- 設計との差異：なし。遊び方とREADMEに購入の説明を追加。
- 未検証：ImageMagick依存の `npm run build`・`package:site`・`qa:worker-assets`（画像配信は変更なし）、iOS/Android実機、Sites本番。
