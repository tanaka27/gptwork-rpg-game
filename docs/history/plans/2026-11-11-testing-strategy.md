# テスト戦略とPlaywright MCP導入

- 状態：反映完了
- 設計版：v2
- 要求・背景：既存のPlaywright E2Eを保ったまま、テスト方法を一次資料に照らして見直し、Playwright MCPを実ブラウザの探索・アクセシビリティsnapshot確認に使えるようにする。vision capabilityも、アクセシビリティsnapshotに現れないゲーム画面の当たり判定で実際に使えるようにする。
- 設計作成者（子）：`/root/testing_strategy`
- 基準版：`work` / `f76db57`（2026-11-11時点）

## 目的・受け入れ条件

- 既存の `@playwright/test` 1.64.1、78件のE2Eケース、desktop 1440×900 / mobile 390×844の2 viewportを回帰テストの正本として維持する。projectはgame/adminを分けて4つにするが各viewportのケース数は維持し、MCP探索をE2Eの代替として扱わない。
- Microsoftの公式 `@playwright/mcp` と公式 MCP SDKをバージョン固定で導入し、SDKのstdio clientから実サーバーを起動して、`tools/list` と実際の `tools/call` を使う再現可能な対話セッションを用意する。READMEの設定例だけ、またはMCPを模した直接Playwright呼出しだけで導入完了とはしない。
- MCPセッションでアプリをローカル起動し、PC・スマホ相当の各幅でアクセシビリティsnapshotを読み、semantic refを使ってナビゲーションを操作する。snapshotに表れない戦闘背景のメッセージ送り領域は、vision有効時にスクリーンショットを見て座標を決め、座標クリック後に新しいsnapshotで状態変化を確認する。
- MCPのスクリーンショットを `work/playwright-mcp/` 配下へPC・スマホ幅別に保存し、親エージェントが画像を直接目視する。visionは座標操作を加える機能として記録し、自動画像比較やAIによる見た目の合否判定とは説明しない。
- 探索セッションはローカル開発サーバー、実行専用SQLite、隔離された一時ブラウザプロファイルを使い、公開Site、本番API、利用者の通常セーブへ接続・変更しない。
- 開発手順に、ロジック/API、回帰E2E、MCP探索、画像確認の役割と、変更箇所から対象テストを選び統合時に全件を回す基準を記す。
- 高価値で範囲を限定したテスト品質改善を行う。画面期待はrole/name/label等のsemantic locatorを優先し、状態確認はweb-first assertion / retry可能なpollingを優先する。意図しない `pageerror` / `console.error` を一律に捨てない。既存のテスト用state準備は許容するが、検証対象の操作を製品関数直呼びで置き換えない。
- テスト失敗を `skip`、期待の弱化、無条件再試行で緑化しない。既知のネットワーク遮断や演出待ちが残る場合は、理由を限定して文書化する。

## 対象範囲

- 変更候補：`package.json`、`package-lock.json`、`playwright.config.cjs`、`tests/e2e/` の小範囲の共通エラー監視・意味的なlocator改善、MCP stdio client / 起動設定、`AGENTS.md`、`docs/DEVELOPMENT.md`、`CHANGELOG.md`、本設計書。
- 既存の回帰ケース、desktop/mobileプロジェクトは維持する。必要な追加ケースがあれば、既存検査の重複ではなく明確な受け入れ条件の不足に限る。
- 製品ソース、セーブ形式、コンテンツ、公開済み定義、DBマイグレーション、Site配信物は変更しない。
- 対象外：全E2Eの一括書き換え、全クリックの座標化、Playwright CLI / Skillsの追加導入、比較基準画像を多数固定するvisual-regression導入、実機iOS/Android検証。

## 現状評価

