const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { buildSync } = require('esbuild');

require('./sync-content.cjs');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const workerLimitBytes = 10 * 1024 * 1024;
const npcPortraitLimitBytes = 50 * 1024;
const npcPortraitTotalLimitBytes = Math.round(3.5 * 1024 * 1024);
const charactersDir = path.join('dist', 'assets', 'characters');
const deliveryRules = require('./image-delivery.cjs');

function runImageMagick(args, options = {}) {
  const result = spawnSync('convert', args, { encoding: 'utf8', ...options });
  if (result.error) throw new Error(`ImageMagick convert is required: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = String(result.stderr || '').trim();
    throw new Error(`ImageMagick convert failed${detail ? ': ' + detail : ''}`);
  }
  return result;
}

function assertImageMagickWebP() {
  const version = runImageMagick(['-version']).stdout;
  if (!version.includes('ImageMagick 7.'))
    throw new Error('ImageMagick 7 is required to build the Worker image assets');
  const formats = runImageMagick(['-list', 'format']).stdout;
  if (!/^\s*WEBP\*?\s+WEBP\s+rw/m.test(formats))
    throw new Error('ImageMagick must be built with its WebP delegate enabled');
}

function deliveryArgs(rule) {
  if (!rule) return ['-define', 'webp:lossless=true'];
  return [
    ...(rule.maxSize ? ['-resize', `${rule.maxSize}x${rule.maxSize}>`] : []),
    '-define',
    'webp:lossless=false',
    '-define',
    'webp:method=6',
    '-define',
    'webp:alpha-quality=100',
    '-quality',
    String(rule.quality),
  ];
}

function transcodePngToWebp(data, file, rule) {
  const result = runImageMagick(['-', ...deliveryArgs(rule), 'webp:-'], {
    input: data,
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
  const bytes = result.stdout;
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP')
    throw new Error(`ImageMagick did not produce WebP bytes for ${file}`);
  return bytes;
}

function validateNpcPortraits() {
  const expected = Array.from({ length: 100 }, (_, index) => `adventurer_${String(index + 1).padStart(3, '0')}.webp`);
  const actual = fs
    .readdirSync(charactersDir)
    .filter(name => /^adventurer_\d{3}\.webp$/.test(name))
    .sort();
  const missing = expected.filter(name => !actual.includes(name));
  const unexpected = actual.filter(name => !expected.includes(name));
  if (missing.length || unexpected.length)
    throw new Error(
      `Expected exactly 100 NPC WebP portraits; missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'}`
    );

  let totalBytes = 0;
  const hashes = new Set();
  for (const name of expected) {
    const file = path.join(charactersDir, name);
    const data = fs.readFileSync(file),
      bytes = data.length,
      hash = crypto.createHash('sha256').update(data).digest('hex');
    if (bytes > npcPortraitLimitBytes)
      throw new Error(`${name} is ${bytes} bytes; the per-image limit is ${npcPortraitLimitBytes} bytes`);
    if (hashes.has(hash)) throw new Error(`${name} duplicates another NPC portrait`);
    hashes.add(hash);
    totalBytes += bytes;
  }
  if (totalBytes > npcPortraitTotalLimitBytes)
    throw new Error(
      `NPC portraits total ${totalBytes} bytes; the collection limit is ${npcPortraitTotalLimitBytes} bytes`
    );

  const dimensions = spawnSync(
    'identify',
    ['-format', '%f|%m|%w|%h\n', ...expected.map(name => path.join(charactersDir, name))],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  if (dimensions.error) throw new Error(`ImageMagick identify is required to validate NPC portraits: ${dimensions.error.message}`);
  if (dimensions.status !== 0)
    throw new Error(`Could not inspect NPC portraits: ${(dimensions.stderr || '').trim()}`);
  const byName = new Map(
    dimensions.stdout
      .trim()
      .split('\n')
      .map(line => {
        const [name, format, width, height] = line.split('|');
        return [name, { format, width, height }];
      })
  );
  for (const name of expected) {
    const info = byName.get(name);
    if (info?.format !== 'WEBP') throw new Error(`${name} must be WebP; found ${info?.format || 'unknown format'}`);
    if (info.width !== '512' || info.height !== '768')
      throw new Error(`${name} must be 512×768; found ${info.width || '?'}×${info.height || '?'}`);
  }
  return { count: expected.length, totalBytes };
}

// 規則の対象が消えたり名前が変わったりしたら、黙って lossless に戻さずに止める。
function validateDeliveryRules() {
  for (const [name, rule] of Object.entries(deliveryRules)) {
    if (!/\.png$/.test(name) || !fs.existsSync(path.join('dist', name)))
      throw new Error(`Image delivery rule targets a missing PNG: ${name}`);
    if (!Number.isInteger(rule.quality) || rule.quality < 1 || rule.quality > 100)
      throw new Error(`Image delivery rule for ${name} needs an integer quality from 1 to 100`);
    if (rule.maxSize !== undefined && (!Number.isInteger(rule.maxSize) || rule.maxSize < 1))
      throw new Error(`Image delivery rule for ${name} needs a positive integer maxSize`);
  }
}

validateDeliveryRules();
assertImageMagickWebP();
const npcPortraits = validateNpcPortraits();
const assets = {};
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name),
      name = '/' + path.relative('dist', file).split(path.sep).join('/');
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (!entry.isFile()) throw new Error('Only regular files can be packaged: ' + file);
    const ext = path.extname(file),
      source = fs.readFileSync(file);
    if (ext === '.png') {
      const body = transcodePngToWebp(source, file, deliveryRules[name]);
      assets[name] = { type: 'image/webp', base64: true, body: body.toString('base64') };
    } else if (ext === '.webp') {
      assets[name] = { type: mime[ext], base64: true, body: source.toString('base64') };
    } else {
      assets[name] = { type: mime[ext] || 'application/octet-stream', body: source.toString('utf8') };
    }
  }
}

walk('dist');
fs.writeFileSync('server/assets.generated.mjs', 'export default ' + JSON.stringify(assets) + ';');
fs.rmSync('build', { recursive: true, force: true });
fs.mkdirSync('build/.openai', { recursive: true });
buildSync({
  entryPoints: ['server/worker.mjs'],
  outfile: 'build/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
});
fs.copyFileSync('.openai/hosting.json', 'build/.openai/hosting.json');
fs.cpSync('drizzle', 'build/drizzle', { recursive: true });
const workerBytes = fs.readFileSync('build/server/index.js'),
  workerGzipBytes = zlib.gzipSync(workerBytes, { level: 9 }).length;
if (workerGzipBytes >= workerLimitBytes)
  throw new Error(`Worker gzip is ${workerGzipBytes} bytes; the limit is ${workerLimitBytes} bytes`);
console.log(
  `Worker bundle: ${workerBytes.length} bytes, gzip ${workerGzipBytes} bytes; ${Object.keys(assets).length} embedded assets; NPC portraits ${npcPortraits.count}, ${npcPortraits.totalBytes} bytes`
);
