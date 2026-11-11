# Playwright MCPによる探索

Playwright MCPで実ブラウザを探索するときだけ読む手順です。通常のテスト選択とE2Eは[開発・検証手順](DEVELOPMENT.md)を正本とします。MCPによる探索やスクリーンショットの目視は、回帰E2Eの代わりではなく、画像の自動合否判定でもありません。

## 使う場面

仕様のあいまいな導線、アクセシビリティsnapshot、semanticでない操作対象（accessibility treeに出ない当たり判定）を、継続セッションで探索するときに使います。

`@playwright/mcp` と `@modelcontextprotocol/sdk` はlockfileでバージョンを固定しています。MCP packageが依存するPlaywrightは、回帰E2Eの `@playwright/test` とは別のバージョンなので、Test runner APIが同一とは扱いません。Chromium実行ファイルを指定した場合は、実際に使ったpathとversionを記録します。

## 起動

MCP clientはローカルのNode/SQLite serverと専用の一時ブラウザprofileを起動し、originをそのserverだけに制限します。既定のportは4177、viewportは1440×900です。stdinを開いたまま対話できるterminal/PTYで起動します。`--caps=vision` を指定したセッションだけ、座標で操作するtoolが有効になります。

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<Chromiumの実行ファイル> npm run qa:mcp -- --port 4177 --viewport 1440x900 --caps=vision
```

## 操作

clientは起動時に `tools/list` を表示し、stdinから1行ずつJSONLでtool callを受け取ります。ページ操作は `browser_snapshot` とsnapshotのrefを基本にし、vision座標はsnapshotにない要素だけに使います。

```jsonl
{"tool":"browser_navigate","arguments":{"url":"http://127.0.0.1:4177/"}}
{"tool":"browser_snapshot","arguments":{}}
{"command":"quit"}
```

- EOFでも正常終了します。toolの `isError: true`、不正なJSON、接続・起動の失敗は、セッションを失敗として終了します。
- 診断ログは `work/playwright-mcp/<session>/session.jsonl`、画像は同じsessionの `output/` に保存されます。ユーザーのhomeへは書きません。
- `browser_take_screenshot` の `filename` に相対パスを渡すとclientの作業directory基準になるため、sessionの `output/` を指す絶対パスで指定します。
- vision座標はPC上のChromiumに対するCSS pixelです。スマートフォン実機の結果とは区別します。
