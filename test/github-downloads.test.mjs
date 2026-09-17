import assert from 'node:assert/strict';
import test from 'node:test';
import { createDownloadStore } from '../lib/github-downloads.mjs';

const API = 'https://api.github.com/repos/aidamian/PurpleRay_SBOM_Analyzer';
const REPOSITORY = 'https://github.com/aidamian/PurpleRay_SBOM_Analyzer';
const release = (id, options = {}) => ({ id, draft: false, prerelease: false, ...options });
const asset = (id, count = 1, name = `purpleray-sbom-analyzer-v1.3.0-windows-x64.zip`) =>
  ({ id, name, download_count: count });
const response = (body, headers = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const next = (endpoint, page = 2) => `<${endpoint}?per_page=100&page=${page}>; rel="next"`;
const publishedRelease = (id, tag, date, options = {}) =>
  release(id, { tag_name: tag, published_at: date, ...options });
const publishedAsset = (id, tag, name, options = {}) => ({ ...asset(id, 1, name),
  size: 123456, browser_download_url:
    `${REPOSITORY}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`,
  ...options });

async function fixture(t, fetchImpl, options = {}) {
  const clock = { time: Date.parse('2026-09-17T12:00:00Z') };
  const stores = [];
  const { fetchLatest = async () => response({}, {}, 404), ...storeOptions } = options;
  const fetchWithLatest = (url, init) => url === `${API}/releases/latest` ?
    fetchLatest(url, init) : fetchImpl(url, init);
  const create = async (overrides = {}) => {
    const store = await createDownloadStore({ fetchImpl: fetchWithLatest, now: () => clock.time,
      ...storeOptions, ...overrides });
    stores.push(store);
    return store;
  };
  t.after(async () => {
    for (const store of stores) await store.close();
  });
  return { clock, create, store: await create() };
}

test('starts unavailable and counts historical/current packages, prereleases, and every pagination page', async (t) => {
  const calls = [];
  const names = [
    'sbom-analyzer-v0.1.0-macos.zip', 'sbom-analyzer-v0.2.0-linux-x64',
    'sbom-analyzer-v0.3.3-windows-x64.zip', 'purpleray-sbom-analyzer-v0.6.0-linux-x64',
    'purpleray-sbom-analyzer-v1.3.0-linux-x64.tar.gz',
    'purpleray-sbom-analyzer_1.3.0_amd64.deb',
    'purpleray-sbom-analyzer-v2.0.0-rc.1-windows-x64.zip'
  ];
  const ignored = ['SHA256SUMS.txt', 'purpleray-sbom-analyzer.json',
    'purpleray-sbom-analyzer-v1.3.0-winget-manifests.zip', 'source.zip', 'unrelated-windows-x64.zip'];
  const { store } = await fixture(t, async (url) => {
    calls.push(url);
    const { pathname, searchParams } = new URL(url);
    const second = searchParams.get('page') === '2';
    if (pathname.endsWith('/releases')) {
      return second ? response([release(101, { prerelease: true }), release(102, { draft: true })]) :
        response(Array.from({ length: 100 }, (_, index) => release(index + 1)),
          { Link: next(`${API}/releases`) });
    }
    if (pathname.endsWith('/releases/1/assets')) {
      return second ? response([...names.map((name, i) => asset(101 + i, 2, name)),
        ...ignored.map((name, i) => asset(201 + i, 1000, name))]) :
        response(Array.from({ length: 100 }, (_, i) => asset(i + 1)),
          { Link: next(`${API}/releases/1/assets`) });
    }
    if (pathname.endsWith('/releases/101/assets')) return response([asset(301, 3)]);
    assert.ok(!pathname.endsWith('/releases/102/assets'), 'draft assets must not be fetched');
    return response([]);
  });
  assert.deepEqual(store.snapshot(), { downloads: null, releases: null, latestRelease: null,
    metric: 'package_downloads', updatedAt: null, stale: true });
  const result = await store.refresh();
  assert.equal(result.downloads, 117);
  assert.equal(result.stale, false);
  assert.equal(result.updatedAt, '2026-09-17T12:00:00.000Z');
  assert.deepEqual(result.releases, { windows: null, linux: null, macos: null },
    'older counter fixtures without catalog metadata still produce a complete count');
  assert.equal(calls.length, 104);
  await store.refresh();
  assert.equal(calls.length, 104, 'a fresh cache suppresses another traversal');
});

test('recomputes lower GitHub totals after deletion/reset and independent replicas converge', async (t) => {
  let current = [asset(1, 10), asset(2, 4)];
  let calls = 0;
  const { store, create, clock } = await fixture(t, async (url) => {
    calls++;
    return response(new URL(url).pathname.endsWith('/releases') ? [release(1)] : current);
  });
  assert.equal((await store.refresh()).downloads, 14);
  const replica = await create();
  assert.equal(replica.snapshot().downloads, null);
  assert.equal((await replica.refresh()).downloads, 14);
  current = [asset(1, 8), asset(3, 2)];
  clock.time += 3_600_000;
  assert.equal((await store.refresh()).downloads, 10);
  assert.equal(replica.snapshot().downloads, 14, 'each replica keeps its own temporary cache');
  assert.equal((await replica.refresh()).downloads, 10);
  await store.close();
  const restarted = await create();
  assert.deepEqual(restarted.snapshot(), { downloads: null, releases: null, latestRelease: null,
    metric: 'package_downloads', updatedAt: null, stale: true });
  assert.equal((await restarted.refresh()).downloads, 10);
  assert.equal((await restarted.refresh()).stale, false);
  assert.equal(calls, 10, 'a restarted instance fetches GitHub instead of inheriting a cache');
  current = [];
  clock.time += 3_600_000;
  assert.equal((await restarted.refresh()).downloads, 0);
  assert.equal((await replica.refresh()).downloads, 0);
});

test('never publishes partial pages and retains the last complete in-memory result during retry backoff', async (t) => {
  let failing = false;
  let calls = 0;
  const { store, clock } = await fixture(t, async (url) => {
    calls++;
    if (new URL(url).pathname.endsWith('/releases')) return response([release(1)]);
    if (!failing) return response([asset(1, 10)]);
    if (new URL(url).searchParams.has('page')) return response({ message: 'private upstream detail' }, {}, 503);
    return response([asset(1, 900)], { Link: next(`${API}/releases/1/assets`) });
  });
  const initial = await store.refresh();
  failing = true;
  clock.time += 3_600_000;
  assert.deepEqual(await store.refresh(), { ...initial, stale: true });
  assert.equal(calls, 5);
  assert.deepEqual(await store.refresh(), { ...initial, stale: true });
  assert.equal(calls, 5);
  clock.time += 300_000;
  failing = false;
  assert.equal((await store.refresh()).stale, false);
});

test('a first failed fetch stays unavailable rather than becoming zero', async (t) => {
  const { store } = await fixture(t, async () => { throw new Error('secret upstream error'); });
  assert.deepEqual(await store.refresh(), { downloads: null, releases: null, latestRelease: null,
    metric: 'package_downloads', updatedAt: null, stale: true });
});

test('honors Retry-After and a later rate limit reset without request-triggered retry loops', async (t) => {
  let calls = 0;
  let clock;
  const context = await fixture(t, async () => {
    calls++;
    return response({}, { 'Retry-After': '600', 'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String((clock.time + 1_800_000) / 1000) }, 429);
  });
  clock = context.clock;
  await context.store.refresh();
  clock.time += 1_799_999;
  await context.store.refresh();
  assert.equal(calls, 1);
  clock.time++;
  await context.store.refresh();
  assert.equal(calls, 2);
});

test('accepts an HTTP-date Retry-After', async (t) => {
  let calls = 0;
  const { store, clock } = await fixture(t, async () => {
    calls++;
    return response({}, { 'Retry-After': 'Thu, 17 Sep 2026 13:00:00 GMT' }, 503);
  });
  await store.refresh();
  clock.time += 3_599_999;
  await store.refresh();
  assert.equal(calls, 1);
  clock.time++;
  await store.refresh();
  assert.equal(calls, 2);
});

test('concurrent refreshes share one request, and close aborts work and prevents later refreshes', async (t) => {
  let calls = 0;
  let observedSignal;
  const { store } = await fixture(t, (_url, { signal }) => {
    calls++;
    observedSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
  const first = store.refresh();
  const second = store.refresh();
  assert.equal(first, second);
  await new Promise((resolve) => setImmediate(resolve));
  await store.close();
  assert.equal(observedSignal.aborted, true);
  assert.equal((await first).downloads, null);
  await store.refresh();
  assert.equal(calls, 1);
});

test('allows only same-repository pagination and never forwards credentials to redirects or other hosts', async (t) => {
  for (const target of [
    'https://evil.example/releases?page=2',
    'https://api.github.com/repos/other/project/releases?page=2',
    `${API}/releases?per_page=100&page=2&token=bad`,
    `${API}/releases/1/assets?page=2`,
    `http://api.github.com/repos/aidamian/PurpleRay_SBOM_Analyzer/releases?page=2`,
    'https://token@api.github.com/repos/aidamian/PurpleRay_SBOM_Analyzer/releases?page=2'
  ]) {
    let calls = 0;
    const { store } = await fixture(t, async (url, options) => {
      calls++;
      assert.equal(url, `${API}/releases?per_page=100`);
      assert.equal(options.headers.Authorization, 'Bearer test-private-token');
      assert.equal(options.redirect, 'error');
      return response([release(1)], { Link: `<${target}>; rel="next"` });
    }, { token: 'test-private-token' });
    const result = await store.refresh();
    assert.equal(result.downloads, null);
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(result), /test-private-token|evil/);
  }
});

test('rejects malformed responses and pagination instead of publishing incomplete totals', async (t) => {
  for (const invalid of [
    response({ releases: [] }),
    response([release(1), release(1)]),
    response([release(1)], { Link: 'malformed pagination' }),
    response([release(1)], { Link: next(`${API}/releases`, 1) })
  ]) {
    const { store } = await fixture(t, async (url) =>
      new URL(url).pathname.endsWith('/assets') ? response([]) : invalid.clone());
    assert.equal((await store.refresh()).downloads, null);
  }
});

test('invalid or duplicate asset data cannot replace a successful cached result', async (t) => {
  let current = [asset(1, 7)];
  const { store, clock } = await fixture(t, async (url) =>
    response(new URL(url).pathname.endsWith('/releases') ? [release(1)] : current));
  await store.refresh();
  for (const invalid of [[asset(1, -1)], [asset(1, 10), asset(1, 20)],
    [asset(1, Number.MAX_SAFE_INTEGER), asset(2, 1)], [{ ...asset(1), id: '1' }]]) {
    current = invalid;
    clock.time += 3_600_000;
    const result = await store.refresh();
    assert.equal(result.downloads, 7);
    assert.equal(result.stale, true);
  }
});

test('can initialize without options and rejects invalid refresh intervals', async () => {
  const store = await createDownloadStore();
  assert.deepEqual(store.snapshot(), { downloads: null, releases: null, latestRelease: null,
    metric: 'package_downloads', updatedAt: null, stale: true });
  await store.close();
  for (const refreshMs of [0, -1, Infinity, NaN, 1.5]) {
    await assert.rejects(createDownloadStore({ refreshMs }), /positive download refresh interval/);
  }
});

test('selects the latest stable release per platform and all its formats during the existing paginated traversal', async (t) => {
  const releases = [
    publishedRelease(20, 'v1.4.0', '2026-09-01T10:00:00Z'),
    publishedRelease(50, 'v2.0.0-rc.1', '2026-09-10T10:00:00Z', { prerelease: true }),
    publishedRelease(60, 'v2.0.0', '2026-09-17T10:00:00Z', { draft: true }),
    publishedRelease(10, 'v1.3.0', '2026-08-25T10:00:00Z'),
    publishedRelease(3, 'v0.3.3', '2026-06-01T10:00:00Z'),
    publishedRelease(80, 'v9.0.0', '2026-05-01T10:00:00Z')
  ];
  const packages = new Map([
    [20, [publishedAsset(201, 'v1.4.0', 'purpleray-sbom-analyzer-v1.4.0-windows-x64.zip')]],
    [50, [publishedAsset(501, 'v2.0.0-rc.1', 'purpleray-sbom-analyzer-v2.0.0-rc.1-windows-x64.zip'),
      publishedAsset(502, 'v2.0.0-rc.1', 'purpleray-sbom-analyzer-v2.0.0-rc.1-linux-x64.tar.gz'),
      publishedAsset(503, 'v2.0.0-rc.1', 'purpleray-sbom-analyzer-v2.0.0-rc.1-macos.zip')]],
    [10, [publishedAsset(101, 'v1.3.0', 'purpleray-sbom-analyzer_1.3.0_amd64.deb'),
      publishedAsset(102, 'v1.3.0', 'purpleray-sbom-analyzer-v1.3.0-linux-x64.tar.gz'),
      publishedAsset(103, 'v1.3.0', 'purpleray-sbom-analyzer-v1.3.0-windows-x64.zip')]],
    [3, [publishedAsset(31, 'v0.3.3', 'sbom-analyzer-v0.3.3-macos.zip'),
      publishedAsset(32, 'v0.3.3', 'sbom-analyzer-v0.3.3-linux-x64'),
      publishedAsset(33, 'v0.3.3', 'source.zip', { download_count: 1000 })]],
    [80, [publishedAsset(801, 'v9.0.0', 'purpleray-sbom-analyzer-v9.0.0-windows-x64.zip')]]
  ]);
  const calls = [];
  const { store } = await fixture(t, async (url) => {
    calls.push(url);
    const { pathname, searchParams } = new URL(url);
    const second = searchParams.has('page');
    if (pathname.endsWith('/releases')) return second ? response(releases.slice(3)) :
      response(releases.slice(0, 3), { Link: next(`${API}/releases`) });
    const id = Number(pathname.match(/\/releases\/(\d+)\/assets$/)[1]);
    assert.notEqual(id, 60, 'draft assets must not be fetched');
    if (id === 10) return second ? response(packages.get(10).slice(1)) :
      response(packages.get(10).slice(0, 1), { Link: next(`${API}/releases/10/assets`) });
    return response(packages.get(id));
  });
  const result = await store.refresh();
  assert.equal(result.downloads, 10, 'prerelease packages remain part of the total');
  assert.equal(calls.length, 8, 'catalog and counter share the same traversal');
  assert.equal(result.releases.windows.tag, 'v1.4.0');
  assert.equal(result.releases.linux.tag, 'v1.3.0');
  assert.equal(result.releases.macos.tag, 'v0.3.3');
  assert.deepEqual(result.releases.linux.assets.map((item) => item.format), ['tar.gz', 'deb']);
  assert.deepEqual(result.releases.macos, {
    tag: 'v0.3.3', url: `${REPOSITORY}/releases/tag/v0.3.3`, publishedAt: '2026-06-01T10:00:00Z',
    assets: [{ name: 'sbom-analyzer-v0.3.3-macos.zip',
      url: `${REPOSITORY}/releases/download/v0.3.3/sbom-analyzer-v0.3.3-macos.zip`,
      format: 'zip', architecture: null, size: 123456 }]
  });
  for (const platform of ['windows', 'linux']) {
    assert.ok(result.releases[platform].assets.every((item) => item.architecture === 'x64'));
  }
});

test('catalog selection uses publication time with a deterministic release-ID tie break and supports historical Linux binaries', async (t) => {
  const date = '2026-08-01T10:00:00Z';
  const older = publishedRelease(1, 'v0.1.0', date);
  const newer = publishedRelease(2, 'v0.2.0', date, { html_url: 'https://untrusted.example/release' });
  for (const order of [[older, newer], [newer, older]]) {
    const { store } = await fixture(t, async (url) => {
      const { pathname } = new URL(url);
      if (pathname.endsWith('/releases')) return response(order);
      const chosen = pathname.endsWith('/1/assets') ? older : newer;
      return response([publishedAsset(chosen.id, chosen.tag_name,
        `sbom-analyzer-${chosen.tag_name}-linux-x64`)]);
    });
    const result = await store.refresh();
    assert.equal(result.releases.linux.tag, 'v0.2.0');
    assert.equal(result.releases.linux.url, `${REPOSITORY}/releases/tag/v0.2.0`);
    assert.equal(result.releases.linux.assets[0].format, 'binary');
    assert.equal(result.releases.windows, null);
    assert.equal(result.releases.macos, null);
  }
});

test('unsafe package URLs never enter the catalog or displace an older safe download', async (t) => {
  const name = 'purpleray-sbom-analyzer-v1.3.0-windows-x64.zip';
  const expected = `${REPOSITORY}/releases/download/v1.3.0/${name}`;
  const unsafe = [
    expected.replace('https:', 'http:'), expected.replace('github.com', 'github.com.evil.example'),
    expected.replace('/aidamian/', '/someone-else/'), expected.replace('PurpleRay_SBOM_Analyzer', 'another-project'),
    expected.replace('/v1.3.0/', '/v1.2.0/'), expected.replace(name, 'another-file.zip'),
    `${expected}?token=private`, `${expected}#fragment`, `${expected}?`, `${expected}#`,
    expected.replace('https://', 'https://user:password@'),
    expected.replace('https://', 'https://@'),
    expected.replace('github.com', 'github.com:8443'), `javascript:alert(1)`, '//github.com/download',
    'https://github.com/aidamian/PurpleRay_SBOM_Analyzer/releases/download/v1.3.0/%2e%2e/escape.zip'
  ];
  const { store } = await fixture(t, async (url) => {
    const { pathname } = new URL(url);
    if (pathname.endsWith('/releases')) return response([
      publishedRelease(2, 'v1.3.0', '2026-09-01T10:00:00Z'),
      publishedRelease(1, 'v1.2.0', '2026-08-01T10:00:00Z')
    ]);
    if (pathname.endsWith('/2/assets')) return response(unsafe.map((browser_download_url, i) =>
      publishedAsset(i + 10, 'v1.3.0', name, { browser_download_url })));
    return response([publishedAsset(1, 'v1.2.0', 'purpleray-sbom-analyzer-v1.2.0-windows-x64.zip')]);
  });
  const result = await store.refresh();
  assert.equal(result.downloads, unsafe.length + 1, 'URL metadata does not change the counter');
  assert.equal(result.releases.windows.tag, 'v1.2.0');
  assert.doesNotMatch(JSON.stringify(result.releases), /private|evil|password|javascript/);
});

test('missing or malformed catalog metadata skips candidates without invalidating package counts', async (t) => {
  const goodRelease = publishedRelease(1, 'v1.3.0', '2026-08-25T10:00:00Z');
  const goodAsset = publishedAsset(1, 'v1.3.0', 'purpleray-sbom-analyzer-v1.3.0-windows-x64.zip');
  const cases = [
    [{ tag_name: undefined }, {}], [{ tag_name: '' }, {}], [{ tag_name: '.' }, {}],
    [{ tag_name: '..' }, {}], [{ tag_name: 'v1.3.0\n' }, {}], [{ tag_name: '\ud800' }, {}],
    [{ published_at: undefined }, {}], [{ published_at: null }, {}],
    [{ published_at: 'not-a-date' }, {}], [{ published_at: '1' }, {}],
    [{ published_at: '2026-99-99T10:00:00Z' }, {}],
    [{ published_at: '2026-02-30T10:00:00Z' }, {}],
    [{}, { size: undefined }], [{}, { size: -1 }], [{}, { size: '123456' }],
    [{}, { browser_download_url: undefined }], [{}, { browser_download_url: {} }]
  ];
  for (const [releaseChanges, assetChanges] of cases) {
    const { store } = await fixture(t, async (url) => response(new URL(url).pathname.endsWith('/releases') ?
      [{ ...goodRelease, ...releaseChanges }] : [{ ...goodAsset, ...assetChanges }]));
    const result = await store.refresh();
    assert.equal(result.downloads, 1);
    assert.equal(result.stale, false);
    assert.deepEqual(result.releases, { windows: null, linux: null, macos: null });
  }
});

test('publishes catalog changes atomically with counts and adopts new releases after a recovered refresh', async (t) => {
  let mode = 'initial';
  const oldRelease = publishedRelease(1, 'v0.1.0', '2026-01-01T10:00:00Z');
  const newRelease = publishedRelease(2, 'v1.3.0', '2026-08-25T10:00:00Z');
  const { store, clock } = await fixture(t, async (url) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname.endsWith('/releases')) return response(mode === 'initial' ? [oldRelease] : [newRelease, oldRelease]);
    if (pathname.endsWith('/1/assets')) return response([
      publishedAsset(1, 'v0.1.0', 'sbom-analyzer-v0.1.0-macos.zip', { download_count: 3 }),
      publishedAsset(2, 'v0.1.0', 'sbom-analyzer-v0.1.0-windows-x64.zip', { download_count: 7 })
    ]);
    if (!searchParams.has('page')) return response([
      publishedAsset(3, 'v1.3.0', 'purpleray-sbom-analyzer-v1.3.0-windows-x64.zip', { download_count: 20 })
    ], { Link: next(`${API}/releases/2/assets`) });
    if (mode === 'failing') {
      assert.equal(store.snapshot().releases.windows.tag, 'v0.1.0', 'partial metadata stays private');
      return response({}, {}, 503);
    }
    return response([
      publishedAsset(4, 'v1.3.0', 'purpleray-sbom-analyzer-v1.3.0-linux-x64.tar.gz', { download_count: 8 })
    ]);
  }, { fetchLatest: async () => response(mode === 'initial' ? oldRelease : newRelease) });
  const initial = await store.refresh();
  assert.equal(initial.downloads, 10);
  assert.equal(initial.latestRelease.tag, 'v0.1.0');
  const callerSnapshot = store.snapshot();
  callerSnapshot.releases.macos.assets[0].url = 'https://untrusted.example';
  assert.equal(store.snapshot().releases.macos.assets[0].url, initial.releases.macos.assets[0].url,
    'callers cannot mutate the cached catalog');
  mode = 'failing';
  clock.time += 3_600_000;
  assert.deepEqual(await store.refresh(), { ...initial, stale: true });
  mode = 'complete';
  clock.time += 300_000;
  const updated = await store.refresh();
  assert.equal(updated.downloads, 38);
  assert.equal(updated.releases.windows.tag, 'v1.3.0');
  assert.equal(updated.releases.linux.tag, 'v1.3.0');
  assert.equal(updated.releases.macos.tag, 'v0.1.0');
  assert.equal(updated.latestRelease.tag, 'v1.3.0');
  assert.equal(updated.stale, false);
  assert.notEqual(updated.updatedAt, initial.updatedAt);
});

test('prefers the GitHub-designated latest release over a subsequently published lower-version backport', async (t) => {
  const latest = publishedRelease(20, 'v1.3.0', '2026-08-25T10:00:00Z',
    { html_url: 'https://untrusted.example/latest' });
  const backport = publishedRelease(30, 'v1.2.1', '2026-09-17T10:00:00Z');
  const mac = publishedRelease(1, 'v0.1.0', '2026-01-01T10:00:00Z');
  for (const order of [[latest, backport, mac], [backport, mac, latest]]) {
    const calls = [];
    const { store } = await fixture(t, async (url) => {
      calls.push(url);
      if (new URL(url).pathname.endsWith('/releases')) return response(order);
      const id = Number(new URL(url).pathname.match(/\/releases\/(\d+)\/assets$/)[1]);
      if (id === 1) return response([publishedAsset(1, mac.tag_name, 'sbom-analyzer-v0.1.0-macos.zip')]);
      const chosen = id === 20 ? latest : backport;
      return response([
        publishedAsset(id * 10, chosen.tag_name, `purpleray-sbom-analyzer-${chosen.tag_name}-windows-x64.zip`),
        publishedAsset(id * 10 + 1, chosen.tag_name, `purpleray-sbom-analyzer-${chosen.tag_name}-linux-x64.tar.gz`)
      ]);
    }, { token: 'test-private-token', fetchLatest: async (url, options) => {
      calls.push(url);
      assert.equal(url, `${API}/releases/latest`);
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer test-private-token');
      return response(latest);
    } });
    const result = await store.refresh();
    assert.equal(calls.length, 5, 'one latest lookup plus the existing release/asset traversal');
    assert.deepEqual(result.latestRelease, { tag: 'v1.3.0',
      url: `${REPOSITORY}/releases/tag/v1.3.0`, publishedAt: '2026-08-25T10:00:00Z' });
    assert.equal(result.releases.windows.tag, 'v1.3.0');
    assert.equal(result.releases.linux.tag, 'v1.3.0');
    assert.equal(result.releases.macos.tag, 'v0.1.0');
    assert.equal(result.downloads, 5, 'backport packages still count toward all-version downloads');
  }
});

test('a failed latest lookup preserves the complete cache and honors rate-limit backoff', async (t) => {
  let limited = false;
  let latestCalls = 0;
  let traversalCalls = 0;
  let count = 8;
  const current = publishedRelease(1, 'v1.3.0', '2026-08-25T10:00:00Z');
  const { store, clock } = await fixture(t, async (url) => {
    traversalCalls++;
    return response(new URL(url).pathname.endsWith('/releases') ? [current] : [
      publishedAsset(1, current.tag_name, 'purpleray-sbom-analyzer-v1.3.0-windows-x64.zip',
        { download_count: count })
    ]);
  }, { fetchLatest: async () => {
    latestCalls++;
    return limited ? response({}, { 'Retry-After': '600' }, 429) : response(current);
  } });
  const initial = await store.refresh();
  assert.equal(initial.downloads, 8);
  limited = true;
  count = 90;
  clock.time += 3_600_000;
  assert.deepEqual(await store.refresh(), { ...initial, stale: true });
  assert.equal(traversalCalls, 2, 'a failed latest lookup cannot publish another traversal');
  clock.time += 599_999;
  assert.deepEqual(await store.refresh(), { ...initial, stale: true });
  assert.equal(latestCalls, 2, 'API reads do not bypass rate-limit backoff');
  clock.time++;
  limited = false;
  const updated = await store.refresh();
  assert.equal(updated.downloads, 90);
  assert.equal(updated.stale, false);
  assert.deepEqual(updated.latestRelease, initial.latestRelease);
});

test('a missing stable latest release leaves the catalog empty while prerelease downloads count', async (t) => {
  const { store } = await fixture(t, async (url) => response(new URL(url).pathname.endsWith('/releases') ?
    [publishedRelease(1, 'v1.4.0-rc.1', '2026-09-17T10:00:00Z', { prerelease: true })] :
    [publishedAsset(1, 'v1.4.0-rc.1', 'purpleray-sbom-analyzer-v1.4.0-rc.1-windows-x64.zip',
      { download_count: 7 })]));
  const result = await store.refresh();
  assert.equal(result.downloads, 7);
  assert.equal(result.latestRelease, null);
  assert.deepEqual(result.releases, { windows: null, linux: null, macos: null });
  assert.equal(result.stale, false);
});
