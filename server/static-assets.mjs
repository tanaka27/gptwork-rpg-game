// 埋め込み素材の配信。ETag（ビルド時の内容ハッシュ）で再検証できるようにし、変わっていなければ304を返す。
// - 画像：URLに版の番号がないため、1時間は再検証なしで使い、その後1日は古い版を表示しながら裏で再検証する。
// - HTML・JS・CSS：毎回再検証する（no-cache）。ETagがあるので、変わっていなければ本文を送らない。
export const imageCacheControl = 'public, max-age=3600, stale-while-revalidate=86400';
export const documentCacheControl = 'no-cache';

// If-None-Match の値（カンマ区切り・弱いETag・*）に、素材のETagが含まれるか。
export function etagMatches(header, etag) {
  if (!header || !etag) return false;
  const bare = value => value.trim().replace(/^W\//, '');
  return header.split(',').some(value => value.trim() === '*' || bare(value) === bare(etag));
}

export function createStaticHandler(assets) {
  const decoded = new Map();
  const bytesOf = (name, asset) => {
    if (!asset.base64) return asset.body;
    if (!decoded.has(name)) decoded.set(name, Uint8Array.from(atob(asset.body), c => c.charCodeAt(0)));
    return decoded.get(name);
  };
  return (request, name) => {
    const asset = assets[name];
    if (!asset) return new Response('Not found', { status: 404 });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const headers = {
      'content-type': asset.type,
      'cache-control': asset.type.startsWith('image/') ? imageCacheControl : documentCacheControl,
      'x-content-type-options': 'nosniff',
      ...(asset.etag ? { etag: asset.etag } : {}),
    };
    if (etagMatches(request.headers.get('if-none-match'), asset.etag)) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : bytesOf(name, asset), { headers });
  };
}
