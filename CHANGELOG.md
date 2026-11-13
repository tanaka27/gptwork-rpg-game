# 変更履歴

日付は日本時間です。新しい変更は上へ追加します。現行の仕様・手順は各正本へ反映し、ここには変更の要約だけを書きます。

- 1件は見出しと3〜4行程度の箇条書きにまとめます（変更内容、互換性への影響、検証結果の要約、反映結果）。
- 詳しい検証記録（テスト件数の内訳、ファイルのハッシュ、操作の細かな手順）は残しません。検証結果は案件の設計書の「実装・検証結果」に1行ずつ要約し、ここからリンクします。
- 反映（push・デプロイ）は完了した事実を書きます。デプロイIDはデプロイ後に分かるため、反映記録だけのcommitで追記して構いません（このcommitは再デプロイ不要。[反映手順](docs/RELEASE.md)）。
- 記録が10件または8KBを超えたら、古い日付の記録をまとめて新しいファイル `docs/history/YYYY-MM-DD-to-MM-DD-changelog.md`（移す記録の最初と最後の日付）へ移し、下の行と[文書索引](docs/README.md)の履歴表にリンクを足します。既存の履歴ファイルには追記しません。

2026-11-11の記録は[2026-11-11の変更履歴](docs/history/2026-11-11-to-11-11-changelog.md)に、2026-11-10以前の記録は[2026-11-04〜11-10の変更履歴](docs/history/2026-11-04-to-11-10-changelog.md)（大きいので通常の作業では開かない）にあります。

## 2026-11-13 — 特技の説明文と物理威力の%表示

- 物理特技の説明に自動で付く文を「会心の一撃は相手の守備力を無視します」に修正（常に守備力を無視すると読めたため）。物理威力を「威力240%」のように定義の数値から%で表示し、`content/game.json` の物理特技の `desc` から威力の記述を削除。末尾の句点が二重にならないようにした（[設計・検証記録](docs/history/plans/2026-11-13-skill-text-percent.md)）。
- 互換性：旧公開版・戦闘中の定義に残る「威力X倍」は表示時だけ取り除く。定義・セーブ・DBは変更なし。
- 検証：`npm test` 成功、全E2E 86/86成功（PC/スマホ相当）。iOS/Android実機は未確認。
- 反映：GitHubの `main` へpush。Sitesへは未反映（公開はCodexで行う）。

## 2026-11-13 — Claude Codeの開発体制

- [CLAUDE.md](CLAUDE.md)に、Claude Codeが開発（実装・テスト・文書・`main` へのpush）を担当し、Sitesへのデプロイだけを行わないことを明記。検証済みの変更は `main` へ直接pushする運用に変更（ユーザーの事前承認）。
- 外部ドキュメントの参照方針（記憶で済ませず調べる、拒否されたら黙って記憶に切り替えず報告する）と、クラウド環境の注意点（Node 24への入れ替え、プリインストールのChromiumの指定、ImageMagick 7がない場合に失敗するコマンド）を追加。文書のみの変更でアプリへの影響はない。
- 確認：Claude Codeのクラウド環境（Node 24）で `npm test` 成功、全E2E 82/82成功（PC/スマホ相当）。ImageMagick 6のため `npm run build` は失敗（公開用のため対象外）。
- 反映：GitHubの `main` へpush。Sitesへは未反映（アプリの変更なし）。

## 2026-11-12 — 冒険者の全身画像と酒場レイアウト

- 冒険者100人の全身WebPを追加し、一覧は胸上クロップに変更。左タブと右上の×を追加し、既存4人の画像は維持。
- [設計・検証記録](docs/history/plans/2026-11-12-npc-portraits.md)
- 検証：`npm test`、全E2E 82/82、`npm run package:site`、`npm run qa:worker-assets` 成功。iOS/Android実機は未確認。
- 反映：GitHub `5220c3a` をmainへpush。Sitesソース `6e65190`、デプロイ `appgdep_6af5ab8c24c88191958e78efcd562ad4` 成功（閲覧範囲・D1維持）。

## 2026-11-12 — 酒場の冒険者一覧

- 固定100人の冒険者を各セーブで独立管理し、酒場で街ごとの一覧・能力詳細を表示。探索3回または道中の有効stepごとに隣接移動を抽選し、既存 `v:2` セーブを補完する（[設計・検証記録](docs/history/plans/2026-11-12-tavern-adventurers.md)）。
- 検証：`npm test`、`npm run content:check`、全E2E 82/82（PC/スマホ相当）、`npm run package:site` 成功。iOS/Android実機は未確認。
- 反映：GitHub `70a04d4` をmainへpush。Sitesソース `0111f13`、デプロイ `appgdep_6af59b3af9c48191be6a06ea7d09c662` 成功（閲覧範囲・D1維持）。

## 2026-11-12 — 街の酒場と依頼

- 3街に共通の酒場を追加し、条件を満たした依頼の報告で報酬を一度受け取れるようにした。旧 `v:2` セーブと村長報酬の互換性を維持（[設計・検証記録](docs/history/plans/2026-11-12-tavern-quests.md)）。
- 検証：`npm test`、ローカルChromiumのPC/スマホviewportで全E2E 80/80、`npm run package:site` 成功。
- 反映：GitHub `f5c33d8` をmainへpush。Sitesソース `602f0f6`、デプロイ `appgdep_6af558d4e3c88191b1472a2065a959dd` 成功（閲覧範囲・D1維持）。

## 2026-11-11 — 装備と素材のレアリティ統一

- 装備を素材と共通の4段階・色へ揃え、既存の下位2段階の販売を維持。旧公開定義・戦闘snapshotは読み込みclone上で正規化し、raw定義とセーブ形式を維持（[設計・検証記録](docs/history/plans/2026-11-11-equipment-material-rarity.md)）。
- 検証：`npm test`、全E2E 78/78（workers=1）、`npm run package:site` 成功。PC/スマホ幅の画面表示とブラウザー例外なしを確認。
- 反映：GitHub `865ef6a` をmainへpush。Sitesソース `8b09410`、デプロイ `appgdep_6af41aef79788191b5566aa258d43e79` 成功（閲覧範囲・D1維持）。
