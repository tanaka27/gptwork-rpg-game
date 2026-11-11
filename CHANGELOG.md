# 変更履歴

日付は日本時間です。新しい変更は上へ追加します。現行の仕様・手順は各正本へ反映し、ここには変更の要約だけを書きます。

- 1件は見出しと3〜4行程度の箇条書きにまとめます（変更内容、互換性への影響、検証結果の要約、反映結果）。
- テストの件数の内訳、ファイルのハッシュ、操作の細かな手順など詳しい検証記録は、案件別の `docs/plans/` に書き、ここからリンクします。
- 反映（push・デプロイ）は、完了した事実を書きます。予定の書き方で終わらせません。

2026-11-09以前の記録は[2026-11-04〜11-09の変更履歴](docs/history/2026-11-04-to-11-09-changelog.md)に移しました。

## 2026-11-11 — 検索対象・MCP手順・設計書の軽量化

- `.rgignore` を追加し、生成物（`dist/data.generated.js`、`dist/data/`、`dist/shared/`）、`docs/history/`、`package-lock.json` をripgrepの検索対象から除外。AGENTS.md・CLAUDE.md・文書索引に記載。
- DEVELOPMENT.mdのPlaywright MCPの節を[PLAYWRIGHT_MCP.md](docs/PLAYWRIGHT_MCP.md)へ分離し、採用理由と依存バージョンの記述は案件計画に任せた。E2Eの固定件数（78件）の記述を削除。HANDOFFから履歴資料へのリンクを外し、文書索引に「通常の作業では開かない」と明記。
- IMPLEMENTATION_WORKFLOWに設計書を短く保つ書き方（目安8KB、旧版は差分のみ、レビューは1行、検証は1行）を追加し、テンプレートのレビュー・承認欄を1つに統合。
- 文書・検索設定のみの変更。相対リンク、`git diff --check`、`.rgignore` の除外動作を確認。Sitesへの反映は未実施。

## 2026-11-11 — コンテキスト消費を抑える文書整理

- AGENTS.mdの重複した記述（push・デプロイ・モデル指定の繰り返し、GAME_SPEC・HANDOFFと同じ説明、文書索引と同じ読み順）を統合し、12.1KBから約7.3KBへ削減。ルールの内容は変更していない。
- CHANGELOGの2026-11-09以前を[履歴資料](docs/history/2026-11-04-to-11-09-changelog.md)へ移し、冒頭に記入ルール（1件3〜4行、詳細はplanへ、反映は完了した事実を書く）を追加。見出しと本文がずれていた記録（コンテンツ拡張、主人公の行動順、仲間操作の公開記録）を正しい位置へ戻した。
- 文書のみの変更。相対リンクと `git diff --check` を確認。Sitesへの反映は未実施（Claude Codeの環境にSitesツールがないため）。

## 2026-11-11 — Claude Code向けルール文書を追加

- `CLAUDE.md` を新規作成。Claude Code専用で他のエージェントは確認不要と明記し、AGENTS.mdのうちツールに依存しない共通ルール（文書更新、Git、実装・検証の約束）だけを取り込んだ。Codex固有の内容（サブエージェントのモデル指定、親子の承認フロー、mainへの確認なしpush、毎回のSitesデプロイ）は除外した。
- Sitesへのデプロイは、Codexのハーネスに付属するskill・ツールが前提のため、Claude Codeでは行わず、未反映であることを報告する方針を記載。
- `docs/README.md` の正本一覧と読み順に、AGENTS.md（Codex専用）とCLAUDE.md（Claude Code専用）の区別を追加。
- 文書のみの変更。相対リンクを確認。アプリ・生成物は変更なし。Sitesへの反映は未実施（Claude Codeの環境にSitesツールがないため）。

## 2026-11-11 — テスト運用とPlaywright MCP

