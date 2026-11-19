# バックエンド仕様

この文書は現在のデータ正本、DB、認証、API、保存の流れを説明します。起動・テストは[DEVELOPMENT.md](DEVELOPMENT.md)、ビルド・公開は[RELEASE.md](RELEASE.md)を、構成の入口は[HANDOFF.md](HANDOFF.md)を参照してください。

## データの正本と構成

- `content/game.json` は初期定義とbundled fallbackです。`shared/content.js` が定義を検証し、`shared/rules.js` がゲーム計算を行います。
- `dist/data.generated.js`、`dist/data/game.json`、`dist/shared/` は `npm run content:sync` が生成します。生成物を直接編集せず、`content/` と `shared/` を変更してください。
- DBで公開版が選ばれている場合、その版がゲーム定義の正本です。公開先は `app_settings.active_content` と `content_versions` で管理します。bundledを選んでいる場合、または公開設定がない場合は同梱定義を使います。
- `GET /api/content` は公開中またはbundled定義のcloneへ `GameContent.withJobs` の後方互換補完を適用して返します。`dist/bootstrap.js` は受け取った定義を検証・キャッシュし、冪等な互換補完を実行します。通常取得に失敗した場合は検証済みキャッシュ、次に同梱定義を使います。ゲーム側のUI形式への変換は `GameContent.legacy` が行います。
- プレビューは指定版を取得できなければ通常進行へ進まず停止し、通常保存やクラウド保存を変更しません。
- `server/api.mjs` をNode開発サーバーとCloudflare Workerで共有します。開発時はNode.js 24のSQLite、本番はWorker ESMとD1を使用します。

## DB

| テーブル | 用途 |
| --- | --- |
| `content_versions` | 下書きrevisionと公開済み定義snapshot |
| `app_settings` | 現在選択中の公開版ID |
| `saves` | 所有者ごとのクラウド進行とrevision |
| `save_history` | クラウド進行更新前の履歴 |

スキーマは `db/schema.ts`、適用SQLとDrizzleメタデータは `drizzle/` にあります。適用済みmigrationを編集せず、新規migrationで拡張してください。定義はID参照を含むJSON集約として保存し、公開時は共通validatorと既存セーブへの参照を検証します。

## 認証とAPI

本番はSitesが付与する `oai-authenticated-user-id` と、Sites環境変数 `OWNER_ID` または `OWNER_EMAIL` を照合します。APIは匿名・所有者以外を拒否し、書き込み時は同一Originも確認します。メールアドレスは認可判定だけに使い、DB上のセーブ所有者キーはSites内ユーザーIDです。認証情報はブラウザへ渡さず、文書・ソース・ログにも保存しません。

ローカル開発サーバーは `127.0.0.1` だけで待ち受け、開発専用の所有者IDを注入します。この認証経路を本番Workerへ持ち込みません。

| API | 用途 |
| --- | --- |
| `GET /api/health` | DB接続の確認 |
| `GET /api/content` | 現在の公開版またはbundled定義の実行用clone（旧定義の互換補完済み） |
| `GET /api/admin/versions`、`POST /api/admin/drafts` | 定義版の一覧・下書き作成 |
| `GET/PUT /api/admin/versions/:id` | 下書きの取得・更新 |
| `POST /api/admin/versions/:id/validate`、`POST /api/admin/versions/:id/publish` | 検証・公開またはbundledへの切替 |
| `GET /api/admin/preview?version=:id`、`GET /api/admin/export` | プレビュー・公開JSONの出力 |
| `GET/PUT /api/save` | クラウド進行の取得・明示保存 |
| `GET /api/save/history`、`GET /api/save/history/:id` | 保存履歴の一覧・取得 |

公開済み定義は複製して編集します。管理版取得・JSON exportはDB正本のraw定義を返し、実行用互換補完で公開snapshotを書き換えません。APIが使うrevisionが現在値と一致しない更新・保存は競合として拒否します。公開版の切替では、互換補完した検証用cloneに対して既存クラウドセーブの参照を調べ、既存進行を壊す定義を拒否します。

## セーブと互換性

