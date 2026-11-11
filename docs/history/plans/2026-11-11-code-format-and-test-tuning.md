# 手書きコードの整形とテスト運用の調整

- 状態：反映完了（GitHubのみ、Sites未反映）
- 設計版：v1
- 要求・背景：1行に詰まったコードは部分的に読めず、エージェントが変更のたびにファイル全体（約21,000トークン）を読んでいる。E2E本体の分割、CI時のretry、`npm test` の冗長な出力も、コンテキスト消費とルールとの食い違いの原因になっている。
- 設計作成者：Claude Code

## 目的・受け入れ条件
- 手書きのクライアントJS・CSSと `shared/` を、挙動を変えずに1文・1宣言単位の行へ整形する。esbuildでminifyした結果が整形前後で一致する。
- `tests/e2e/game.spec.cjs` を機能別に分割する。テスト名・本文は変えず、全E2Eの結果は分割前と同じ。
- E2Eのretryを0に固定する。
- `npm test` のAPIテストを簡潔な出力にする。失敗時の詳細と終了コードは残す。

## 対象範囲
- 整形：`dist/{bootstrap,cloud-save,combat,game,party,storage}.js`、`dist/{style,workspace}.css`、`shared/{content,rules,save}.js`（`npm run content:sync` で `dist/shared/` へ同期）。Prettier 3.6.2を固定版でdevDependencyに追加し、`npm run format`・`format:check`、`.prettierrc.json`・`.prettierignore` を用意する。`npm test` の先頭で整形を確認する。
- 分割：`tests/e2e/game.spec.cjs` を `game-screens`・`town`・`battle-flow`・`skill-select`・`travel` の各specへ分ける。
- 設定：`playwright.config.cjs` の `retries`、`package.json` の `test`。
- 関連文書：DEVELOPMENT、AGENTS、CLAUDE。
- 対象外：`dist/index.html`、`server/`、テストコードの整形、旧セーブの賢さ補完（+6）の修正。

## 実装設計
- 変更内容：Prettier（printWidth 120、シングルクォート）で整形する。読み込み元のキャッシュ更新用クエリ（`index.html` と `bootstrap.js` の `?v=`）を上げる。
- 既存セーブ・公開済み定義との互換性と移行：コードの意味が変わらないので、影響はない。
- 異常系・リスクと対策：整形で意味が変わる可能性は、minify結果の一致で確認する。進行中の他ブランチとの競合は、リモートに `main` 以外の作業ブランチがないことを確認済み。

## 検証計画
- 受け入れ条件ごとの確認方法：minify結果の比較、`npm test`、全E2E（game/admin、desktop/mobile）を変更前後で比較する。
- 対象外の検証と理由：iOS/Android実機（環境なし）、Sites（Claude Codeは反映しない）。
- 反映・復旧方法：GitHubへpushする。問題があればこのcommitをrevertする。

## 親エージェントのレビュー・承認記録
- v1・user-1・2026-11-11・方針合意・承認・ユーザーが4項目の適切性を確認したうえでの実施を依頼

## 設計変更履歴
- v1：初版

## 実装・検証結果
- 受け入れ条件と結果：JSの9ファイルはesbuild minify結果が整形前後で一致。CSSの差は独自プロパティ値と `var()` 代替値の前の空白だけ（意味は同じ）。分割後の13テストは本文が元と一致。`npm test` 成功。全E2Eは変更前78/78、変更後78/78成功（Node 22、`/opt/pw-browsers/chromium`、workers 4）。PC・スマホ幅の戦闘画面のスクリーンショットを目視確認。
- 設計との差異・未検証事項：ロジックテスト2件（`tests/game/boot.cjs`、`tests/party-control.test.cjs`）が `party.js` を文字列置換で書き換えていたため、整形の差に左右されない正規表現に替え、一致しなければ失敗させるようにした。HTMLテンプレート・SVGの文字列（game.js 11行、party.js 11行）は長い行のまま。Node 24とiOS/Android実機は未確認。
- push・デプロイ結果：GitHubへpush。Sitesは未反映（Claude Codeの環境にSitesツールがないため）。