- 強み：回帰は `@playwright/test` の実Chromiumで、desktop/mobileの2幅を実行する。ケースは画面操作だけでなく状態・保存・復元・APIを確認し、viewport境界、スクリーンショット、page error / console errorを多くの箇所で検査する。E2E API/管理画面ケースは同一spec内で直列化され、E2E DBは通常の開発DBと分かれている。
- 改善余地：コンソール監視がケースごとに重複し、全ケースに一貫して付いていない。`net::ERR_FAILED` を文字列だけで無条件に除外する箇所がある。ローカルAPI用SQLiteは `work/playwright.sqlite` を使い回し、同じproject内のgame/admin間とworkers間で公開定義・cloud save状態を共有する。次runにも状態が残る。外部通信遮断は `127.0.0.1:4173` を多数のspecで直書きする。画面操作は属性selector中心で、可視名やroleを通した検査に揃っていない。
- 小さい固定待ちや長い固定待ちは少数残る（状態遷移ループの10ms、演出中の600ms）。必要性を個別に見て、断定的な置換で不安定化させない。
- アプリ画面はDOMとSVGが中心でCanvas主体ではない。通常のボタンやナビゲーションはsemantic snapshotで操作できる。戦闘背景のクリック領域のような非semantic hit areaがvision操作の適切な適用例となる。

| 対象 | 現状と弱点 | 採用方法 | 今回の扱い・失敗診断 |
| --- | --- | --- | --- |
| ロジック/定義 | `npm test` がcontent、game、party、SQLite APIを検証。 | 対象関数・ルール/APIに対応する既存test fileを選ぶ。 | 製品ロジック変更なしのため今回は全件を重ねて実行しない。ロジックが変わる作業では必要な単位を実行し、失敗はテスト名・assert・seed/stateを確認する。 |
| UI/E2E | 78件をPlaywright Chromiumのdesktop/mobile projectで実行。状態、保存、画面内配置などの回帰を検査。 | `@playwright/test` を回帰の唯一の自動ブラウザ正本として保つ。変更対象specを両projectで先に選び、統合時に全件を実行。 | 全ケースを削除・skip・期待緩和しない。失敗時はtrace、screenshot、project、viewport、専用DBを調べ、同じ範囲を再実行して修正を確かめる。 |
| Browser error | pageerror/console監視がspecごとにばらつき、`net::ERR_FAILED` を文字列だけで除外。 | 共通fixtureで予期しないpageerror/console errorを検知し、意図的な外部abortだけを限定して扱う。 | console errorを一律に無視しない。許可条件はURL/originとabort理由を結びつけ、未知のerrorは調査・修正する。 |
| Semantic/accessibility | 画面操作の多くは`data-*`やID selector。 | role/name/labelを使える場所はsemantic locatorと小さいaria snapshotを優先し、アプリ固有状態は安定した属性selectorを使う。 | MCP snapshotを探索時に実際に読み、主要画面の意味構造とref操作を記録する。snapshotのみで視覚的な重なり・色・余白を合格扱いしない。 |
| 非semantic hit area | 戦闘背景クリックはbutton等のaccessibility nodeではない。 | MCPを`--caps=vision`で起動し、最新の画像を見てから座標を選ぶ。 | 背景メッセージ送りをPC/mobile相当幅で実操作し、操作後の新snapshotで状態を確認する。通常ボタンまで座標操作に置き換えない。 |
| Visual evidence | E2Eが操作中の画像を保存するが、画像比較の基準は固定していない。 | 必要なPC/mobile画面をMCP screenshotまたはE2E artifactとして保存し、人が直接確認。 | `work/`へ証跡を保存し親が目視する。pixel diffを導入しない。CSS/環境/font差の疑いは画像とブラウザ/viewport条件で診断し、端末実機未確認を明記する。 |
| Test data isolation | `backend.spec.cjs` は公開定義とcloud saveを変更し同一spec内ではserialだが、同じproject内のgame specとworkers間で `work/playwright.sqlite` を共有し、既存DBも次回実行へ残る。 | 通常のdesktop/mobile game projectからbackend specを除外し、admin-desktop/admin-mobile専用projectへ限定する。4 projectそれぞれに専用server/port/SQLiteを割り当てる。MCPにも別SQLite・一時profileを割り当てる。 | admin操作を通常game specから分離し、backend spec内serialを維持する。4 project / 2 viewportの既存78件を維持する。run間の残存状態も防ぐ。アプリ開発DBと本番は触れない。 |
| Test origin isolation | 多くのspecが外部通信遮断の例外に `127.0.0.1:4173` を直書きし、3箇所は絶対URL/originを直書きしている。 | 共通fixtureが `testInfo.project.use.baseURL` からoriginを読み、当該origin以外の通信を遮断する。絶対URLはbaseURL由来に直す。 | 全ハードコードを洗い出して置き換える。別portの4 projectでローカルAPI/静的assetを誤ってabortしないことを確認する。 |

