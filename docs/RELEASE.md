# 反映手順（commit・push・Sitesデプロイ）

作業の最後に反映を担当するエージェントが読む手順です。担当（Codexでは親）と事前承認はエージェント別ルール（[AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md)）に従います。実装・テストだけを担当するエージェントは読む必要はありません。

## GitHubへのpush

- 作業ごとに、文書だけの変更も含めてcommitし、`https://github.com/tanaka27/gptwork-rpg-game.git` の `main` へpushします。別ブランチを指定された場合はその指定に従います。
- ツール・実行環境が必須とする承認手続きには従います。

## Sitesへのデプロイ

- push後、検証済みのGitHub正本と同じアプリファイルを既存Siteへ反映し、デプロイの成功を確認してから完了とします。アプリファイルに変更がない場合は、同じ配信内容を再デプロイします。
- Sitesスキルと現時点のツール手順に従い、既存のSite project ID、D1バインディング、所有者限定の閲覧範囲を維持します。Site project IDとD1バインディングは[`.openai/hosting.json`](../.openai/hosting.json)が設定元です。
- GitHub側とSitesソース側は別のGit履歴として扱い、公開対象アプリとSitesソースの対応を記録します。
- **反映記録だけのcommitは再デプロイ不要です。** デプロイIDはデプロイ後にしか分からないため、CHANGELOGや設計書へ反映結果（commit・デプロイID）だけを追記するcommitを別に作って構いません。このcommitはアプリファイルを変えないので、pushだけ行い、再デプロイはしません。
- Sitesの作業ヘルパーが使えない環境での一時対応や環境固有のエラーは、この手順へ追加せず、必要ならCHANGELOGか案件の記録に書きます。

## ビルドとパッケージ

- `npm run build` はWorker ESMと静的素材を `build/` に出力します（content:syncも実行されます）。
- Sites用アーカイブが必要な場合は `npm run package:site` を使います。buildも実行し、`work/site.tar.gz` に `.openai/hosting.json`、Worker（`build/server/` をアーカイブ内の `dist/server/` として格納）、`drizzle/` を含めます。直前に別途buildを繰り返しません。
- 利用可能な成果物があれば同じ配信物を再利用し、手元にない場合だけ作成します。静的ファイルだけを配置する旧公開方式は使いません。
- `build/` と `server/assets.generated.mjs` はビルド成果物で、編集・コミットしません。

## 失敗したとき

pushやデプロイが失敗したら完了扱いにせず、原因、完了した範囲、未反映の範囲を報告します。認証情報をファイル、コマンド、Git、ログへ残しません。
