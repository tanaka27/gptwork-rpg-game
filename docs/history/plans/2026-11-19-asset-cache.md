# 静的素材のキャッシュ（ETagと304）

- 状態：反映完了（GitHubのみ、Sites未反映）
- 設計版：v1
- 要求・背景：配信画像の調査で、Workerが画像に5分のキャッシュしか付けず、HTML・JS・CSSは `no-cache` なのに検証子（ETag）がないため、毎回全文を再取得していることが分かった（ユーザー要望で案Dとして対応）。
- 設計作成者：Claude Code

## 目的・受け入れ条件
- 変わっていない素材は、本文を送らずに304で済む。
- 画像は短時間なら再検証せずにブラウザのキャッシュから使う。差し替え後に古い画像が長く残らない。
- 404・405・HEAD・MIMEの挙動を変えない。

## 調査
- Sitesのキャッシュ方針の公式文書は見つからなかった。各SiteはCloudflare Workerで動くという第三者の解説がある（[flaviocopes.com](https://flaviocopes.com/chatgpt-sites/)、未確認）。設計は標準のHTTPキャッシュ（[MDN Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)）に基づく。
- `no-cache` は保存を許し、再利用の前に再検証を求める。検証子がなければ条件付きリクエストができず、全文の再取得になる（MDNは検証子の扱いを明記しておらず、この点は一般的なHTTPの知識による）。

## 実装設計
- `scripts/build.cjs`：配信内容のSHA-256（base64url先頭27文字）を強いETagとして各素材に保存。
- `server/static-assets.mjs`：`If-None-Match`（カンマ区切り・弱いETag・`*`）が一致すれば304（ETagとCache-Controlは付ける、本文なし）。base64の復号を素材ごとに1回にしてWorker内で再利用。
- キャッシュ方針：画像 `public, max-age=3600, stale-while-revalidate=86400`。画像のURLに版の番号がないため、長期キャッシュ（immutable）は使わない。HTML・JS・CSS は `no-cache` のまま（`?v=` の更新漏れで古いコードが残らないように）。
- `server/worker.mjs` は配信処理を `static-assets.mjs` へ移しただけで、経路は変更なし。開発サーバーは変更なし。

## 検証計画
- 単体テスト（`tests/backend/static-assets.test.mjs` を `npm test` に追加）、Worker素材検査、組み立てたWorkerを実ブラウザで2回読み込む確認。

## 親エージェントのレビュー・承認記録
- v1・user-1・2026-11-19・方針合意・案D（キャッシュ対応）を進めることを承認

## 設計変更履歴
- v1：初版

## 実装・検証結果
- `npm test` 成功（ETag・304・方針・HEAD・404・405・復号1回）。
- ImageMagick 6で版の確認だけを外した一時ビルドで `qa:worker-assets` 成功（全画像のETagと304、HTML・JS・CSSの304）。
- 組み立てたWorkerをNodeの小さなサーバーで動かし、Chromiumで2回読み込んだ。2回目はHTML・JS・CSS 15件がすべて304（本文0バイト）、画像はリクエストなしでブラウザのキャッシュから表示。pageerrorなし。
- 管理画面・クラウドのE2E（`backend.spec.cjs`、PC/スマホ相当）10件成功。開発サーバーはWorkerのコードを使わないため、ほかのE2Eは影響なし。
- 未確認：Sites（本番）でCDNなどが独自にヘッダーを変えるかどうか。Codexの公開後に、本番の応答ヘッダーで確認する。iOS/Android実機は未確認。