## 実装設計

### 役割分担と運用

- `npm test` はコンテンツ、ゲームロジック、パーティ操作、SQLite APIのロジック/API回帰として継続する。
- `npm run test:e2e` は繰り返し実行できるUI回帰の正本として残し、操作結果をassertする。game specはdesktop/mobile game project、`backend.spec.cjs`は別server/DBを持つadmin-desktop/admin-mobile projectで実行する。4 projectへの振り分けで2 viewportの既存78件を維持する。機能や画面を変えたときは、まず関係するunit/API・E2E specを両viewportで実行し、統合前に全E2Eを実行する。コア起動、共通描画、保存形式、共有fixture、Playwright設定の変更は関連範囲を広げて全件実行する。
- テスト選択の判断基準は `docs/DEVELOPMENT.md` 一か所に正本として記載する。純粋計算/定義なら対応するlogic/content test、API/DBならAPI testと該当backend E2E、画面操作なら変更画面のE2Eを選び、配置/意味構造/ヒットエリアならviewport E2EにMCP探索と目視画像確認を加える。共通起動・保存・CSS・fixture・runner変更は全E2Eを含む広い回帰を実行する。
- 失敗はtest trace・screenshot・report、project/viewport、seed/保存fixture、専用SQLiteを見て再現条件を特定する。原因を直さず同じsuiteを繰り返して緑化しない。新しい再試行や許可listは具体的な不安定要因の証拠がある場合にだけ狭く追加する。
- Playwright MCPは仕様の曖昧な画面探索、snapshot上の意味構造確認、手動で次の操作を選ぶ持続セッションに使う。結果は探索記録であって、再現可能な回帰テストの代わりにしない。
- Playwright CLI+Skillsは公式READMEでcoding-agent向けの別選択肢として記載されている。今回は明示要望に沿ってMCPの対話探索を採用し、既存テストランナーを置き換える目的ではCLIを追加しない。

### MCP起動・client・探索

- registryで確認した `@playwright/mcp@0.0.85` と `@modelcontextprotocol/sdk@1.32.2` を正確なversionでdevDependenciesへ追加する。Playwright Testは現行1.64.1のままにする。MCPパッケージが依存するPlaywrightは別versionである点を記録する。
- MCP用設定でChromium、`--caps=vision`、`--headless`、適切なviewport、保存先、外部origin制限を指定する。`--executable-path` は環境で利用できるChromiumを選ぶ場合だけ使用する。探索はローカルhostだけを許可し、本番Siteへ移動しない。
- 小さなNode対話clientを用意し、stdio transportで公式Playwright MCP serverを起動、SDKで接続し、ツール一覧とschemaを表示する。単発で終了せず、stdinのJSONL入力から複数回のtool callを行える持続セッションにする。ツール名とJSON argsを各行で受け、応答・画像の保存先を `work/` へ記録する。`isError: true` の応答は失敗として数えつつsessionを継続し、EOFでclient/serverを正常終了する。不正JSONは診断を記録して非成功終了にする。無効tool名・起動失敗・異常終了も失敗として確認する。
- PC 1440×900とスマホ相当390×844で別々にセッションを実行する。初期画面と地図/仲間画面のsemantic snapshotを観察し、通常ボタンはsnapshotのrefで操作する。戦闘へ進み、snapshotにない背景メッセージ送りを一度だけvision座標で操作し、その後のsnapshotでメッセージ進行を確認する。スクリーンショットを両幅で保存する。
- セッションの起動・接続・`tools/list`・snapshot・semantic操作・座標操作・snapshot後確認を検証記録に残す。MCP通信異常やツールエラーが起きた場合に成功扱いにしない。

### 回帰テスト品質の改善

