import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../server.mjs';

async function startServer(t, env = {}, options = {}) {
  const app = await createApp(env, options);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('both homepage URLs render the WAR node, without caching or leaking other environment values', async (t) => {
  const base = await startServer(t, {
    R1EN_HOST_ID: '  production-node  ',
    R1EN_HOST_ADDR: '0xai_public-node-address',
    EE_HOST_ID: 'legacy-node',
    EE_HOST_ADDR: 'legacy-address',
    R1EN_HOST_IP: 'private-host-ip',
    GITHUB_TOKEN: 'must-stay-private'
  });

  for (const path of ['/', '/index.html', '/%69ndex.html', '/index%2ehtml', '/index.html/', '/%2e/index.html', '/purpleray']) {
    const response = await fetch(`${base}${path}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(html, /Served by .*Ratio1<\/a> node/);
    assert.match(html, /title="0xai_public-node-address">production-node<\/span>/);
    assert.doesNotMatch(html, /legacy-node|legacy-address|private-host-ip|must-stay-private|<!-- RATIO1_NODE -->/);
  }
});

test('both pages and response headers identify the same site release as the uncached health endpoint', async (t) => {
  const base = await startServer(t);
  const health = await fetch(`${base}/healthz`);
  const { status, version, revision } = await health.json();
  assert.equal(status, 'ok');
  assert.match(version, /^\d+\.\d+\.\d+/);
  assert.ok(revision === null || /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision));
  assert.equal(health.headers.get('cache-control'), 'no-store');

  for (const path of ['/', '/index.html', '/purpleray']) {
    const response = await fetch(`${base}${path}`);
    const html = await response.text();
    assert.equal(response.headers.get('x-site-version'), version);
    assert.equal(response.headers.get('x-site-revision'), revision);
    assert.ok(html.includes(`class="site-version">Site v${version} · `));
    if (revision) {
      assert.ok(html.includes(`title="Git commit ${revision}">commit ${revision.slice(0, 12)}</span>`));
    } else {
      assert.match(html, /revision unavailable/);
    }
    assert.doesNotMatch(html, /<!-- SITE_VERSION -->|Site version unavailable/);
  }
});

test('PurpleRay has its own content and all aliases redirect to its canonical URL', async (t) => {
  const base = await startServer(t);
  const html = await (await fetch(`${base}/purpleray`)).text();
  assert.match(html, /<title>PurpleRay/);
  assert.match(html, /href="https:\/\/github.com\/aidamian\/PurpleRay_SBOM_Analyzer\/releases\/latest"/);
  assert.match(html, /rel="canonical" href="https:\/\/andreidamian.ro\/purpleray"/);

  for (const path of ['/purpleray/', '/purpleray/index.html', '/purpleray/index%2ehtml', '/%70urpleray']) {
    const response = await fetch(`${base}${path}?source=test`, { redirect: 'manual' });
    assert.equal(response.status, 308, path);
    assert.equal(response.headers.get('location'), '/purpleray?source=test');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }

  const image = await fetch(`${base}/purpleray/application-overview.png`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /image\/png/);
});

test('stats requests return the cached result without triggering upstream refreshes', async (t) => {
  let refreshes = 0;
  const snapshot = { downloads: 73, metric: 'package_downloads', updatedAt: '2026-09-17T12:00:00.000Z', stale: true };
  const base = await startServer(t, {}, {
    downloadStore: { snapshot: () => snapshot, refresh: () => refreshes++ }
  });
  for (let i = 0; i < 3; i++) {
    const response = await fetch(`${base}/api/purpleray/downloads`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), snapshot);
  }
  assert.equal(refreshes, 0);
});

test('pages bypass previously cached assets with stable versioned URLs', async (t) => {
  const base = await startServer(t);
  const home = await (await fetch(base)).text();
  const project = await (await fetch(`${base}/purpleray`)).text();
  const homeCss = home.match(/href="(\/styles\.css\?v=[a-f0-9]+)"/)?.[1];
  const projectCss = project.match(/href="(\/styles\.css\?v=[a-f0-9]+)"/)?.[1];
  const script = project.match(/src="(\/purpleray\/downloads\.js\?v=[a-f0-9]+)"/)?.[1];
  assert.ok(homeCss, 'the stylesheet must have a new cache key');
  assert.equal(projectCss, homeCss);
  assert.ok(script, 'the counter script must have a new cache key');
  const cachedCopies = new Map([['/styles.css', 'obsolete stylesheet'], ['/purpleray/downloads.js', 'obsolete script']]);
  for (const asset of [homeCss, script]) {
    assert.equal(cachedCopies.has(asset), false);
    const response = await fetch(`${base}${asset}`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), await (await fetch(`${base}${asset.split('?')[0]}`)).text());
  }
  assert.equal((await (await fetch(base)).text()).match(/href="(\/styles\.css\?v=[a-f0-9]+)"/)?.[1], homeCss);
});

test('stats remain unavailable before the first complete snapshot', async (t) => {
  const base = await startServer(t);
  const response = await fetch(`${base}/api/purpleray/downloads`);
  assert.deepEqual(await response.json(), {
    downloads: null, metric: 'package_downloads', updatedAt: null, stale: true,
    releases: null, latestRelease: null
  });
});

test('platform downloads are rendered from the current cache, including archived macOS and refreshes without restart', async (t) => {
  const repository = 'https://github.com/aidamian/PurpleRay_SBOM_Analyzer';
  const packageRelease = (tag, publishedAt, packages) => ({
    tag, publishedAt, url: `${repository}/releases/tag/${tag}`,
    assets: packages.map(([name, format, architecture]) => ({
      name, format, architecture, size: 100,
      url: `${repository}/releases/download/${tag}/${name}`
    }))
  });
  let snapshot = { downloads: 52, metric: 'package_downloads', stale: false,
    updatedAt: '2026-09-17T12:00:00Z', latestRelease: { tag: 'v1.3.0' },
    releases: {
      windows: packageRelease('v1.3.0', '2026-08-25T17:59:28Z', [['windows.zip', 'zip', 'x64']]),
      linux: packageRelease('v1.3.0', '2026-08-25T17:59:28Z', [['linux.tar.gz', 'tar.gz', 'x64'], ['linux.deb', 'deb', 'x64']]),
      macos: packageRelease('v0.1.0', '2026-08-18T16:10:00Z', [['macos.zip', 'zip', null]])
    }
  };
  const base = await startServer(t, {}, { downloadStore: { snapshot: () => snapshot } });
  let html = await (await fetch(`${base}/purpleray`)).text();
  for (const platform of Object.values(snapshot.releases)) {
    for (const asset of platform.assets) assert.ok(html.includes(`href="${asset.url}"`));
  }
  assert.match(html, /Archived release:.*v0.1.0/);
  assert.match(html, /Builds temporarily paused/);
  assert.match(html, /Download archived ZIP/);
  assert.match(html, /Experimental archive/);
  assert.doesNotMatch(html, /<!-- RELEASE_OPTIONS -->/);
  const vNext = packageRelease('v1.4.0', '2026-09-18T10:00:00Z', [['new-windows.zip', 'zip', 'x64']]);
  snapshot = { ...snapshot, latestRelease: { tag: 'v1.4.0' }, releases: { ...snapshot.releases, windows: vNext } };
  html = await (await fetch(`${base}/purpleray`)).text();
  assert.ok(html.includes(vNext.assets[0].url));
  assert.ok(!html.includes('/releases/download/v1.3.0/windows.zip'));
  snapshot = { ...snapshot, stale: true };
  assert.match(await (await fetch(`${base}/purpleray`)).text(), /Showing the last available package links/);
});

test('platform options remain usable without an API snapshot and reject unsafe asset links', async (t) => {
  const base = await startServer(t, {}, { downloadStore: { snapshot: () => ({
    releases: { windows: { tag: '<img src=x onerror=alert(1)>', assets: [
      { name: 'bad.zip', format: 'zip', url: 'javascript:alert(1)' }
    ] } }
  }) } });
  const html = await (await fetch(`${base}/purpleray`)).text();
  for (const name of ['Windows', 'Linux', 'macOS']) assert.ok(html.includes(`<h3>${name}</h3>`));
  assert.match(html, /\/releases\/latest/);
  assert.match(html, /Builds temporarily paused/);
  assert.doesNotMatch(html, /javascript:|onerror=|<img src=x/);
});

test('supports legacy WAR variables when the new fields are missing or blank', async (t) => {
  const base = await startServer(t, {
    R1EN_HOST_ID: ' ',
    R1EN_HOST_ADDR: '',
    EE_HOST_ID: 'legacy-node',
    EE_HOST_ADDR: '0xai_legacy'
  });
  const html = await (await fetch(base)).text();
  assert.match(html, /title="0xai_legacy">legacy-node<\/span>/);
});

test('uses the public node address if the node has no display name', async (t) => {
  const base = await startServer(t, { R1EN_HOST_ADDR: '0xai_address-only' });
  const html = await (await fetch(base)).text();
  assert.match(html, />0xai_address-only<\/span>/);
});

test('shows an honest fallback outside WAR', async (t) => {
  const base = await startServer(t);
  const html = await (await fetch(base)).text();
  assert.match(html, /Node information unavailable/);
  assert.doesNotMatch(html, /Served by .*Ratio1<\/a> node/);
});

test('node values cannot inject markup or attributes', async (t) => {
  const base = await startServer(t, {
    R1EN_HOST_ID: '<script>alert("node")</script> & $&',
    R1EN_HOST_ADDR: '" onmouseover="alert(1)'
  });
  const html = await (await fetch(base)).text();
  assert.match(html, /&lt;script&gt;alert\(&quot;node&quot;\)&lt;\/script&gt; &amp; \$&amp;/);
  assert.match(html, /title="&quot; onmouseover=&quot;alert\(1\)"/);
  assert.doesNotMatch(html, /<script>|title="" onmouseover=/);
});

test('serves public assets and health but keeps repository files private and unknown routes at 404', async (t) => {
  const base = await startServer(t);
  const stylesheet = await fetch(`${base}/styles.css`);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('content-type'), /text\/css/);

  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');

  for (const path of ['/missing-page', '/server.mjs', '/package.json', '/.env', '/%2e%2e%2fpackage.json']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
  }
});
