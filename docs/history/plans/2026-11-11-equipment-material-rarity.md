# 装備と素材のレアリティ統一

- 状態：反映完了
- 設計版：v1
- 要求・背景：装備のレアリティ段階を素材と同じ4 ID・表示名へ揃え、各段階を色で区別する。従来どおり下位2段階の装備を店で購入できるようにする。
- 設計作成者（子）：/root/rarity_update

## 目的・受け入れ条件

- 武器・防具とも素材と共通の `common` / `uncommon` / `rare` / `legendary` を使い、表示名も素材と揃える。
- 旧装備段階を順序対応で移す：normal→common、rare→uncommon、epic→rare、legend→legendary。装備効果数は各段階に対応して0/1/2/3個を維持する。
- ショップは下位2段階（common / uncommon）のみ販売する。既存の販売品・価格を保ち、月鋼の剣と星守りの鎧はuncommonとして購入可能にする。上位2段階はドロップ専用とする。
- 素材・装備のレアリティ表示に同じ4色を使い、装備一覧、店の商品、詳細表示を含む関連表示で色と段階名を一致させる。
- 装備ID、能力値、追加効果、ドロップ抽選、v:2セーブ形式を維持し、既存の進行を失わない。

## 対象範囲

- 変更対象：`content/game.json`、`shared/content.js`、`shared/save.js`、`server/api.mjs`、`dist/bootstrap.js`、`dist/game.js`、`dist/party.js`、`dist/admin/admin.js`、`dist/index.html`、`dist/style.css`、`dist/workspace.css`、装備・互換・表示に関係する `tests/`。
- 同期生成物：`npm run content:sync` が作る `dist/data.generated.js`、`dist/data/game.json`、`dist/shared/`。直接編集しない。
- 更新文書：`docs/GAME_SPEC.md`、`docs/BACKEND.md`、`CHANGELOG.md`、本設計書の検証結果。
- 対象外：レアリティ別の数値再調整、装備ID・価格・効果の変更、セーブ形式更新、DB migration、ショップ品数・場所・ドロップ率の変更。

## 実装設計

- コンテンツ正本と管理UIの装備選択肢を新4 IDに揃え、ショップ検証では `common` / `uncommon` のgearだけを許可する。現行品の段階、追加効果数、候補、価格を順序対応で移す。表示名はコモン／アンコモン／レア／レジェンダリーとする。
- 装備表示へ既存素材の `.rarity.common` / `.uncommon` / `.rare` / `.legendary` 色を適用する。素材CSSを色の正本とし、旧装備専用色を統合する。装備一覧・店・詳細の段階ラベルに同じクラスを付ける。
- 新定義の `validate` は新4 IDと0/1/2/3個の効果数を厳格に検査する。旧公開定義・旧キャッシュ・戦闘中 `battleContent` は、入力を変更しないclone上で正規化してから検査・実行する。装備単位で `normal`→`common`、`epic`→`rare`、`legend`→`legendary`、`rare`かつ効果1個→`uncommon`、レアリティ・効果が両方ない旧装備→`common` とする。新 `rare` は効果2個なので旧 `rare` と識別できる。素材の `rare` は変換しない。
- APIからの公開データ取得、プレビュー、ブラウザの内容キャッシュ、保存された戦闘定義を正規化経路へ通す。既存の公開DB行は書き換えず、下書きへ複製するときは正規化したcloneを保存し、その後の新定義検証は厳格なままにする。IDを保存する既存セーブは変換不要で、固定装備定義から段階・効果を読み直す。DB migrationは不要。
- 復旧はアプリと同梱コンテンツを直前の版へ戻して再デプロイする。DB、公開定義raw行、セーブ形式は変更しないためデータ復旧操作は不要。

## 検証計画

- `tests/content.test.cjs`：新ID・段階別効果数・ショップ境界を検証し、旧4段階、旧 `rare` 1効果のみの定義、旧レアリティ省略定義がclone上で正規化され、入力と公開rawが不変であることを確認する。新定義の不正なID・効果数は拒否する。
- `tests/backend/api.test.mjs` と既存のゲームロジックテスト：公開/プレビュー/セーブ参照で旧定義が使えること、既存装備IDのセーブを保持すること、販売・装備・効果・ドロップの動作が維持されることを確認する。
- 関連E2EをPC幅とスマホ幅で操作し、下位2段階の購入、上位の販売拒否、一覧・店・詳細の色と表示名、状態の維持、console/pageerrorを確認する。表示スクリーンショットを両幅で目視する。実機スマートフォンは対象外。
- 承認後に関連ロジック/APIテスト、両viewportのE2E、変更JS構文、`git diff --check`、`npm run package:site` を実施する。

## 親エージェントのレビュー・承認記録

- v1・design-review-1・2026-11-11 16:00 JST・設計レビュー・適合・順序対応、下位2段階販売、rare重複の個数識別、raw不変と保存互換を確認。API経路を対象に含め、統合前は開発手順どおり全E2Eも実行する。
- v1・design-approve-1・2026-11-11 16:00 JST・設計承認・承認・条件なし。検証担当は子、親は差分と証跡のレビュー。
- v1・design-review-2・2026-11-11 16:20 JST・設計範囲更新レビュー・承認・親が `shared/save.js` の旧snapshot clone検証と `dist/index.html` のcache query更新を対象欄へ追加承認。仕様・受け入れ条件は不変。

- v1・implementation-review-1・2026-11-11 16:35 JST・実装レビュー・適合・全差分、旧IDと効果数の互換、販売境界、78/78結果、PCとスマホ幅のスクリーンショットを確認。
- v1・implementation-approve-1・2026-11-11 16:35 JST・実装承認・承認・条件なし。検証済み配信物をGitHub mainと既存Sitesへ反映する。

## 設計変更履歴

- v1：初版。装備段階を素材IDへ統一し、店売りは下位2段階を維持する。

## 実装・検証結果

- 受け入れ条件と結果：4段階のID・名称・色を素材と共通化し、common/uncommonの既存販売品を維持。旧公開定義・旧snapshotはclone上で正規化し、raw定義・入力・v:2セーブを変更しないことをテストで確認。
- 検証：`npm test` 成功。Playwright全E2E 78/78成功（Chromium、workers=1、約4分48秒）。デスクトップ／モバイルのショップ・装備詳細を目視し、console/pageerrorを監視。`node --check` 対象JS全件、`npm run format:check`、`git diff --check`、`npm run package:site` 成功。
- 画面確認：`/tmp/rarity-update-qa/mobile-uncommon-shop.png` と `/tmp/rarity-update-qa/mobile-legendary-detail.png` を目視し、表示崩れなし。実機スマートフォンは未確認。
- 成果物：`work/site.tar.gz` を生成（`npm run package:site`）。GitHub mainと既存Sitesへ反映済み。
- 設計との差異・未検証事項：なし（実機スマートフォンを除く）。
- push・デプロイ結果：GitHub `865ef6a774a723f53de8bd531254ea326f77584f` をmainへpush。Sitesソース `8b09410236c20ddbc35e2e1f8be81f237d2fa7f9`、デプロイ `appgdep_6af41aef79788191b5566aa258d43e79` 成功。所有者限定とD1バインディングを維持。Sites補助スクリプト未配置のため、認証を標準入力からメモリだけへ渡して通常Gitで同期。