- 共通E2E fixtureへコンソール監視を集約する場合は、`pageerror` と未知のconsole errorを失敗させる。外部通信を意図してabortするテストは、そのabort対象/メッセージと結びついた狭い許可条件にする。単に `net::ERR_FAILED` を含むすべてのconsole errorを無視しない。
- E2E開発serverを4 project（game desktop/mobile、admin desktop/mobile）ごとに分ける。通常game projectからbackend specを除外し、admin projectのみで実行する。各projectに専用portと `work/` 内のrun/project別新規SQLiteを割り当てる。作業用・本番DBに触れない。既存 `work/playwright.sqlite` をこの変更後の既定DBとして使わない。backend specのserial modeは維持する。
- 多くのspecで外部routeを遮断する処理を共通fixtureへ移し、`baseURL`から現在projectのoriginを動的に判定する。`127.0.0.1:4173` の直書きと絶対URLを全件検索し、動的baseURLへ置き換える。許可する通信は現在のproject originだけとし、別project portを誤遮断しないことを検証する。
- 既存の `data-action` 等はアプリ特有の状態を指すselectorとして必要な箇所で残す。ユーザーが見るナビゲーション、dialog、button、見出しや状態の期待はrole/name/label/textを優先し、`getByRole` とweb-first assertionを使う。`evaluate` は試験状態の準備・読み出しを中心にし、操作対象ロジックをバイパスする用途は例外理由を明記する。
- 固定sleepは機械的に排除せず、状態が観測できるものはweb-first assertion / `expect.poll` にする。CSS animation等のタイミングに必要なものは具体的な視覚・状態変化に結びつける。
- 追加のaria snapshot matchersは、動的なゲーム値を含む大きなページsnapshotではなく、安定したナビゲーション等の小さな意味領域に限る。視覚差分テストを自動追加する場合は同一環境の基準画像と維持費を別途明記する。

### 公式根拠

- Playwright MCP README: <https://github.com/microsoft/playwright-mcp> — coding agentにはCLI+Skillsが適する一方、MCPは持続的なexploratory automationに適用できると説明。snapshotを操作の既定にし、vision capability時の座標操作はsnapshotに露出しない要素へ使うと記載。
- Playwright CLI README: <https://github.com/microsoft/playwright-cli> — CLI+Skillsは短いagent loop向けの補完手段。
- Playwright best practices: <https://playwright.dev/docs/best-practices> — browser-visibleな振る舞い、ユーザー向けlocator、テストの隔離を推奨。
- Playwright assertions: <https://playwright.dev/docs/test-assertions> — auto-retrying web-first assertionsを推奨。
- ARIA snapshots: <https://playwright.dev/docs/aria-snapshots> — アクセシビリティ構造をテキストとして検証可能。
- Test agents: <https://playwright.dev/docs/test-agents> — planner/generator/healerはテスト作成補助。healerによるskip、assertion弱化、無条件再試行を受け入れない。

## 既存セーブ・公開済み定義との互換性と移行

- 製品コード、save key `starlight-rpg-v1`、save format `v:2`、公開済み定義は変更しない。
- `npm run test:e2e` とMCP探索はそれぞれ専用ブラウザcontextを使い、MCPは一時profileを使う。E2E/MCPのSQLiteは開発用 `.local/rpg.sqlite` と別にする。外部APIやSite認証を使わず、テスト専用ローカルサーバーだけを使う。

## 異常系・境界条件・リスクと対策

- SDK clientがサーバーを起動できない、stdio handshakeできない、異常応答を受けた場合は終了コードを失敗にし、検証記録で阻害範囲を特定する。
- Playwright TestとMCP serverの依存するPlaywright versionが異なる。回帰suiteとMCP探索を分け、同じlocal appを確認しても両ツールが同じtest runner/browser versionであるとは主張しない。
- headless Chromiumの座標はviewport CSS pixel単位。必ず当該幅の最新スクリーンショットから座標を選び、クリック後にsnapshotを取り直して操作結果を確認する。スマホ実端末の検証と混同しない。
- admin画面のテストはAPI stateを書き換えるため、PC/mobile projectで独立したDBを利用する。MCP探索対象はゲーム画面に限定し、admin publish/cloud save APIは呼び出さない。
- console監視の共通化で外部フォント遮断など意図的な失敗が検知された場合、原因を調べて特定のorigin/要求だけを許可する。未知エラーを包括的に許可しない。
- スクリーンショットは手動目視に用いる。基準画像がない現状で、ピクセル比較やアクセシビリティsnapshotだけを視覚品質判定の代用にしない。