ローカルの保存キーは `starlight-rpg-v1`、現在の形式は `v:2` です。戦闘メッセージの送り方の設定は別キー `starlight-rpg-message-mode` に、もちものの装備一覧の並べ替え・表示の選択は別キー `starlight-rpg-gear-view` に保存し、どちらもセーブ・クラウド保存・リセットの対象外です（値は[ゲーム仕様](GAME_SPEC.md)）。旧 `v:1` 保存からの移行を維持し、IDや配列順で旧仲間データを対応づける互換条件も変更時に保ちます。`shared/save.js` はクラウド保存時に `v:1` と `v:2` のデータを定義に照らして検証します。酒場の依頼状態は `questState` に受注ID・受注時討伐数・完了IDを保存します。依頼状態を持たない旧 `v:2` は有効なまま読み込み、従来の `claimed` から村長報酬の受領状況を補います。新しい依頼状態では `shared/quests.js` の固定IDと照合し、重複・未知ID・不正な受注基準値・旧報酬状態との矛盾を拒否します。クラウド保存・復元もこの状態を保持します。依頼はゲーム側の固定ルールであり公開コンテンツ定義には追加しません。APIはクラウド保存と公開切替の参照検証に互換補完済みのcloneを使うため、旧公開版から実行時に補完されたIDも通常の定義参照として確認できます。raw公開定義・DB snapshotは変更せず、セーブ形式も更新しません。移行は進行を初期化せず、不整合時も元のデータを保護してください。

酒場のNPC状態は `adventurerState` にtick、通常探索の端数、PRNG状態、NPC IDごとの現在ノードを保存します。固定100人の名簿と能力値は `shared/adventurers.js` にあり、セーブには位置だけを保存します。`adventurerState` のない旧 `v:2` は有効なまま読み込み、決定的な初期位置を補います。状態が壊れている場合はNPC部分だけを初期化し、プレイヤーの進行を保持します。クラウド保存・復元はNPC状態も含めてJSONを保持し、SaveRulesは100 ID・PRNG/tick範囲・各ノード参照を検証します。NPCの位置を削除する定義公開は、既存セーブの参照検証で拒否されます。セーブ形式・キーとDB schemaは変わりません。

戦闘中の状態異常は省略可能な `debuffs` に保存します。各要素は `side`（`ally`/`enemy`）、`target`（味方は人物ID、敵は `enemies` の添字）、`type`（`attackDown`/`defenseDown`）、`sourceId`（特技または魔物の行動のID）、付与時の `multiplier`、`remainingTurns`、`appliedTurn` です。倍率は付与時の値を記録するため、戦闘中に定義が変わっても結果は変わりません。`debuffs` がない旧セーブは空として扱います。`shared/save.js` は戦闘外の記録、倒れた・存在しない対象、範囲外の値、同じ対象と種類の重複を拒否し、読み込み時の正規化でも取り除きます。魔物の行動は戦闘開始時に `enemies` へコピーされた定義を使うため、行動を持たない旧セーブの敵は通常攻撃だけを行います。

