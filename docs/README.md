# 文書索引

作業に必要な正本だけを下表から選んで読みます。開発のルールはエージェント別の文書（Codexは[AGENTS.md](../AGENTS.md)、Claude Codeは[CLAUDE.md](../CLAUDE.md)）にあります。

## 正本一覧

| 文書 | 正本にする内容 | 読む場面 |
| --- | --- | --- |
| [README.md](../README.md) | ゲームとリポジトリの利用者向け入口 | 初めて触るとき |
| [GAME_SPEC.md](GAME_SPEC.md) | ゲーム仕様、数値、計算式、操作ルール | ゲームルールの変更 |
| [HANDOFF.md](HANDOFF.md) | 構成、コードの変更箇所、既知の制約 | 実装箇所を探すとき |
| [BACKEND.md](BACKEND.md) | 定義・DB・API・認証・セーブ形式と互換性 | API/DB/セーブの変更 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 開発サーバー、テストの選び方、失敗時の診断 | 実装・テスト |
| [PLAYWRIGHT_MCP.md](PLAYWRIGHT_MCP.md) | Playwright MCPの起動・操作 | MCPで探索するときだけ |
| [RELEASE.md](RELEASE.md) | commit・push・Sitesデプロイ・ビルド | 反映を担当するときだけ |
| [IMPLEMENTATION_WORKFLOW.md](IMPLEMENTATION_WORKFLOW.md) | 設計承認の条件・記録、設計書の書式 | 実装の設計・承認 |
| [DESIGN.md](DESIGN.md) | 画面の配置と見た目 | 見た目の変更 |
| [CHARACTER_ART.md](CHARACTER_ART.md) | キャラクター画像の仕様と再生成条件 | 画像の追加・再生成 |
| [CHANGELOG.md](../CHANGELOG.md) | 作業ごとの変更の要約と反映記録 | 直近の変更を確認するとき |
| [docs/plans/](plans/) | 進行中の案件の設計書 | その案件の作業中 |

## 履歴（大きいので通常の作業では開かない）

| 場所 | 内容 |
| --- | --- |
| [docs/history/plans/](history/plans/) | 反映完了した案件の設計書 |
| [2026-11-04〜11-10の変更履歴](history/2026-11-04-to-11-10-changelog.md) | CHANGELOGから移した古い記録 |
| [開発文書の整理前資料](history/2026-11-10-development-documents.md) | 2026-11-10より前のHANDOFF/DEVELOPMENT/BACKEND |
| [ゲーム文書の整理前資料](history/2026-11-10-game-documents.md) | 2026-11-10より前のゲーム仕様・設計文書 |

historyは現行の正本ではありません。問い合わせや移行調査で必要な場合だけ、該当する日付・節を見て現在の正本と照合します。