## 検証計画

- 依存・設定：lockfileの再現、MCP CLIのversion/help確認、Node構文チェック、`git diff --check`。
- MCPの実使用：npm script/実行手順でofficial serverとSDK stdio clientを起動。`tools/list`を記録し、アプリへnavigate、semantic snapshotの保存・確認、snapshot ref操作、PC/mobileスクリーンショット、vision座標クリック、操作後のfresh snapshotを実行する。session結果・画像を `work/playwright-mcp/` に置き、親が画像を直接確認する。
- E2E isolation: Playwrightの4 projectを起動し、game/admin、desktop/mobileがそれぞれ意図したspecのみを実行することを確認する。全projectで別port/SQLiteを使い、admin編集・publish・bundled復帰・cloud saveの並列実行がgame stateへ影響しないこと、次回runも新しいDBから始まることを確認する。通常開発DBに差がないことを確認する。
- 高価値回帰：既存の78 E2Eケースをdesktop/mobile両方で全実行し、console監視共通化・DB分離後も期待が弱まっていないことを確認する。`npm test` は製品コードを変更しないため通常必須ではないが、依存・設定のみなら不要。関連構文チェックを行う。
- 手動レビュー：親がdesktop/mobileのMCP screenshotを目視確認する。視覚の細部をMCP server単体が合否判定したと報告しない。
- 対象外：iOS/Android実機、実サイト、認証済み本番API、MCP経由の公開・永続データ変更。

## 反映・復旧方法

- 本変更は開発依存・テスト用スクリプト・ドキュメントに限定し、製品成果物は生成しない。失敗時は専用 `work/` DB・MCP画像・session logを調査し、テスト変更やfixtureだけを戻す。製品セーブや公開データの復旧操作は不要。
- 既存の `work/site.tar.gz` を再利用する場合は、今回のコード/依存変更と配信物の対象範囲が無関係であることを差分とhashで確認して親へ伝える。push/deployは設計・実装レビュー後に親が既存手順で実施する。

## 親エージェントの設計レビュー記録

- 識別子・日時（日本時間）・対象版：/root・2026-11-11 10:06 JST・v1
- 判定：要修正
- 指摘・対応・再レビュー結果：viewport間だけのDB分離ではproject内backend/通常spec並列競合が残る。管理専用project/DBも分離すること。複数port導入時は4173固定のrouteをbaseURL originへ適応すること。MCP対話clientの継続セッション・isError・EOF・不正JSONの検証を明記すること。v2では4 projectへの分離、baseURL origin共通fixture、JSONL clientと異常応答の扱いを追加。2026-11-11 10:09 JSTにv2を無条件承認。

## 親エージェントの設計再レビュー記録（v2）

- 識別子・日時（日本時間）・対象版：/root・2026-11-11 10:09 JST・v2
- 判定：承認
- 指摘・対応：v1の阻害指摘を解消。game/adminおよびviewportのDB/port分離、baseURL対応、実MCP持続セッションとvisionの適用基準、失敗記録、既存78件の維持と品質改善を確認。

## 親エージェントの設計承認記録

- 状態：承認済み
- 識別子・日時（日本時間）・対象版：/root・2026-11-11 10:09 JST・v2
- 承認結果・条件：v2に沿った実装開始を無条件で承認。実装方式/範囲の変更は再レビューする。

## 設計変更履歴

- v1：初版。親からproject内DB競合、baseURLのport直書き、client lifecycleの記録不足を指摘。
- v2：管理専用project/DB、動的origin fixture、JSONLを使う継続stdio clientと異常応答の非成功判定を追加。2026-11-11 10:09 JSTに承認。

## 実装・検証結果

