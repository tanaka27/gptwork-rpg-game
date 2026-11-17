# キャラクター詳細への会心率表示

- 状態：反映完了
- 設計版：v1
- 要求・背景：現在のキャラクター詳細に表示するうんのよさに加え、戦闘ルールと同じ会心率を百分率で表示する。
- 設計作成者（子）：Codex 子エージェント

## 目的・受け入れ条件
- 主人公・仲間の詳細（仲間画面と戦闘中の状態詳細）および酒場の冒険者詳細に、うんのよさから算出した会心率を表示する。
- 表示率は `CombatRules.criticalRate` の結果を百分率にし、小数点以下2桁で表示する。既存のうんのよさ表示は保つ。
- セーブ形式・戦闘挙動を変えない。

## 対象範囲
- 変更するファイル・機能：`dist/party.js`（主人公・仲間詳細）、`dist/game.js`（酒場冒険者詳細）、`dist/bootstrap.js` と `dist/index.html`（配信JSのキャッシュ更新）、`tests/game/adventurers.test.cjs` と関連E2Eテスト、`docs/GAME_SPEC.md`、`CHANGELOG.md`。
- 影響する既存仕様・関連文書：[会心率の計算](../../GAME_SPEC.md#戦闘)、[キャラクター詳細と酒場冒険者](../../GAME_SPEC.md)。
- 対象外：戦闘計算、通常攻撃・魔法等の対象範囲、一覧・戦闘HUDの表示、保存データ。

## 実装設計
- `characterStatusCard` は実戦値の `allyStats(i).luck` を `CombatRules.criticalRate` に渡し、率を百分率に変換して2桁表示する。共通カードのため仲間画面と戦闘中の状態詳細へ反映される。酒場冒険者詳細も既存の `selected.luck` に同じ計算を適用する。
- 既存の能力値表示とレイアウトを使い、会心率行をうんのよさの近くへ追加する。仕様書へ詳細画面の表示項目を反映する。配信JSを更新するため、bootstrapとHTMLのキャッシュクエリも更新する。
- 既存セーブと公開済み定義への影響なし。新規保存値や移行処理は不要。
- `CombatRules.criticalRate` を唯一の計算元にするため、計算式の二重実装による表示と戦闘のずれを避ける。

## 検証計画
- `tests/game/adventurers.test.cjs` で酒場冒険者の表示値を確認し、`tests/e2e/luck.spec.cjs` と `tests/e2e/game-screens.spec.cjs` で主人公・仲間の表示値を確認する。既存の会心計算テストも実行する。
- `tests/e2e/luck.spec.cjs`、`tests/e2e/game-screens.spec.cjs`、`tests/e2e/battle-status.spec.cjs`、`tests/e2e/tavern-adventurers.spec.cjs` をPC幅・スマホ相当幅の両方で実行する。対象詳細を開いて表示値、レイアウト、console/pageerrorを確認し、スクリーンショットを目視する。
- フォーマット/構文チェックを行い、HTMLとbootstrapのキャッシュクエリおよび文書リンク・記述整合を確認する。
- 対象外：iOS/Android実機確認（PC上のPlaywright幅検証では実機挙動を確認できないため）。
- 反映・復旧方法：親が通常のGit/Sites反映手順を実行する。表示を戻す場合は、この案件の表示変更とキャッシュクエリ更新をリバートする。保存互換性に影響しない。

## 親エージェントのレビュー・承認記録
- v1・design-review-1・2026-11-17 19:32 JST・設計レビュー・適合・共通カードと酒場詳細の表示、計算再利用、互換性、検証範囲を確認。
- v1・design-approve-1・2026-11-17 19:32 JST・設計承認・承認・条件なし。

- v1・implementation-review-1・2026-11-17 19:44 JST・実装レビュー・適合・表示計算、キャッシュ更新、関連文書とテスト結果を確認。スマホ幅の戦闘・酒場詳細を親も目視。
- v1・implementation-approve-1・2026-11-17 19:44 JST・実装承認・承認・条件なし。

## 設計変更履歴
- v1：初版

## 実装・検証結果
- 受け入れ条件と結果：主人公・仲間・酒場冒険者の詳細に `CombatRules.criticalRate` に基づく会心率を小数点以下2桁で追加。既存のうんのよさ表示、セーブ、戦闘挙動は維持。
- 検証：`npm run format:check`、変更JS/E2Eの `node --check`、`node tests/game/adventurers.test.cjs`、`node tests/game/rules-progression.test.cjs` 成功。
- 検証：4つの対象E2Eをgame-desktop/game-mobileで実行し14件成功。NPC詳細スクリーンショットのため同specを両projectで再実行し2件成功。Playwright bundled Chromiumが未導入のため `/usr/bin/chromium` を指定。
- 検証：親が実行した `npm run package:site` 成功（Worker 140 assets）。
- 検証：主人公・仲間詳細、戦闘中詳細、NPCプロフィールと会心率行のPC/スマホ相当幅スクリーンショットを目視。表示とレイアウトに問題なし。iOS/Android実機は未確認。
- 設計との差異・未検証事項：親レビュー指摘により `battle-status.spec.cjs` を追加検証範囲へ含めた。その他の差異なし。
- push・デプロイ結果：GitHub main `c565abd`、Sitesソース `0a18f72`、バージョン64、デプロイ `appgdep_6afc3052dbdc81918bb05066e43d4409` 成功。閲覧範囲（custom）とD1を維持。Sites作業ヘルパーが未配置のため既存ソースをGitで同期し、リポジトリのパッケージ手順を使用。
