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
    downloads: null, metric: 'package_downloads', updatedAt: null, stale: true
  });
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
  assert.deepEqual(await health.json(), { status: 'ok' });

  for (const path of ['/missing-page', '/server.mjs', '/package.json', '/.env', '/%2e%2e%2fpackage.json']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
  }
});
