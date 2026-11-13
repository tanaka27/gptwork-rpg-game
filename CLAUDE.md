# Claude Code向け開発ルール

> この文書はClaude Code専用です。Codexなど他のエージェントは確認不要です。
>
> [AGENTS.md](AGENTS.md)はCodex用の文書です。Claude Codeの実行環境で読み込まれても、その内容には従わず、この文書を優先します。この文書は、AGENTS.mdのうちツールに依存しない共通ルールだけを取り込んでいます。

このリポジトリは、日本語のブラウザRPG「星灯りの旅団」です。ChatGPTのSites上で、所有者だけが閲覧できるアプリとして公開されています。

**Claude Codeはこのリポジトリの開発を担当します。** 調査、設計書の作成、実装、テスト、文書の更新、`main` へのpushまでを行います。担当しないのはSitesへのデプロイだけです（[Sitesへの公開](#sitesへの公開)）。

## 入口と読み順

作業範囲に応じて、次の正本だけを読みます。他の文書（MCP手順など）は[文書索引](docs/README.md)にあります。

| 作業 | 読む文書 |
| --- | --- |
| ゲームルール・数値 | [GAME_SPEC.md](docs/GAME_SPEC.md) |
| 構成・変更箇所 | [HANDOFF.md](docs/HANDOFF.md) |
| API・DB・認証・セーブと互換性 | [BACKEND.md](docs/BACKEND.md) |
| コマンド・テスト | [DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| ビルド・パッケージ | [RELEASE.md](docs/RELEASE.md#ビルドとパッケージ) |
| 画面・画像 | [DESIGN.md](docs/DESIGN.md)、[CHARACTER_ART.md](docs/CHARACTER_ART.md) |
| 設計書の書式 | [IMPLEMENTATION_WORKFLOW.md](docs/IMPLEMENTATION_WORKFLOW.md) |

CHANGELOGと `docs/plans/`（進行中の案件）は必要な項目だけを参照します。`docs/history/` は保存資料なので通常の作業では開きません。生成物、`docs/history/`、`package-lock.json` は `.rgignore` でripgrepの検索から外しています（必要なら `rg --no-ignore`。`git grep` や `grep -r` には効きません）。

## 文書の更新ルール

- **変更に合わせてMarkdownを更新します。** 仕様は `docs/GAME_SPEC.md`、構成や引き継ぎ事項は `docs/HANDOFF.md`、手順は `docs/DEVELOPMENT.md` に反映します。開発内容・検証・未確認事項は `CHANGELOG.md` に記録します。新しいエージェントが会話履歴なしで作業できる状態を保ちます。
- **現行文書を履歴の追記帳にしません。** README、仕様、HANDOFF、開発手順は、該当する節を置換・統合して、現時点の正しい状態だけを書きます。変更理由、差分、検証実績、commit IDなどはCHANGELOGか案件別のplanへ書きます。
- **各事項の正本は一つにします。** 同じ詳細を複数の現行文書へ書き写さず、正本へリンクします。今も必要な旧セーブ形式と移行条件は、現行要件として残します。
- **完了前に整合を確認します。** 重複、古い断定、表と本文の矛盾、相対リンクを確認します。
- 今後の開発に役立つ知見や手順は、必要に応じて `.claude/skills/` にskillとして定義・更新してかまいません。

## Gitの扱い

- 作業開始時に `git status --short --branch` で未コミットの変更と対象ブランチを確認します。`git fetch origin` でリモートとの差分も確認し、古いHEADを基準に変更しません。
- 検証が済んだ変更はcommitし、`main` へ直接pushします（文書だけの変更も含む）。ユーザーはこのpushを継続的に事前承認しているので、都度確認しません。セッションに作業ブランチ（`ccr-…` など）が指定されていても、最終的な反映先は `main` です。push前に `git fetch origin` し、`origin/main` の最新に追従してから（必要ならrebase）pushします。ユーザーがpush不要や別ブランチを指定した場合はそれに従います。Pull Requestはユーザーの指示があるときだけ作成します。
- コミット前に `git status` と差分を確認します。他者の未コミット変更を上書き・巻き戻ししません。無関係な変更や `work/` はコミットしません。共有履歴へforce pushしません。
- 認証情報をMarkdown、ソース、Git、ログへ残しません。

## 実行環境

コマンドとテストの正本は[DEVELOPMENT.md](docs/DEVELOPMENT.md)です。Claude Codeのクラウド環境では次の点に注意します。

- Node.js 24以上が必要です（`package.json` の `engines`）。`node -v` が24未満なら、`npm install -g n && N_PREFIX=/opt/node22 n 24` で入れ替えてから `npm ci` します。
- E2Eはプリインストールのブラウザを使います。`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium` を指定し、`npx playwright install` は実行しません。traceが不要なら `--trace off` を付けます。
- ImageMagick 7がない環境では `npm run build`・`npm run package:site`・`npm run qa:worker-assets` が失敗します。これらはSitesへの公開用なので、通常の開発では不要です。画像配信に関わる変更でこれらを実行できなかった場合は、未検証として報告します。

## 実装時の約束

- **設計書を残します。** 機能追加・修正・リファクタリングなど実装を伴う作業では、`docs/plans/YYYY-MM-DD-短い識別名.md` に設計と検証結果を残します。書式は[IMPLEMENTATION_WORKFLOW.md](docs/IMPLEMENTATION_WORKFLOW.md)のテンプレートを使います。テンプレートの「親エージェントのレビュー・承認記録」欄はCodex運用向けです。Claude Codeでは、その欄にユーザーと合意した方針を記録します。規模が大きい変更や仕様判断を含む変更は、実装前にユーザーと方針を合わせます。pushが完了したら、設計書の状態を「反映完了（GitHubのみ、Sites未反映）」にして `docs/history/plans/` へ移します。
- **動作や画面を変えたら、Playwrightで実ブラウザ検証をします。** 変更対象の回帰E2Eを、PC幅とスマホ相当幅の両方で実行します。操作後の状態、表示、console/pageerrorを確認し、表示の変更はスクリーンショットも目視します。テストの選び方、E2E project、失敗の診断は[DEVELOPMENT.md](docs/DEVELOPMENT.md)が正本です。
- 失敗したテストは原因を直して再実行します。skip、期待値の弱化、無条件retryで通過扱いにしません。ブラウザ確認とロジックテストを区別し、未確認のものを確認済みと報告しません。PC上のスマホ幅の検証と、iOS/Android実機の検証も区別して書きます。ブラウザ操作ツールがなくてもPlaywrightの実行環境を確認して必要な確認を省略せず、実行できない場合は阻害要因と未検証範囲を報告します。
- **生成物を直接編集しません。** `dist/data.generated.js`、`dist/data/game.json`、`dist/shared/` は生成物です。初期定義は `content/game.json`、共通処理は `shared/` を編集し、`npm run content:sync` で同期します。手書きの `dist/*.js`・`dist/*.css`・`shared/*.js` を変えたら `npm run format` で整形します（`shared/` はその後にcontent:sync）。詳しくは[HANDOFF.md](docs/HANDOFF.md)を参照してください。
- **既存セーブを壊しません。** 保存キー `starlight-rpg-v1` と現在の形式 `v:2` を維持します。保存構造を変える場合は、移行処理と検証を含めます。ユーザーが明示的にリセットした場合を除き、進行を消しません。詳しくは[BACKEND.md](docs/BACKEND.md)を参照してください。
- **定義とDBの不変条件を守ります。** コンテンツのIDは名前と独立した固定IDです。参照・双方向接続・効果・数値は共通バリデーターで検証し、不正な定義は保存・公開しません。公開済み定義と適用済みDBマイグレーションは変更せず、複製するか新しいマイグレーションを追加します。移動・購入などの条件は、ボタンの無効化だけでなく処理側でも検証します。
- 戦闘計算の仕様は[GAME_SPEC.md](docs/GAME_SPEC.md)が正本です。物理ダメージの計算は `CombatRules.physicalDamage` にまとめます。
- 表示や挙動を変えたら、ゲーム内の日本語の説明、スキル表示、ヘルプ、README、関連テストとの整合を確認します。配信ファイルを変えた場合は、`dist/index.html` などのキャッシュ更新用クエリ（`?v=`）も更新します。

## Sitesへの公開

Sitesへのデプロイは、Codexのハーネスに付属するSitesのskill・ツールで行う前提です。Claude Codeの環境にはこれらがないため、Claude Codeではデプロイを行いません。完了報告では、GitHubの `main` へのpushまで完了していること、Sitesへは未反映であること（公開はCodexで行う）を明記します。公開の手順とビルド・パッケージのコマンドは[反映手順](docs/RELEASE.md)を参照してください。