- [案件計画](docs/plans/2026-11-11-testing-strategy.md) v2の承認に沿って、Playwright E2Eを78件・2 viewportのままgame/admin・desktop/mobile各専用server/SQLiteへ分離。E2E共通fixtureにconsole/pageerror監視と現在の `baseURL` origin制限を集め、意味的な初期画面確認を追加。
- 公式 `@playwright/mcp@0.0.85` と `@modelcontextprotocol/sdk@1.32.2` を固定追加。継続JSONL操作、失敗応答と不正入力の非成功判定、`--caps=vision` 座標操作を備えたstdio clientとfixture異常系probeを追加。回帰の正本は `@playwright/test@1.64.1` のまま。MCPはPlaywright/playwright-core `1.66.0-alpha-2026-11-09` に依存する。
- 検証：`npm ci --cache work/npm-cache`、構文検査、`git diff --check`、`qa:e2e-fixtures` 成功。E2Eは4 project計78/78件通過。desktop/mobile実MCP sessionでsemantic snapshot/ref操作とvision座標での戦闘背景操作を実施し、親が計40 tool callsとPC/スマホ相当幅の画像を目視確認。通常開発DB `.local/rpg.sqlite` は存在せず、テスト用4 projectはrun専用SQLiteを使用。
- 配信物に関する製品ソース・生成物は変更なし。既存 `work/site.tar.gz`（8,884,446 bytes、SHA-256 `29da3c58f4b8db7653eca4e7f4729f22f6d6c69d21b77ec3d89dd28f43d26d25`）を再利用する。
- 反映：親が実装承認しGitHub `e6fbe11`をmainへpush。Sitesソース`b85d055`と同じアプリ成果物でデプロイ`appgdep_6af3c778118081918ac994c74576d80f`がsucceeded。既存Site ID・D1・所有者限定を維持。反映記録もpushし同じ成果物を再デプロイする。
- 未確認：iOS/Android実機、公開Siteの操作、本番API。

## 2026-11-10 — 装備レアリティと追加効果

- 装備にノーマル／レア／エピック／レジェンドを追加。旧6装備はノーマルとして維持し、レア2件はルナ／ヴァルで販売、エピック／レジェンド各1件は遺跡／火山の通常敵から取得する。レアリティ別の追加効果を装備中の人物能力へ反映し、ショップ・もちものから装備詳細を開ける。
- 管理バリデーションは効果数・stat・量・重複と、shop/drop参照を検証。旧公開定義はraw保持し、実行・クラウドsave・公開切替の参照検証に互換補完cloneを適用。save key `starlight-rpg-v1`、形式 `v:2`、公開DB snapshot、migrationは変更なし。
- README・GAME_SPEC・HANDOFF・BACKEND・DEVELOPMENTに現行説明を反映し、設計・実装記録は[案件計画](docs/plans/2026-11-10-equipment-rarity.md)へ記録。
- 検証：`npm test` 成功（SQLite API 11/11）。Playwright 78/78（1440×900 / 390×844）成功。レア購入・装備加算、epic/legend戦闘勝利取得、重複ether変換、詳細表示・保存再読込を操作し、console/pageerrorなし。スクリーンショットは`work/rarity-qa/`で目視確認。変更JSの構文、`git diff --check`、`npm run package:site`成功（`work/site.tar.gz`、8,884,446 bytes）。
- 公開：親が実装承認。GitHub `f75f8ea`をmainへpushし、Sitesソース`53349f2`と同一アプリ成果物でデプロイ`appgdep_6af2cd7a751881919d6cf3c382da5d89`がsucceeded。既存Site ID・D1・所有者限定を維持。反映記録もpushし、同じ成果物で再反映する。
- 未確認：iOS/Android実機、本番所有者操作。

## 2026-11-10 — 現行文書の整理

現行文書を入口・正本・履歴に分け、過去に日付追記されていた引き継ぎ・検証・公開の資料を[整理前スナップショット](docs/history/2026-11-10-development-documents.md)へ保存しました。現行文書の索引は[docs/README.md](docs/README.md)です。詳細な過去記録は変更せず保全し、現行の説明から外しました。

文書の重複、古い断定、表と本文の整合、相対リンクを確認しました。アプリコード・生成物は変更していません。文書のみのため、ゲーム動作検証とビルドの再実行は対象外です。親レビュー後、公開済み成果物を再利用してGitHub pushと既存Sitesへの反映を行います。