装備の所持品は `gear`（`{uid, baseId, rarity, bonusEffects}` の配列）が正本で、`nextGearUid` が次の通し番号です。装着中の個体は主人公の `weaponUid` / `armorUid` と `companions[].weaponUid` / `armorUid` で参照し、1つの個体を装着できるのは1人だけです。従来の `owned`（所持している装備IDの一覧）・`weapon` / `armor`・`companions[].weapon/armor`（装着中の装備ID）は、保存のたびに個体から作り直す写しとして残し、以前の版でも同じセーブを読めるようにします。正規化（`GameRules.normalizeGear`、読み込みと描画のたびに実行・冪等）は、`gear` のない旧セーブでは装着している人物ごとに1個体、残りの所持装備に1個体ずつを装備定義どおりの値で作ります（能力値は移行前と同じ）。写しが個体と食い違う場合（以前の版で購入・装着した場合）は写しを優先し、足りない個体を補います。重複・未知の個体は取り除き、値が定義と合わない個体は定義どおりに戻します。`shared/save.js` は `gear` がある場合に、通し番号の一意性と `nextGearUid`、装備定義の存在とレアリティ・追加効果（装備定義と同じ値か、`rules.gearRoll` の範囲内の抽選値。固有装備と、抽選ルールのない定義では定義値だけ）、装着中の個体の存在・部位・重複装着、装着していない個体が30本以内であることを検証します。写しの一致は求めません（読み込み時に取り込むため）。抽選値の上限は `max(1, round(係数 × 装備Lv × 倍率の最大))` です。レアリティは5段階（エピックを含む）です。4段階だった旧ルールで拾った個体は、読み込み時の正規化でレジェンダリー（追加効果3つ）をエピックにし、形の正しい抽選品（レアリティに合う個数・重複のない候補の能力・整数）の数値を今の範囲へ最も近い値に収めます（旧ルールの値は今の倍率の下限より小さいため、多くは上がります）。クラウドの復元も、検証の前に同じ正規化を複製へ適用します（`SaveRules.prepareForLoad`）。サーバーはクラウド保存（PUT）と公開時の既存セーブ検証で正規化しないため、旧ルールのクラウドセーブは、ゲームで読み込んでクラウドへ保存し直すまで、新しい定義の公開を拒否させます。抽選ルールを狭める・装備レベルを下げる公開定義は既存の抽選値を範囲外にします。クラウドに保存済みのセーブが範囲外になる公開は、公開時の既存セーブ検証で拒否されます。ブラウザ内だけのセーブは公開時に検証できず、範囲外になった個体は読み込み時の正規化で標準品に戻ります。`rules.gearRoll` や `unique` を持たない旧公開定義、エピックのない4段階の `rules.gearRoll` を持つ旧公開定義には、`withJobs` が同梱定義の値（5段階の抽選ルール）を実行時のcloneへ補います（4段階のルールで調整した値は引き継ぎません）。廃止した旧ID（normal/rare/epic/legend）の `epic` は、追加効果が3つでなければ今のレアと読み替えます。仲間の個別装備は `companions[].weapon/armor` にも写します。旧セーブでは人物IDを優先し、IDがない形式は隊列順で移行します。仲間の記録がない旧セーブには各人の上限HP/MPで仲間を追加し、既存の仲間のHP/MPは保持します。旧形式の主人公の装備は初回だけ継承します。能力計算は装着中の個体のレアリティ・追加効果を使います（個体がない、または写しが書き換えられた場合は装備定義の値）。旧公開定義・内容キャッシュ・戦闘snapshotの装備レアリティは実行時に今の段階へclone上で正規化し、raw公開DB行と入力を変更しません。レアリティ省略の旧標準装備はコモンとして扱います。装備レベル `level` は保存済み定義では省略可能で、省略された装備には実行時（`withJobs`）に同梱定義の同じIDの装備レベル、該当がなければ1を補います（定義のレベル上限を超えません）。装備レベルによって既存セーブの装着状態は変更しません。

既存のクラウド進行を更新する前に確認を表示し、更新前の内容はAPIが `save_history` に保存します。クラウドから復元する前には現在のローカル進行をブラウザ内バックアップへ退避します。リセットが削除するのはローカル保存だけで、クラウド保存は保持します。プレビューは専用キーを使い、クラウド保存操作を無効にします。ローカルの自動保存とクラウド保存は別で、自動同期はありません。戦闘開始時の定義は `battleContent` としてセーブに保持し、戦闘中は公開版の差し替えを受けません。再開時はruntimeとstateへ互換補完済み定義をそろえ、通常の保存経路で保持します。旧 `battleContent` に標準ジョブ・特技が欠ける場合の `GameContent.withJobs` の補完は非破壊で、明示されたカスタム内容や衝突するIDを上書きしません。利用者向けの操作と実装詳細は `dist/cloud-save.js`、`dist/game.js`、`dist/storage.js` を参照してください。

## Sitesとの関係

Site identity・D1バインディングの設定元、公開時に維持する条件、ビルド・パッケージは[反映手順](RELEASE.md#sitesへのデプロイ)が正本です。
