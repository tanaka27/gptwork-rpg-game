# 開発引き継ぎ

この文書は現在の構成、正本、変更箇所、保存互換性、既知の制約を示します。文書全体の入口は[文書索引](README.md)、数値やゲームルールは[ゲーム仕様](GAME_SPEC.md)、APIとDBは[バックエンド仕様](BACKEND.md)、実行・テストは[開発手順](DEVELOPMENT.md)、ビルド・公開は[反映手順](RELEASE.md)を参照してください。

## 現行構成

- フロントは `dist/` のHTML/CSS/JavaScriptです（敵や地図のSVGは `dist/game.js` 内で生成）。`dist/data.generated.js`、`dist/data/game.json`、`dist/shared/` は生成物で、初期定義は `content/game.json`、共通処理は `shared/` にあります。
- `dist/bootstrap.js` が公開・同梱・キャッシュ・戦闘中の定義を選び、`storage.js`、`combat.js`、`game.js`、`party.js`、`cloud-save.js` を起動します。
- `server/api.mjs` はNode開発環境と本番Workerで共有するAPIです。開発環境はNode.js 24とSQLite、本番はWorker ESMとD1を使います。詳細は[BACKEND.md](BACKEND.md)を正本とします。
- 初期定義は同梱JSON、公開中の定義はD1の公開版が正本です。編集・プレビューは管理画面/APIを通します。同期や公開版の詳細は[バックエンド仕様](BACKEND.md)を参照してください。

## 変更箇所の地図

| 変更内容 | 主な正本 |
| --- | --- |
| 世界、人物、敵、装備レアリティ・追加効果、道具、習得条件などの初期定義 | `content/game.json`、[GAME_SPEC.md](GAME_SPEC.md) |
| 画面、状態遷移、操作 | `dist/game.js`、`dist/party.js`、`dist/bootstrap.js` |
| 戦闘計算 | `shared/rules.js`、`dist/combat.js` |
| レイアウトと画面装飾 | `dist/workspace.css`、`dist/style.css`、[DESIGN.md](DESIGN.md) |
| 定義・セーブの検証とゲーム計算 | `shared/content.js`、`shared/save.js`、`shared/rules.js`、`shared/quests.js`、`shared/adventurers.js` |
| API、DB、Worker | `server/`、`db/`、`drizzle/`、[BACKEND.md](BACKEND.md) |
| 定義同期と公開用ビルド | `scripts/`、[RELEASE.md](RELEASE.md#ビルドとパッケージ) |
| ロジック/API/ブラウザ検証 | `tests/` |

## 保存と互換性

- 保存キー `starlight-rpg-v1`・形式 `v:2`、旧 `v:1` からの移行、装備・`battleContent` の互換条件は[BACKEND.md](BACKEND.md#セーブと互換性)が正本です。保存構造を変えるときは、移行と既存データの保持を検証してください。
- ブラウザの保存はオリジン単位です。クラウドへの保存・復元は利用者の明示操作だけで行い、自動同期はありません。

## 既知の制約

- 本番APIと定義管理はSitesで認証された所有者だけが利用できます。Site identity、D1バインディング、閲覧範囲を保ち、認証情報を文書やソースに記載しないでください。
- モバイル幅のPlaywright検証はPC上のChromiumです。iOS/Android実機の確認とは別です。
- 実行コマンドは[DEVELOPMENT.md](DEVELOPMENT.md)、ビルド・公開は[RELEASE.md](RELEASE.md)、過去の検証結果や公開記録は[CHANGELOG.md](../CHANGELOG.md)を参照してください。
