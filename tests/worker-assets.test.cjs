const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'work'), { recursive: true });
const tempDir = fs.mkdtempSync(path.join(root, 'work', 'worker-assets-'));
const deliveryRules = require('../scripts/image-delivery.cjs');
const monsterPngSources = require('../content/game.json').monsters.map(monster => `dist/assets/monsters/${monster.id}.png`);
assert.equal(monsterPngSources.length, 15, 'all bundled monster images are checked in the Worker');
const pngSources = [
  'dist/assets/village.png',
  'dist/assets/meadow.png',
  'dist/assets/characters/astel.png',
  'dist/assets/characters/rina.png',
  'dist/assets/characters/gald.png',
  'dist/assets/characters/noel.png',
  ...monsterPngSources,
];

(async () => {
  if (!fs.existsSync(path.join(root, 'server/assets.generated.mjs')))
    throw new Error('Run npm run build before npm run qa:worker-assets');
  const { default: worker } = await import('../server/worker.mjs');
  const imagePaths = [
    ...pngSources.map(file => '/' + file.replace(/^dist\//, '')),
    ...Array.from({ length: 100 }, (_, index) => `/assets/characters/adventurer_${String(index + 1).padStart(3, '0')}.webp`),
  ];
  for (const assetPath of imagePaths) {
    const response = await worker.fetch(new Request('https://example.test' + assetPath), {});
    assert.equal(response.status, 200, `${assetPath} must be available in the Worker`);
    assert.equal(response.headers.get('content-type'), 'image/webp', `${assetPath} must return WebP MIME`);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${assetPath} must contain RIFF bytes`);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${assetPath} must contain WebP bytes`);
  }

  for (const source of pngSources) {
    const assetPath = '/' + source.replace(/^dist\//, ''),
      response = await worker.fetch(new Request('https://example.test' + assetPath), {}),
      bytes = Buffer.from(await response.arrayBuffer()),
      tempFile = path.join(tempDir, crypto.createHash('sha1').update(source).digest('hex') + '.webp');
    fs.writeFileSync(tempFile, bytes);
    const rule = deliveryRules[assetPath];
    if (rule) {
      // 配信用に縮小・非可逆圧縮した画像：大きさ、元画像との近さ（PSNR）、容量の削減を確かめる。
      const size = spawnSync('identify', ['-format', '%w %h', tempFile], { encoding: 'utf8' }),
        original = spawnSync('identify', ['-format', '%w %h', path.join(root, source)], { encoding: 'utf8' });
      const [width, height] = size.stdout.split(' ').map(Number),
        [originalWidth, originalHeight] = original.stdout.split(' ').map(Number),
        limit = rule.maxSize || Infinity;
      assert.ok(width <= limit && height <= limit, `${source} must fit in ${limit}px: ${width}x${height}`);
      if (!rule.maxSize) assert.deepEqual([width, height], [originalWidth, originalHeight], `${source} keeps its size`);
      const reference = path.join(tempDir, 'reference-' + path.basename(source));
      const resized = spawnSync('convert', [path.join(root, source), '-resize', `${width}x${height}!`, reference]);
      assert.equal(resized.status, 0, `ImageMagick convert must resize ${source}`);
      const psnr = spawnSync('compare', ['-metric', 'PSNR', reference, tempFile, 'null:'], { encoding: 'utf8' }),
        value = parseFloat(String(psnr.stderr || psnr.stdout));
      assert.ok(value >= 30, `${source} differs too much from the original: PSNR ${value}`);
      const sourceBytes = fs.statSync(path.join(root, source)).size;
      assert.ok(bytes.length <= sourceBytes / 4, `${source} must be at most a quarter of the PNG: ${bytes.length} bytes`);
      continue;
    }
    const compare = spawnSync('compare', ['-metric', 'AE', path.join(root, source), tempFile, 'null:'], { encoding: 'utf8' });
    assert.equal(compare.error, undefined, `ImageMagick compare must run for ${source}`);
    assert.equal(compare.status, 0, `${source} changed pixels: ${String(compare.stderr || compare.stdout).trim()}`);
    assert.equal(String(compare.stderr || compare.stdout).trim(), '0', `${source} must be pixel-identical`);
  }

  const missing = await worker.fetch(new Request('https://example.test/assets/characters/unknown.webp'), {});
  assert.equal(missing.status, 404);
  const head = await worker.fetch(new Request('https://example.test/assets/characters/adventurer_001.webp', { method: 'HEAD' }), {});
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'image/webp');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  console.log(`PASS: ${imagePaths.length} Worker image URLs, cache/MIME, PNG pixel identity, ${Object.keys(deliveryRules).length} reduced delivery images, HEAD and missing asset handling`);
})()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(tempDir, { recursive: true, force: true }));
