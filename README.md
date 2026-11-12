# 星灯りの旅団 — Starlight Chronicle

日本語で遊べる、オリジナルのターン制ブラウザRPGです。4人の旅団で各地を旅し、魔物を倒して装備を整え、3体のボスに挑みます。

街の酒場では、その街にいる冒険者を一覧して個別の能力や現在地を確認できます。冒険者はセーブごとに独立しており、探索や道中の行動に応じて隣の地点へ移動することがあります。

- [ゲームを開く](https://starlight-chronicle-rpg.tomo27tomo84.chatgpt.site)（現在は所有者限定）
- [GitHub](https://github.com/tanaka27/gptwork-rpg-game)（`main`）

## ローカルで起動

Node.js 24以上で実行します。

```sh
npm ci
npm run dev
```

生成済みのフロント用データはGitに含まれています。`content/game.json` や `shared/` を変更したときは `npm run content:sync` を実行します。

ゲームは <http://127.0.0.1:4173/>、データ管理画面は <http://127.0.0.1:4173/admin/> で開きます。

## 文書

仕様、構成、開発手順などは[文書索引](docs/README.md)から参照してください。
