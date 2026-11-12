const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'work'), { recursive: true });
const tempDir = fs.mkdtempSync(path.join(root, 'work', 'worker-assets-'));
const pngSources = [
  'dist/assets/village.png',
  'dist/assets/meadow.png',
  'dist/assets/characters/astel.png',
  'dist/assets/characters/rina.png',
  'dist/assets/characters/gald.png',
  'dist/assets/characters/noel.png',
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
  console.log(`PASS: ${imagePaths.length} Worker image URLs, cache/MIME, PNG pixel identity, HEAD and missing asset handling`);
})()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(tempDir, { recursive: true, force: true }));
