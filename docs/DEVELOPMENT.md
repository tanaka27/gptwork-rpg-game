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
npm run qa:e2e-fixtures
```

`npm test` は `tests/content.test.cjs`、`tests/game.test.cjs`、`tests/party-control.test.cjs`、`tests/backend/api.test.mjs` の定義・ゲーム・パーティ操作・SQLite APIテストを実行します。操作や画面の回帰は `@playwright/test` の `npm run test:e2e` を使います。この2つは目的が異なり、片方の成功で他方を確認済みと扱いません。

### どのテストを選ぶか

| 変更 | まず実行する範囲 | 追加で確認すること |
| --- | --- | --- |
| 定義・計算・セーブ検証 | `npm test` と変更した層の既存テスト | 保存形式・移行・旧定義が関係すれば対応するAPI/E2Eケース |
| API・SQLite・管理画面・クラウド保存 | APIテストと `tests/e2e/backend.spec.cjs` | 管理UIに変更があればadminのdesktop/mobile両project |
| ゲーム画面・操作 | 変更した `tests/e2e/*.spec.cjs` | gameのdesktop/mobile両projectで操作後の状態・画面・consoleを確認 |
| レイアウト・意味構造・非ボタンの当たり判定 | 関係する画面E2Eと、必要なら `qa:mcp`（[手順](PLAYWRIGHT_MCP.md)） | semantic snapshotはrole/name/refで操作。accessibility treeにないhit areaだけvision座標で操作し、画像と操作後snapshotを確認 |
| 起動、共通fixture、保存、共有UI/CSS、Playwright設定 | `npm test` を含む関連logic/APIと `npm run test:e2e` 全体 | console fixture、desktop/mobile両方、管理系DB分離を含めて回帰 |
| 文書だけ | Markdownのリンク・相対参照・記述整合 | ゲーム動作の再検証は不要 |

変更specだけを両viewportで先に実行し、統合前に全E2Eを実行します。対象specを選ぶ例は次のとおりです。

```sh
npm run test:e2e -- --project=game-desktop tests/e2e/game.spec.cjs
npm run test:e2e -- --project=game-mobile tests/e2e/game.spec.cjs
npm run test:e2e -- --project=admin-desktop tests/e2e/backend.spec.cjs
npm run test:e2e -- --project=admin-mobile tests/e2e/backend.spec.cjs
```

画面に見える名前や役割は `getByRole` / `getByLabel` 等のsemantic locatorを優先し、動的な状態はPlaywrightのweb-first assertionで待ちます。製品関数を直呼びする `page.evaluate` は、操作の代用にせず、再現用の初期状態準備や読み取りに使います。固定sleepは状態をassertできないCSS演出などに限り、理由をテスト内に残します。テスト生成・修復時も、失敗した操作をskipしたり、期待を弱めたり、無条件retryで通過扱いにしません。

### E2Eサーバーと診断

`npm run test:e2e` は一回の実行ごとに新しいSQLiteを `work/playwright/<run>/` に作り、開発DB・別runから状態を分離します。gameと管理APIの書込みを分けるため、設定は4つのprojectを使います。`game-desktop` / `game-mobile` はゲームspecだけを、`admin-desktop` / `admin-mobile` は管理・クラウドAPIを変更する `backend.spec.cjs` だけを実行します。各projectは別のlocalhost portとSQLiteを使い、backend specは各viewport内でserialのままです。4 projectはdesktop 1440×900とmobile相当390×844の2 viewportを保ちます。mobileはPC上のChromiumによる幅の確認で、iOS/Android実機確認とは別です。

テスト用のChromiumは `npx playwright install chromium` で準備します。利用可能なChromiumを使うときは `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` に実行ファイルを指定します。`trace: retain-on-failure`、失敗時のscreenshot、HTML reportを診断に使い、project・viewport・専用DB・seedや初期saveを確認して失敗を再現します。`tests/e2e/fixtures.cjs` は各contextのconsole error/pageerrorを検査し、現在のproject origin以外への通信を止めます。許可するconsole失敗は意図して止めるGoogle Fonts CSSの正確なrequestと、個別に宣言したオフラインAPI requestだけです。未知の `net::ERR_FAILED` を文字列だけで無視しません。`npm run qa:e2e-fixtures` はこの許可条件の正常系と、未知console/pageerrorを失敗にする負例を子Playwright runnerで確認し、証跡を `work/playwright-fixture-probe/` に保存します。

一部specには以前からの個別console/pageerror listenerも残っています。これらはケース内の補助診断です。合否を決めるのは共通fixtureで、個別listenerの広い `net::ERR_FAILED` 条件が未知エラーを許可することはありません。

### Playwright MCPによる探索

継続セッションでの探索やaccessibility snapshotの確認に `npm run qa:mcp` を使う場合は、[Playwright MCPの手順](PLAYWRIGHT_MCP.md)を読みます。MCPは探索用で、回帰E2Eの代わりにはしません。

## コンテンツ検査、ビルド、パッケージ

`npm run content:check` は初期定義を検証します。`npm run content:sync` は定義と共通処理をフロント用に同期します。`npm run build` はWorker ESMと静的素材を `build/` に出力します。Sites用アーカイブが必要な場合は `npm run package:site` を使います。このコマンドはbuildも実行し、`work/site.tar.gz` に`.openai/hosting.json`、`dist/server/index.js`、`drizzle/`を含めます。パッケージが必要なときに別途buildを直前に繰り返さず、必要な出力に応じてコマンドを選びます。ビルドではcontent:syncも実行されます。静的ファイルだけを配置する旧公開方式は現行手順ではありません。公開に必要な成果物が手元にない場合はSitesスキルが求めるbuild/packageを作成し、利用可能な成果物がある場合は同じ配信物を再利用します。

スキーマ変更は `npm run db:generate` で新しいmigrationを作成し、適用済みSQLを変更しないでください。生成Workerの`build/`と `server/assets.generated.mjs` はビルド成果物で、編集対象ではありません。

## GitHubとSitesへの反映

作業ごとのGitHub pushと既存Sitesへの反映、担当分担、必要な承認は[AGENTS.md](../AGENTS.md)のルールに従います。Sites公開は、その時点のSitesスキルと利用可能なSitesツールを使い、既存Site project ID、D1バインディング、所有者限定の閲覧範囲を維持してください。GitHub側とSitesソース側は別のGit履歴として扱い、公開対象アプリとSitesソースの対応を記録してください。認証情報をファイル、コマンド、Git、ログへ保存しません。

Sitesの作業ヘルパーが利用できない環境の一時対応や環境固有のエラーは、常設手順へ追加せず、必要な場合にCHANGELOGまたは案件別の履歴へ記録します。固定の過去作業ディレクトリや認証方式へ依存しないでください。

## 作業完了

変更内容に対応する検証を記録し、未実施の確認を明示してください。Markdownを変更した場合は相対リンク、見出し、重複した説明、古い断定、表と本文の食い違いを確認します。検証担当がすでに同じコード・生成物のチェックを通していて、その後にコード差分がなければ、根拠なく同じチェックを重ねず結果を引き継ぎます。失敗、未解消事項、独立検証の必要など理由がある場合は、必要な範囲を検証してください。

テストやブラウザ検証、GitHub、Sitesの結果は[CHANGELOG.md](../CHANGELOG.md)または案件別の記録に残し、現行仕様・手順の正本へ日付ごとの結果を追記しないでください。文書のみの変更ではゲーム動作の再検証は不要です。アプリ公開物は同じ配信成果物を再利用します。必要な成果物が利用できない場合は公開に必要なbuild/packageを行います。
