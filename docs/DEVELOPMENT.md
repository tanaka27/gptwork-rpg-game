# 開発・検証・公開手順

開発ルールは[AGENTS.md](../AGENTS.md)、文書の入口と正本一覧は[文書索引](README.md)を参照してください。ここには現在使うコマンドと作業完了時の確認だけを記載します。

## 作業開始

作業前に作業ツリー、ブランチ、リモートの最新状態を確認し、既存の未コミット変更を保護します。共有ブランチではfetch後に対象リモートブランチと比較してから編集します。

```sh
git status --short --branch
git branch --show-current
git fetch origin
```

現行の共有ブランチは `main` です。差分が見つかったら、指示された対象ブランチの最新状態を基準に作業し、既存変更を巻き戻したり含めたりしないでください。

## 開発サーバー

Node.js 24以上とnpmを使います。依存関係を初めてセットアップするときは `npm ci` を実行します。

```sh
npm ci
npm run dev
```

`npm run dev` は `server/dev.mjs` を起動し、`127.0.0.1:4173` でフロントとNode/SQLite APIを配信します。通常のSQLiteファイルは `.local/rpg.sqlite` です。必要な場合は `PORT` と `RPG_DB_PATH` でローカル値を指定できます。ゲーム定義や共通ロジックを変更したときは `npm run content:sync` で `dist/data.generated.js`、`dist/data/game.json`、`dist/shared/` を更新します。これらのファイルは生成物です。

## テストとブラウザ検証

```sh
npm test
npm run test:e2e
```

`npm test` は `tests/content.test.cjs`、`tests/game.test.cjs`、`tests/party-control.test.cjs`、`tests/backend/api.test.mjs` の定義・ゲーム・パーティ操作・SQLite APIテストを実行します。変更に関係するチェックを選び、実施したものだけを報告してください。

`npm run test:e2e` はPlaywright設定に従い、`127.0.0.1:4173` へテスト専用のNode/SQLiteサーバーを起動します。DBは `work/playwright.sqlite` で、通常の開発DBと分離されています。既定でChromiumの1440×900と390×844を実行します。装備レアリティの購入・詳細・能力・勝利ドロップ確認は `tests/e2e/equipment-rarity.spec.cjs` にあります。Playwright付属Chromiumをセットアップする場合は `npx playwright install chromium` を使い、既存Chromiumを指定する場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` を設定します。実ブラウザでの確認が必須となる動作・表示変更の条件は[AGENTS.md](../AGENTS.md)に従い、PC幅とスマホ幅、操作後の状態、表示、console errorを確認します。スマホ幅の確認はiOS/Android実機確認と区別してください。

## コンテンツ検査、ビルド、パッケージ

`npm run content:check` は初期定義を検証します。`npm run content:sync` は定義と共通処理をフロント用に同期します。`npm run build` はWorker ESMと静的素材を `build/` に出力します。Sites用アーカイブが必要な場合は `npm run package:site` を使います。このコマンドはbuildも実行し、`work/site.tar.gz` に`.openai/hosting.json`、`dist/server/index.js`、`drizzle/`を含めます。パッケージが必要なときに別途buildを直前に繰り返さず、必要な出力に応じてコマンドを選びます。ビルドではcontent:syncも実行されます。静的ファイルだけを配置する旧公開方式は現行手順ではありません。公開に必要な成果物が手元にない場合はSitesスキルが求めるbuild/packageを作成し、利用可能な成果物がある場合は同じ配信物を再利用します。

スキーマ変更は `npm run db:generate` で新しいmigrationを作成し、適用済みSQLを変更しないでください。生成Workerの`build/`と `server/assets.generated.mjs` はビルド成果物で、編集対象ではありません。

## GitHubとSitesへの反映

作業ごとのGitHub pushと既存Sitesへの反映、担当分担、必要な承認は[AGENTS.md](../AGENTS.md)のルールに従います。Sites公開は、その時点のSitesスキルと利用可能なSitesツールを使い、既存Site project ID、D1バインディング、所有者限定の閲覧範囲を維持してください。GitHub側とSitesソース側は別のGit履歴として扱い、公開対象アプリとSitesソースの対応を記録してください。認証情報をファイル、コマンド、Git、ログへ保存しません。

Sitesの作業ヘルパーが利用できない環境の一時対応や環境固有のエラーは、常設手順へ追加せず、必要な場合にCHANGELOGまたは案件別の履歴へ記録します。固定の過去作業ディレクトリや認証方式へ依存しないでください。

## 作業完了

変更内容に対応する検証を記録し、未実施の確認を明示してください。Markdownを変更した場合は相対リンク、見出し、重複した説明、古い断定、表と本文の食い違いを確認します。検証担当がすでに同じコード・生成物のチェックを通していて、その後にコード差分がなければ、根拠なく同じチェックを重ねず結果を引き継ぎます。失敗、未解消事項、独立検証の必要など理由がある場合は、必要な範囲を検証してください。

テストやブラウザ検証、GitHub、Sitesの結果は[CHANGELOG.md](../CHANGELOG.md)または案件別の記録に残し、現行仕様・手順の正本へ日付ごとの結果を追記しないでください。文書のみの変更ではゲーム動作の再検証は不要です。アプリ公開物は同じ配信成果物を再利用します。必要な成果物が利用できない場合は公開に必要なbuild/packageを行います。
