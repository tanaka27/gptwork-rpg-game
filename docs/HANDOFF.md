# 開発引き継ぎ

更新日：2026-11-04（日本時間）。この文書は実装の入口です。具体的な数値は[ゲーム仕様](GAME_SPEC.md)、作業手順は[開発手順](DEVELOPMENT.md)、必須ルールは[AGENTS.md](../AGENTS.md)を参照してください。

## 現在地

オリジナルRPG「星灯りの旅団」をSitesで公開し、GitHubの `main` にソースを保存しています。最新の機能変更は、会心の廃止とドラクエを参考にした物理式（攻撃力÷2−守備力÷4）、高守備へのかすり当たりです。物理／魔法分類と賢さは維持しています。

ユーザーの継続的な要望は、成果物を指定のGitHubへpushすることです。開発のたびに関連Markdownも更新してください。

## 技術構成

```text
AGENTS.md                 エージェント向け開発ルール
README.md                 利用者・開発者の入口
CHANGELOG.md              変更履歴
 dist/
   index.html             UIの枠・DOM ID・スクリプト読み込み順
   style.css              レイアウト・レスポンシブ・地図・種別表示
   combat.js              CombatRules：副作用のないダメージ／魔法計算
   game.js                定数データ・状態・進行・戦闘・表示・保存・操作
 tests/
   game.test.cjs          Node.js標準ライブラリだけの検証
 docs/
   HANDOFF.md             この文書
   GAME_SPEC.md           ゲーム仕様
   DEVELOPMENT.md         開発・検証・公開手順
 work/                    一時作業用（Git対象外）
```

`dist/` が編集対象のソース兼配信物です。React、Phaser、TypeScript、Vite、npm依存、DB、APIサーバーは使用していません。描画はDOMとインラインSVG、効果音はWeb Audio APIです。外部リソースはGoogle Fontsのみで、フォールバックがあります。

`combat.js` と `game.js` はクラシックスクリプトです。前者の `CombatRules` を後者が参照するため、HTMLとテストの両方でこの順に読み込みます。`game.js` は読み込み時にイベントを登録して `render()` を実行します。

## 変更箇所の早見表

| 変更対象 | 主な定義・関数 |
| --- | --- |
| 世界・街・接続 | `zones`, `mapNodes`, `canMove`, `moveTo`, `renderMap` |
| モンスター | `bestiary`, `startBattle`, `monster`, `creatureSVG` |
| 装備・消耗品 | `gear`, `consumables`, `action`, `useItem`, `renderInventory` |
| 素材と抽選 | `rarities`, `materials`, `lootTable`, `rollMaterials`, `renderMaterials` |
| 能力値 | `maxhp`, `maxmp`, `attack`, `defense`, `wisdom`, `threshold` |
| スキル | `skillList`, `normalAttack`, `skillTypeLabel`, `useSkill` |
| ダメージ式 | `dist/combat.js` の `physicalDamage`, `magicAmount` |
| ターンと敵行動 | `combat`, `win` |
| 保存と移行 | `initial`、ロード直後の移行処理、`save` |
| リセット | HTMLの `#reset`、確認ダイアログ、`resetAdventure` |
| 全体表示 | `render`, `renderInventory`, `landscape`, `townSVG` |

## 状態と保存

- 保存先はlocalStorageの **`starlight-rpg-v1`**。キーの名前はv1ですが、現在のデータ形式は **`v:2`** です。勝手に別キーへ切り替えると既存進行が見えなくなります。
- 保存するのは `state`。`tab`, `busy`, `sound`, AudioContextは実行時だけの状態で、保存しません。
- 攻撃力・守備力・賢さ・最大HP/MP・習得スキルは、レベルと装備から算出します。プレイヤーの賢さをセーブへ固定値で追加する必要はありません。
- v1/v2のセーブを受け入れ、旧位置をノードに変換し、素材辞書・最終訪問街・戦闘中の敵の賢さを補完します。
- `render()` は既定で保存も行います。`render(false)` だけは保存しません。リセット後に空の初期セーブを即再作成しないために必要です。
- リセットの確認を開いた段階では保存は変わりません。「OK」でゲーム専用キーを削除し、メモリ内を初期化して `render(false)`。次の通常操作、または再読み込み後の初回描画から自動保存を再開します。他アプリのlocalStorageは消しません。

主な `state` フィールド：

| フィールド | 用途 |
| --- | --- |
| `v`, `lv`, `xp`, `hp`, `mp`, `gold` | 形式バージョンと成長・現在値 |
| `weapon`, `armor`, `owned`, `items`, `materials` | 装備ID、所有装備、消耗品、素材の個数 |
| `node`, `zone`, `village`, `lastTown` | 現在ノード、エリア、街判定、復帰先 |
| `kills`, `cleared` | エリアごとの討伐数とボス撃破フラグ（各3要素） |
| `total`, `claimed` | 累計討伐と一度限りの討伐依頼報酬 |
| `enemy`, `turn`, `log` | 戦闘中の敵、ターン、冒険ログ（最大35件） |

## 戦闘の流れ

1. `startBattle` が現在エリアの敵、またはボスを生成。
2. `combat('attack')` は物理計算を行う。`useSkill` は種別ごとの計算を行ってから `combat('skill')` へ進む。アイテムも使用後に敵ターンへ進む。
3. `busy` を立てて入力を抑止し、描画・保存。敵HPが0なら即 `win` して敵の反撃はなし。
4. 約430ms後、敵の物理攻撃を解決。3ターンごとに強攻撃。防御を選んだターンは軽減倍率を適用。
5. 全滅なら所持金の15%（切り捨て）を失い、`lastTown` へ戻りHP/MP全回復。進行・装備は維持。
6. `busy` を解除して描画・保存。

敵攻撃にもプレイヤーと同じ物理計算を使います。敵にも賢さはありますが、現在は敵の魔法行動は実装していません。

## 既知の制約・未検証事項

- ブラウザ上の表示、クリック、キーボード、スマホ実機、音声の確認は未実施です。これまでの環境にはSites指定のブラウザQA経路がなく、NodeのDOMモックでロジックを検証しました。
- セーブはブラウザ・オリジン単位です。Sitesとlocalhost、別端末、別ブラウザでは共有しません。サーバー保存・同期・エクスポートはありません。
- ロード時のデータ検証は簡易的です。任意に破損・改変されたセーブ全般への堅牢性は保証していません。
- 敵の応答待ち中に保存しますが、`busy` と待機処理は保存しません。途中で再読み込みした場合に、未解決の敵ターンまで厳密に再開する仕組みはありません。
- モンスターの出現候補はエリア単位です。同じエリアの各探索ノードで同じ4種を等確率で抽選します。街ごとの商品差や価格差はありません。
- 素材の用途は現在は所持・売却のみ。クラフト、強化、属性、状態異常、素早さ、装備への賢さ補正、敵魔法は未実装です。
- レベル上限は30。バランスの網羅的な長時間プレイ検証は未実施です。
- `game.js` とCSSは一部長い行・追記スタイルが残っています。大規模な整理をする場合は、挙動変更と混ぜず検証可能な単位で進めてください。

これらは今後の改善候補であり、今回の文書整備で機能を追加・修正したものではありません。
