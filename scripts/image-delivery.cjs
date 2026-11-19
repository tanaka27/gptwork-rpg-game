// Workerビルドで配信用にだけ縮小・非可逆圧縮するPNG。dist/ の元画像は変更しない。
// ここにないPNGは従来どおり lossless WebP（画素は元画像と同じ）で配信する。
// - 背景：写真に近い絵で、表示はPCで最大約850px幅。解像度は保ち、品質80のWebPにする。
// - 初期4人の顔：表示は最大104px（個別ステータス詳細）。3倍密度の画面でも足りる320pxに縮小する。
const portrait = { maxSize: 320, quality: 85 };
module.exports = {
  '/assets/village.png': { quality: 80 },
  '/assets/meadow.png': { quality: 80 },
  '/assets/characters/astel.png': portrait,
  '/assets/characters/rina.png': portrait,
  '/assets/characters/gald.png': portrait,
  '/assets/characters/noel.png': portrait,
};
