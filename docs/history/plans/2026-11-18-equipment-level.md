# 装備レベル

- 状態：反映完了（GitHubのみ、Sites未反映）
- 設計版：v1
- 要求・背景：武器にレアリティのほかレベルを付け、キャラクターのレベルが装備レベルに満たなければ装備できないようにする。
- 設計作成者：Claude Code

## 目的・受け入れ条件
- 全装備（武器・防具）が装備レベルを持ち、ショップ・もちもの一覧・装備詳細に表示される。
- 旅団の共通レベルが装備レベル以上のときだけ装着できる（ボタンの無効化に加え、処理側でも拒否）。
- 既存セーブの装着状態・進行を変えない。`level` を持たない旧公開定義でも動く。

## 対象範囲
- 変更：`content/game.json`（各装備の `level`）、`shared/content.js`（検証・旧定義の補完）、`shared/rules.js`（`gearLevel` / `canEquip`）、`dist/game.js`・`dist/party.js`（表示・装着判定）、`dist/workspace.css`、`dist/admin/admin.js`（項目名）、キャッシュ更新用クエリ、テスト。
- 関連文書：GAME_SPEC（装備表・装備レベルの節）、BACKEND（旧定義の補完）。
- 対象外：購入・ドロップの制限、セーブ形式の変更、DBマイグレーション。

## 実装設計
- 定義：ゲーム定義の装備に `level`（1〜`rules.growth.maxLevel` の整数）を追加。保存済み定義では省略できる。値は twig/cloth 1、iron/leather 3、moon 6、moonsteel_blade/starward_armor 8、star 10、eclipse_robe 12、starlight_blade 16。
- 互換性：`withJobs` で `level` がない装備に、同梱定義の同じIDの値か1を補う（clone上、レベル上限で丸める）。セーブは装備IDのままで形式 `v:2` は変えない。
- 判定：`GameRules.canEquip(state.lv, item)`。`equip` 処理は条件を満たさなければ状態を変えず、ログに「○○は旅団Lv.Nから装備できます。」を出す。
- 既存セーブで条件外の装備を着けている場合はそのまま維持し、効果も残す。外したあとは条件を満たすまで再装着できない。

## 検証計画
- ロジック：装備レベル値、未満/同値/超過の判定、仲間も共通レベルを使うこと、拒否時のログ、既存装着の維持、検証エラー、旧定義の補完と冪等性、上限での丸め。
- E2E（PC・スマホ相当幅）：新規 `equipment-level.spec.cjs` と、装備を扱う既存spec（equipment-rarity、command-timing、town）、統合前に全E2E。
- 反映・復旧：mainへpush。問題があれば該当commitをrevertする（セーブ形式は不変のため移行不要）。

## ユーザーと合意した方針
- 2026-11-18：対象は武器と防具の両方／条件は「装備Lv以上で装備可」／既存セーブの装着中の装備はそのまま／レベル値は上記の案。

## 設計変更履歴
- v1：初版

## 実装・検証結果
- `npm test`：成功（format check、定義・ロジック・パーティ操作・APIテスト）。
- 変更・追加したE2E（equipment-level、equipment-rarity、command-timing、town）：game-desktop・game-mobileとも10/10成功。スクリーンショット（スマホ相当幅の一覧・詳細）を目視。
- 全E2E：116/116成功（game/adminのPC・スマホ相当幅）。既存の不整合だった `field-status.spec.cjs` の期待値（会心率の行）も修正。
- 旧定義の補完：組み込み装備とIDが衝突する独自装備にはレベル1を補い、組み込み側（`_builtin`）は同梱値を使うことをロジックテストで確認。
- 未検証：iOS/Android実機。`npm run build`・`package:site` は画像配信に無関係のため未実行。Sitesへは未反映。
- push：GitHub mainへpush。
