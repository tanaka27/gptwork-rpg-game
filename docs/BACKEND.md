# データ中心のRPG基盤

利用者1人を想定。既存のHTML/CSS/JSの画面と戦闘のクリック送りを維持し、定義・計算・保存を分離する。

## 正本と構成

- `content/game.json`：初期定義。全レコードに固定ID。初回DB未公開時と静的配信のフォールバック。
- `shared/content.js`：ID重複、参照、双方向接続、数値、効果、HTML混入の検証と旧UI向け変換。
- `shared/rules.js`：能力・敵生成・ドロップ・道中抽選・効果量の純粋関数。乱数を注入して検証可能。
- `shared/save.js`：クラウドへ取り込むセーブの検証。
- `dist/game.js`, `dist/party.js`：入力・画面・行動の進行制御。ゲーム処理の全部をサーバーへ移すものではない。
- `server/api.mjs`：定義・公開版・セーブAPI。ローカル/本番で同じコード。
- `server/local-db.mjs`：Node.js 24のSQLiteをD1と同じインターフェースで使用。
- `server/worker.mjs`：本番Worker。ESMスターターの構成を拡張し、静的素材もWorker内へ埋め込む。
- `dist/admin/`：所有者向け定義編集。個別のフォーム、参照先の選択、効果の編集、検索、複製、削除検証。
- `db/schema.ts`, `drizzle/`：Drizzleのスキーマと生成済みSQL/メタデータ。

DB公開後は、公開版がゲーム定義の正本になる。JSONは初期値またはエクスポート/インポート用で、GitのJSON編集がDB公開版を上書きすることはない。ソース変更時はcontent:syncで生成物を揃える。

## DB

| テーブル | 用途 |
| --- | --- |
| content_versions | 定義全体のスナップショット。下書きはrevisionで競合検出、公開後は不変 |
| app_settings | 現在の公開版ID |
| saves | 所有者の進行JSONと更新番号 |
| save_history | 更新前のクラウドセーブ。不変のバックアップ |

定義は関連をIDで表すJSON集約として保存する。定義ごとのテーブルへの分割は今後の検索要件に応じて実施できる。公開の切替はDB batchで処理し、現在のクラウドセーブが参照するデータを無効にする公開を拒否する。

## 認証・API

本番はSitesが注入するoai-authenticated-user-idと、環境変数OWNER_IDを照合する。APIは匿名・他人を拒否し、書き込みは同一Originも確認する。サービスアクセス用トークンは利用者IDの代わりにしない。認証情報をブラウザへ渡さない。

ローカル開発サーバーだけは127.0.0.1に限定しlocal-ownerを注入する。本番Workerにこの処理を含めない。

- GET /api/content：公開版（初回は同梱定義）
- GET /api/admin/versions：版一覧
- POST /api/admin/drafts：公開版の複製またはJSON取り込み
- GET/PUT /api/admin/versions/:id：取得・下書き更新
- POST /api/admin/versions/:id/validate：検証
- POST /api/admin/versions/:id/publish：公開/旧版への切替
- GET /api/admin/preview?version=:id：プレビュー用定義
- GET /api/admin/export：公開JSON
- GET/PUT /api/save：取得/明示的な保存。PUTはrevisionの一致が必要
- GET /api/save/history と /api/save/history/:id：バックアップ一覧/内容

クラウドは手動バックアップ・復元。ブラウザの自動保存は維持する。同じ更新番号による再送/競合は409となり、二重適用しない。更新前データの履歴作成と更新はトランザクションで実行する。

## 互換性と表示

保存キーstarlight-rpg-v1、形式v:2を維持する。仲間はcharacterIdを補い、エリア討伐数と解放はzoneIdsで並び替えに対応する。古いv1/v2は従来の移行処理を使用する。移行時に旧進行を勝手に消さない。

戦闘開始時に定義のスナップショットをセーブへ含め、戦闘終了後の確定保存で外す。APIの公開版は起動時に取得し、起動後やクリック待ち中に差し替えない。画面は従来の行動開始→クリック→結果→クリックの順で進める。

定義のプレビューは別キーへ保存し、通常キー・クラウド進行を更新しない。取得済みの公開定義はブラウザへキャッシュする。必要なIDが手元にない場合は進行の初期化ではなく、読み込みを停止する。

## 開発・運用

Node.js 24以上。npm ci → npm run content:sync → npm run dev。

npm testはデータ検証・既存ゲーム・実SQLiteのAPIテスト。npm run test:e2eは実ブラウザでゲームと編集/公開/クラウド復元を検証する。E2EのDBはwork/playwright.sqliteで、通常の.local/rpg.sqliteと分離。

スキーマ変更時はnpm run db:generateを実行し、SQLとDrizzleメタデータをレビューしてコミットする。データの投入はAPIで行い、スキーマのマイグレーションへ混ぜない。適用済みSQLは編集しない。ローカルは起動時に未適用分を処理する。本番はSites公開時に適用する。

npm run buildでWorkerアーカイブを作る。既存Site IDと所有者限定の閲覧範囲を維持し、OWNER_IDをSites環境変数へ設定する。.openai/hosting.jsonのd1を文字列"DB"として宣言する（オブジェクト形式ではない）。画像は既存の見た目を保つため元のPNGを埋め込み、生成Workerは約9.6MB。将来画像が増える場合はR2などの素材配信へ分離する。

現在の表示は初期隊列4人・敵最大4体を維持。新しい属性/状態異常などの効果種類は共通効果処理を追加して拡張する。定義の追加だけで未対応の効果が実装されるわけではない。独立したキャラクター別レベルやリアルタイム対戦は今回の対象外。
