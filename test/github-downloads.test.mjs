import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDownloadStore } from '../lib/github-downloads.mjs';

const API = 'https://api.github.com/repos/aidamian/PurpleRay_SBOM_Analyzer';
const release = (id, options = {}) => ({ id, draft: false, prerelease: false, ...options });
const asset = (id, count = 1, name = `purpleray-sbom-analyzer-v1.3.0-windows-x64.zip`) =>
  ({ id, name, download_count: count });
const response = (body, headers = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const next = (endpoint, page = 2) => `<${endpoint}?per_page=100&page=${page}>; rel="next"`;

async function fixture(t, fetchImpl, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'purpleray-downloads-'));
  const clock = { time: Date.parse('2026-09-17T12:00:00Z') };
  const stores = [];
  const create = async (overrides = {}) => {
    const store = await createDownloadStore({ dataDir, fetchImpl, now: () => clock.time,
      ...options, ...overrides });
    stores.push(store);
    return store;
  };
  t.after(async () => {
    for (const store of stores) await store.close();
    await rm(dataDir, { recursive: true, force: true });
  });
  return { dataDir, clock, create, store: await create() };
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
  assert.deepEqual(store.snapshot(), { downloads: null, metric: 'package_downloads', updatedAt: null, stale: true });
  const result = await store.refresh();
  assert.equal(result.downloads, 117);
  assert.equal(result.stale, false);
  assert.equal(result.updatedAt, '2026-09-17T12:00:00.000Z');
  assert.equal(calls.length, 104);
  await store.refresh();
  assert.equal(calls.length, 104, 'a fresh cache suppresses another traversal');
});

test('retains highest observed counts for deleted/replaced assets and survives a restart', async (t) => {
  let current = [asset(1, 10), asset(2, 4)];
  let calls = 0;
  const { store, create, clock, dataDir } = await fixture(t, async (url) => {
    calls++;
    return response(new URL(url).pathname.endsWith('/releases') ? [release(1)] : current);
  });
  assert.equal((await store.refresh()).downloads, 14);
  current = [asset(1, 8), asset(3, 2)];
  clock.time += 3_600_000;
  assert.equal((await store.refresh()).downloads, 16);
  await store.close();
  const restarted = await create();
  assert.equal(restarted.snapshot().downloads, 16);
  assert.equal((await restarted.refresh()).stale, false);
  assert.equal(calls, 4, 'a fresh persisted ledger also suppresses startup fetches');
  current = [];
  clock.time += 3_600_000;
  assert.equal((await restarted.refresh()).downloads, 16);
  const ledger = JSON.parse(await readFile(join(dataDir, 'purpleray-downloads.json'), 'utf8'));
  assert.deepEqual(Object.keys(ledger.assets), ['1', '2', '3']);
});

test('never publishes partial pages and keeps failures stale with a retry delay across restart', async (t) => {
  let failing = false;
  let calls = 0;
  const { store, clock, create } = await fixture(t, async (url) => {
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
  await store.close();
  const restarted = await create();
  assert.deepEqual(await restarted.refresh(), { ...initial, stale: true });
  assert.equal(calls, 5);
  clock.time += 300_000;
  failing = false;
  assert.equal((await restarted.refresh()).stale, false);
});

test('a first failed fetch stays unavailable rather than becoming zero', async (t) => {
  const { store } = await fixture(t, async () => { throw new Error('secret upstream error'); });
  assert.deepEqual(await store.refresh(), { downloads: null, metric: 'package_downloads', updatedAt: null, stale: true });
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

test('a persistence error leaves the last complete in-memory total unchanged', async (t) => {
  let count = 1;
  const { store, dataDir, clock } = await fixture(t, async (url) =>
    response(new URL(url).pathname.endsWith('/releases') ? [release(1)] : [asset(1, count)]));
  await store.refresh();
  const path = join(dataDir, 'purpleray-downloads.json');
  await rm(path);
  await mkdir(path);
  count = 99;
  clock.time += 3_600_000;
  assert.equal((await store.refresh()).downloads, 1);
  assert.equal(store.snapshot().stale, true);
});

test('rejects corrupt or unsupported ledgers without resetting observed history', async (t) => {
  const { dataDir } = await fixture(t, async () => response([]));
  const path = join(dataDir, 'purpleray-downloads.json');
  const valid = { version: 1, updatedAt: '2026-09-17T12:00:00.000Z',
    assets: { 1: { name: asset(1).name, downloads: 1 } }, retryAt: 0, failed: false };
  for (const invalid of [
    '{bad JSON', JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, updatedAt: null }),
    JSON.stringify({ ...valid, updatedAt: 'invalid-date' }),
    JSON.stringify({ ...valid, assets: { 1: { name: asset(1).name, downloads: -1 } } }),
    JSON.stringify({ ...valid, assets: { 1: { name: 'SHA256SUMS.txt', downloads: 12 } } })
  ]) {
    await writeFile(path, invalid);
    await assert.rejects(createDownloadStore({ dataDir }), /Invalid or unreadable PurpleRay download ledger/);
    assert.equal(await readFile(path, 'utf8'), invalid);
  }
});
