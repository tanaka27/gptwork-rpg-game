# 変更履歴

日付は日本時間です。新しい変更は上へ追加します。現行の仕様・手順は各正本へ反映し、ここには変更の要約だけを書きます。

- 1件は見出しと3〜4行程度の箇条書きにまとめます（変更内容、互換性への影響、検証結果の要約、反映結果）。
- 詳しい検証記録（テスト件数の内訳、ファイルのハッシュ、操作の細かな手順）は残しません。検証結果は案件の設計書の「実装・検証結果」に1行ずつ要約し、ここからリンクします。
- 反映（push・デプロイ）は完了した事実を書きます。デプロイIDはデプロイ後に分かるため、反映記録だけのcommitで追記して構いません（このcommitは再デプロイ不要。[反映手順](docs/RELEASE.md)）。
- 記録が10件または8KBを超えたら、古い日付の記録をまとめて新しいファイル `docs/history/YYYY-MM-DD-to-MM-DD-changelog.md`（移す記録の最初と最後の日付）へ移し、下の行と[文書索引](docs/README.md)の履歴表にリンクを足します。既存の履歴ファイルには追記しません。

2026-11-10以前の記録は[2026-11-04〜11-10の変更履歴](docs/history/2026-11-04-to-11-10-changelog.md)（大きいので通常の作業では開かない）にあります。

## 2026-11-11 — GitHub最新版のSites反映

- GitHub `bac4772` の未反映分を既存Siteへ同期し、Sitesソース `cddb24a51e1c25a7cedce6a3f9b0e8a7827e057e` をデプロイ。所有者限定・Site ID・D1バインディングを維持。
- 検証：Node.js 24.22.1で `npm test` 成功、Workerビルド成功、公開済み静的ファイル23件がGitHub正本とバイト単位で一致（HTTP 200）。既存の全E2E成功記録を引き継ぎ、再実行なし。
- 未確認：公開Siteの実ブラウザ操作（操作ツール未提供）、認証後の本番API・DB（サービス用アクセスで `/api/health` は401となり、所有者ログインが必要）。
- 反映：デプロイ `appgdep_6af40598028481919902123d02750960` 成功。Sites補助スクリプト未配置のため、認証を標準入力からメモリだけへ渡して通常Gitで同期。配信物を変えない本反映記録はGitHubへのpushのみ。

## 2026-11-11 — 手書きコードの整形とテスト運用の調整

- `dist/` の手書きJS・CSSと `shared/` をPrettierで整形し、`npm run format`・`format:check` を追加（`npm test` の先頭で確認）。E2Eの `game.spec.cjs` を機能別の5ファイルへ分割、retryを0に固定、APIテストをdot形式の出力に変更（[案件計画](docs/history/plans/2026-11-11-code-format-and-test-tuning.md)）。
- 挙動・保存形式の変更なし。キャッシュ更新用クエリを更新。
- 検証：JSのminify結果が整形前後で一致、`npm test` 成功、全E2E 78/78（変更前後とも）。未確認：Node 24、iOS/Android実機。
- 反映：GitHubへpush。Sitesは未反映（Claude Codeの環境にSitesツールがないため）。

## 2026-11-11 — 文書とエージェント向けルールの整理（コンテキスト削減）

- `CLAUDE.md`（Claude Code専用）を追加。AGENTS.mdの重複を統合し、反映の手順・例外を[反映手順](docs/RELEASE.md)へ、MCPの手順を[PLAYWRIGHT_MCP.md](docs/PLAYWRIGHT_MCP.md)へ分離。反映記録だけのcommitは再デプロイ不要と明記。
- 反映完了の設計書を `docs/history/plans/` へ、2026-11-10以前のCHANGELOGを `docs/history/` へ移し、`.rgignore` で生成物・履歴を検索対象から除外。設計書・CHANGELOGの記入ルール（短く書く、詳細は残さない、古い記録を移す）を追加。
- GAME_SPEC・DESIGN・BACKEND・HANDOFFなどの重複と、コードとの食い違い（魔物の賢さ・素早さ、`/api/health`、screenshot設定など）を修正。
- 文書・検索設定のみの変更。相対リンクと `git diff --check` を確認。Sitesへの反映は未実施（Claude Codeの環境にSitesツールがないため）。

## 2026-11-11 — GAME_SPECの重複削除とゲームテストの分割

- GAME_SPEC内で重複していた説明（レベルアップ・ボス撃破時の全回復、戦闘中は装備変更不可、人物選択を保存しない、クリア演出）をそれぞれ1箇所にまとめた。仕様の内容は変更していない。
- `tests/game.test.cjs` を `tests/game/` の機能別6ファイルと起動ヘルパー・実行スクリプトへ分割（[案件計画](docs/history/plans/2026-11-11-game-test-split.md)）。テストの中身は変えていない。
- 検証：分割前後でassert数・PASSメッセージ・テスト本文が一致、`npm test` 成功。製品コードの変更なし。Sitesへの反映は未実施。

## 2026-11-11 — テスト運用とPlaywright MCP

- E2Eをgame/admin・desktop/mobileの4 projectへ分け、projectごとに専用のserverとSQLiteを使うよう変更。共通fixtureでconsole/pageerror監視と通信先の制限を行う（[案件計画](docs/history/plans/2026-11-11-testing-strategy.md)）。
- 公式Playwright MCPとMCP SDKをバージョン固定で追加し、探索用のstdio client（`npm run qa:mcp`）を用意。回帰の正本はPlaywright Testのまま。
- 検証：`qa:e2e-fixtures` と全E2E（desktop/mobile）通過、MCPでsnapshot操作とvision座標操作を確認。未確認：iOS/Android実機、公開Siteでの操作、本番API。製品コードの変更なし。
- 反映：GitHub `e6fbe11` をmainへpushし、既存Siteへのデプロイ成功（`appgdep_6af3c778118081918ac994c74576d80f`）。