## 2026-11-10 — 開発エージェント運用の役割分担を更新

- 親エージェントが設計書と実装結果をレビュー・承認し、子サブエージェントが調査・設計・実装・テスト・必要文書更新を担当する運用へ変更。親は実装コードを書かず、指摘を子へ返して修正・再検証を依頼する。
- 子の起動時は `fork_turns=none`、`model=gpt-6-luna`、`reasoning_effort=max` と必要コンテキストを指定する。指定条件が使えない場合は代替せず阻害要因を報告する。設計→親承認→子実装・検証→親承認→親のpush・既存Sites反映の順を明記。
- 過去の `docs/plans/` の承認記録と履歴本文は変更していない。
- 文書のみの変更。ゲーム動作・保存形式・アプリ配信ファイルは変更なし。文書のリンク・記述整合性と `git diff --check` を確認。GitHub `main` へのpushと既存Sitesの同一配信物の再デプロイは親エージェントが担当する。

## 2026-11-10 — 仲間のジョブと固有特技

- アステル＝星剣士（既存5特技）、リナ＝弓使い、ガルド＝戦士、ノエル＝僧侶。計11の特技を旅団共通Lvで習得し、スキル一覧と実行を使用者ごとに制限。ジョブ・特技の習得状況と効果を仲間画面へ表示する。戦闘の各人の手動コマンド、個別能力・装備を維持。
- 旧定義ではjob未指定の既知人物に標準jobと不足特技を補う。明示jobのカスタム構成、未知人物に定義された技能、衝突する技能IDは保持。保存キー`starlight-rpg-v1`・`v:2`と進行、公開DB版・マイグレーションは変更なし。本番`app_settings`は空配列でbundled定義を使用。設計書v3は`/root`が2026-11-10 11:09 JSTに承認。
- 検証：親の独立`npm test`、APIの旧/新battle snapshot往復10/10件、`content:check`、JS構文、build、`git diff --check`が通過。Playwrightは初回72ケースを実行し、旧selector起因の4件を修正後、対象spec12/12件と小画面の追加PC/スマホ2/2件が通過。全体でユニーク74ケースを確認。仲間画面・技能一覧・旧battleContent再読込・管理画面・320×568/844×390の特技スクロールとポップアップ表示を確認。
- 未確認：スマートフォン実機、音声、長時間プレイのバランス、本番所有者としての操作。親の実装承認後、GitHub `main` へpushし、既存Site ID・所有者限定を維持して反映する。

## 2026-11-10 — 仲間全員のコマンド操作と個別ステータス

- 全味方が各人の番でコマンド入力を待つ。仲間も通常攻撃・スキル・道具・防御・逃走を選択し、主人公が倒れても操作可能。
- 各人の成長・HP/MP上限・攻撃/守備/賢さ/素早さ/運・装備を分離。使用者のMP・能力、対象者の守備/回復上限を適用。レベル・経験値と所持品は旅団共通。
- もちものに人物選択、詳細に個別装備を追加。旧セーブ・旧公開定義の互換、上限超過HP/MPと進行を保持。クラウド検証も個別装備に対応。
- 設計v1は/root/design_reviewが2026-11-10 09:55（日本時間）に承認。実装レビューの対象再検証の指摘にも対応。
- 検証：npm test・JS構文・差分チェック・Workerビルド/パッケージが通過。PlaywrightはPC1440×900/スマホ幅390×844の全66ケースを確認（54件通過後、旧期待値等を修正し、失敗12件＋主要8件の20件再実行が全通過）。スクリーンショットを目視確認。スマートフォン実機・音声・長時間の全編バランスは未確認。
- 公開記録：GitHub 49ebc38をmainへpush。Sitesソース1a9d0261476185a686bb9082e59836e29083f20dと一致するWorkerを既存Siteへ反映し、appgdep_6af26f65a5c48191b2600daeb596d4cfのsucceededを確認（2026-11-10 10:12 日本時間）。Site ID・所有者限定の閲覧範囲・公開済みDB定義を維持。記録更新後も同じ配信物を再同期する。
