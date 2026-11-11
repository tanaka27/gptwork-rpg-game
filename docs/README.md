# 文書索引

ここはプロジェクト文書の入口です。まずリポジトリの[README.md](../README.md)を確認し、次に作業内容に必要な正本だけを読みます。現行仕様・手順は下表の文書を正本とし、CHANGELOGや履歴ファイルは経緯を調べる場合に必要な範囲だけ参照してください。

## 正本一覧

| 文書 | 正本にする内容 |
| --- | --- |
| [README.md](../README.md) | ゲームとリポジトリの利用者向け入口 |
| [AGENTS.md](../AGENTS.md) | Codex向けの必須開発ルール、担当、検証、反映条件（Codex専用） |
| [CLAUDE.md](../CLAUDE.md) | Claude Code向けの開発ルール（Claude Code専用。他のエージェントは確認不要） |
| [HANDOFF.md](HANDOFF.md) | 現行構成、コード変更箇所、保存互換性、既知の制約 |
| [GAME_SPEC.md](GAME_SPEC.md) | 現行ゲーム仕様、数値、計算式、データ |
| [BACKEND.md](BACKEND.md) | 現行の定義/DB/API/認証/保存の仕組み |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 現行コマンド、検証、ビルド、Sites反映の参照先 |
| [IMPLEMENTATION_WORKFLOW.md](IMPLEMENTATION_WORKFLOW.md) | 実装前の設計書、親レビューと承認の流れ |
| [DESIGN.md](DESIGN.md) | 現行の画面デザイン指針 |
| [CHARACTER_ART.md](CHARACTER_ART.md) | キャラクター画像の制作・配置指針 |
| [CHANGELOG.md](../CHANGELOG.md) | 作業ごとの変更理由、検証結果、反映記録 |

同じ詳細を複数文書に書き写さず、必要な文書から上記正本へリンクします。現行文書の変更では該当節を置換・統合し、古い手順や状態を日付付きで末尾に残しません。

## 最小の読み順

- 開発作業の入口: [README.md](../README.md) → エージェントごとのルール（Codexは[AGENTS.md](../AGENTS.md)、Claude Codeは[CLAUDE.md](../CLAUDE.md)） → この索引。
- ゲームルールの変更: [GAME_SPEC.md](GAME_SPEC.md)、必要な場合は[HANDOFF.md](HANDOFF.md)。
- API/DB/認証の変更: [BACKEND.md](BACKEND.md)、[DEVELOPMENT.md](DEVELOPMENT.md)。
- 実装コードの変更: [IMPLEMENTATION_WORKFLOW.md](IMPLEMENTATION_WORKFLOW.md)と案件の`docs/plans/`設計書。
- 見た目の変更: [DESIGN.md](DESIGN.md)、必要な場合は[CHARACTER_ART.md](CHARACTER_ART.md)。

必要な正本のみ読みます。過去資料を一括して読む必要はありません。

## 履歴索引

| 場所 | 参照する内容 |
| --- | --- |
| [CHANGELOG.md](../CHANGELOG.md) | 日付ごとの変更、理由、検証、push/deployの事実 |
| [2026-11-04〜11-09の変更履歴](history/2026-11-04-to-11-09-changelog.md) | CHANGELOGから移した2026-11-09以前の変更記録 |
| [docs/plans/](plans/) | 案件単位の設計、親レビュー、承認と実装結果 |
| [開発文書の整理前資料](history/2026-11-10-development-documents.md) | 2026-11-10より前のHANDOFF/DEVELOPMENT/BACKEND記述の保存版 |
| [ゲーム文書の整理前資料](history/2026-11-10-game-documents.md) | 2026-11-10より前のゲーム仕様・設計文書の保存版 |

historyは整理前の参考資料で、現行仕様や手順の正本ではありません。問い合わせや移行調査に必要な日付・節だけを見て、現在の正本と照合してください。
