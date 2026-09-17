const API = 'https://api.github.com/repos/aidamian/PurpleRay_SBOM_Analyzer';
const RETRY_MS = 5 * 60_000;
const packageName = /^(?:(?:purpleray-)?sbom-analyzer-v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-(?:linux-x64(?:\.tar\.gz)?|windows-x64\.zip|macos\.zip)|purpleray-sbom-analyzer_\d+\.\d+\.\d+(?:[+~.-][0-9A-Za-z.+~-]+)?_amd64\.deb)$/;
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function pageURL(value, pathname) {
  const url = new URL(value);
  if (url.origin !== 'https://api.github.com' || url.username || url.password || url.hash ||
      url.pathname !== pathname || !pathname.startsWith(new URL(API).pathname + '/')) {
    throw new Error('Invalid GitHub pagination');
  }
  for (const [key, item] of url.searchParams) {
    if (!['page', 'per_page'].includes(key) || !/^[1-9]\d*$/.test(item) ||
        !Number.isSafeInteger(Number(item)) || (key === 'per_page' && Number(item) > 100) ||
        url.searchParams.getAll(key).length !== 1) {
      throw new Error('Invalid GitHub pagination');
    }
  }
  return url.href;
}

function nextPage(header, pathname) {
  if (!header) return null;
  let next = null;
  for (const part of header.split(/,\s*(?=<)/)) {
    const match = part.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    if (!match) throw new Error('Invalid GitHub pagination');
    if (match[2].split(/\s+/).includes('next')) {
      if (next) throw new Error('Invalid GitHub pagination');
      next = pageURL(match[1], pathname);
    }
  }
  return next;
}

export async function createDownloadStore({ token, fetchImpl = globalThis.fetch,
  now = Date.now, refreshMs = 3_600_000 } = {}) {
  if (!integer(refreshMs) || refreshMs === 0) {
    throw new Error('A positive download refresh interval is required');
  }
  let cache = { downloads: null, updatedAt: null, failed: false };
  let retryAt = 0;
  let inFlight = null;
  let controller = null;
  let closed = false;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'andreidamian-website',
    'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;

  function snapshot() {
    return {
      downloads: cache.downloads,
      metric: 'package_downloads',
      updatedAt: cache.updatedAt,
      stale: cache.failed || cache.updatedAt === null || now() - Date.parse(cache.updatedAt) >= refreshMs
    };
  }

  async function* pages(endpoint, signal) {
    const pathname = new URL(endpoint).pathname;
    let url = pageURL(`${endpoint}?per_page=100`, pathname);
    const seen = new Set();
    while (url) {
      if (seen.has(url)) throw new Error('Repeated GitHub pagination');
      seen.add(url);
      signal.throwIfAborted();
      const response = await fetchImpl(url, { headers, redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
      if (!response.ok) {
        const error = new Error('GitHub download refresh failed');
        const retry = response.headers.get('retry-after');
        const retryTime = /^\d+$/.test(retry || '') ? now() + Number(retry) * 1000 : Date.parse(retry);
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        error.retryAt = Math.max(now() + RETRY_MS,
          integer(retryTime) ? retryTime : 0,
          response.headers.get('x-ratelimit-remaining') === '0' && integer(reset) ? reset : 0);
        throw error;
      }
      const entries = await response.json();
      if (!Array.isArray(entries) || entries.length > 100) throw new Error('Invalid GitHub response');
      const next = nextPage(response.headers.get('link'), pathname);
      yield entries;
      url = next;
    }
  }

  async function update() {
    controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]);
    try {
      let downloads = 0;
      const releases = new Set();
      const assetIDs = new Set();
      for await (const page of pages(`${API}/releases`, signal)) {
        for (const release of page) {
          if (!object(release) || !integer(release.id) || !release.id ||
              typeof release.draft !== 'boolean' || typeof release.prerelease !== 'boolean' ||
              releases.has(release.id)) throw new Error('Invalid GitHub release');
          releases.add(release.id);
          if (release.draft) continue;
          for await (const items of pages(`${API}/releases/${release.id}/assets`, signal)) {
            for (const asset of items) {
              if (!object(asset) || !integer(asset.id) || !asset.id ||
                  typeof asset.name !== 'string' || !asset.name || !integer(asset.download_count) ||
                  assetIDs.has(asset.id)) throw new Error('Invalid GitHub asset');
              assetIDs.add(asset.id);
              if (packageName.test(asset.name)) {
                downloads += asset.download_count;
                if (!integer(downloads)) throw new Error('Invalid GitHub download total');
              }
            }
          }
        }
      }
      signal.throwIfAborted();
      cache = { downloads, updatedAt: new Date(now()).toISOString(), failed: false };
      retryAt = 0;
    } catch (error) {
      if (!closed) {
        cache = { ...cache, failed: true };
        retryAt = Math.max(now() + RETRY_MS, error?.retryAt || 0);
      }
    } finally {
      controller = null;
    }
    return snapshot();
  }

  function refresh() {
    if (inFlight) return inFlight;
    if (closed || !snapshot().stale || now() < retryAt) return Promise.resolve(snapshot());
    inFlight = update().finally(() => { inFlight = null; });
    return inFlight;
  }

  return { snapshot, refresh, async close() {
    closed = true;
    controller?.abort();
    await inFlight;
  } };
}
