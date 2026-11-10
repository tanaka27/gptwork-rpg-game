# 星灯りの旅団 — Starlight Chronicle

日本語で遊べる、オリジナルのターン制ブラウザRPGです。装備はノーマル・レア・エピック・レジェンドの4段階で、レア以上には装備中に能力へ加算される追加効果があります。装備の詳細画面では基礎補正と追加効果を確認できます。

- [ゲームを開く](https://starlight-chronicle-rpg.tomo27tomo84.chatgpt.site)（現在は所有者限定）
- [GitHub](https://github.com/tanaka27/gptwork-rpg-game)（`main`）

## ローカルで起動

Node.js 24以上で実行します。

```sh
npm ci
npm run content:sync
npm run dev
```

ゲームは <http://127.0.0.1:4173/>、データ管理画面は <http://127.0.0.1:4173/admin/> で開きます。

## 文書

現在の仕様、引き継ぎ、開発手順、デザイン方針などは[文書索引](docs/README.md)から参照してください。