- 受け入れ条件と結果の対応：既存Playwright E2Eは78/78成功。4 projectはgame/adminとdesktop/mobileに分離し、各々 `work/playwright/4544-1794360470773/{game-desktop,game-mobile,admin-desktop,admin-mobile}.sqlite` を使用。通常開発DB `.local/rpg.sqlite` は存在しない。fixture probeは `npm run qa:e2e-fixtures` 成功し、許可したGoogle Fonts abortは通過、未知のconsole `ERR_FAILED` と `pageerror` は非成功になった。
- 受け入れ条件と結果の対応：stdio clientはofficial MCP serverへ接続し、tool一覧、snapshot、semantic ref操作、vision有効時の座標操作を実ブラウザで使用。desktop session `work/playwright-mcp/2026-11-11T01-18-06.127Z-2416` は23 calls、1440×900で背景の座標 (720,480) を操作しsnapshotで防御メッセージの進行を確認。mobile session `work/playwright-mcp/2026-11-11T01-20-30.416Z-2707` は17 calls、390×844で (195,420) を操作し同様に確認。親がPCのmap/party/vision前後画像、mobileのmap/vision前後画像を直接目視し、未知のapp errorがないことを確認。mobile party画像は未確認。両sessionとも `hadFailure:false` で終了。
- 受け入れ条件と結果の対応：clientのEOF正常終了、malformed JSONでexit 1、official MCP tool応答 `isError:true` でexit 1を確認。既存port 4190との衝突時はclientが起動直後に失敗し、すでにlistenしていたserverの応答hash (`d758d2ed8301e46f3b63a25b24c3008f3982abf327d7ea3caa2375a13d5b407d`) は前後で一致。4 projectは別port/別SQLite pathに構成され、今回runの4 DBは独立ファイル。`.local/rpg.sqlite` は存在しない。
- 設計との差異・未検証事項：Playwright Test 1.64.1とMCP依存Playwright/playwright-core 1.66.0-alpha-2026-11-09は異なる。実行Chromiumは両方とも `/usr/bin/chromium` version 155.0.8059.79。visionはsnapshotに出ない戦闘背景の座標操作として使用し、画像比較やAI visual judgementは導入していない。iOS/Android実機、公開Site、本番APIは未確認。Chromium profileはPlaywrightの隔離一時領域を使う。cache・session log・client画像は `work/` 内に保存し、screenshot `filename` はsession `output/`を示す絶対パスを指定する。
- 子の実装・検証記録：Node 24.22.1 / npm 11.9.0。`npm ci --cache work/npm-cache` 成功。`npm run test:e2e -- --list` は78件を列挙。`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=2` は78/78成功。`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run qa:e2e-fixtures` 成功（再検証: `work/playwright-fixture-probe/1794361037661-8739`）。targeted E2Eはsemantic navigation 1件、adminの意図的API abort 1件成功。設定・fixture・client・probeと全E2E specの `node --check`、`git diff --check` 成功。
- 子の実装・検証記録：MCP依存は `@playwright/mcp@0.0.85`、`@modelcontextprotocol/sdk@1.32.2`、Playwright Testは `1.64.1` のまま。MCP session内のChromium cacheは `work/` に指定。親がdesktop/mobileの計40 tool callsと全画像を目視確認した。
- 配信物再利用確認：製品ソース・生成物は変更なし。既存 `work/site.tar.gz` は8,884,446 bytes、SHA-256 `29da3c58f4b8db7653eca4e7f4729f22f6d6c69d21b77ec3d89dd28f43d26d25`。同一内容を再利用し、新build/packageは不要。
- 親の実装レビュー・承認記録：/root・2026-11-11 10:38 JST・v2実装を承認。依存/lock、runner、fixture、既存spec、MCP client、異常系probe、AGENTS/手順/記録をレビュー。子の78/78回帰と異常系・構文・差分チェック成功を引継ぎ、親が公式MCP経由でPC23回/mobile17回の実tool callを行い、snapshotのsemantic操作と目視座標vision操作の前後を確認。既存依存版の維持・製品ソース無変更・同一アーカイブを独立確認。阻害事項なし。
- push・デプロイ結果の参照：GitHub e6fbe11をmainへpush。GitHub追跡ファイルの完全一致を確認しSitesソースb85d055へ同期・push。同一アーカイブでデプロイappgdep_6af3c778118081918ac994c74576d80fのsucceededを確認。既存Site ID・D1・所有者限定を維持。反映記録もpushし同じ成果物を再デプロイする。
