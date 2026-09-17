import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('WAR starts and serves a complete counter without DATA_DIR or filesystem write permission', { timeout: 10_000 }, async (t) => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));

  const repository = fileURLToPath(new URL('../', import.meta.url));
  const fixture = 'data:text/javascript,' + encodeURIComponent(`
    if (process.permission.has('fs.write')) throw new Error('Test must forbid disk writes');
    const release = { id: 1, draft: false, prerelease: false, tag_name: 'v1.3.0',
      published_at: '2026-08-25T17:59:28Z' };
    globalThis.fetch = async (url) => {
      const pathname = new URL(url).pathname;
      return new Response(JSON.stringify(pathname.endsWith('/latest') ? release
        : pathname.endsWith('/assets') ? [{ id: 1,
          name: 'purpleray-sbom-analyzer-v1.3.0-windows-x64.zip', download_count: 7, size: 100,
          browser_download_url: 'https://github.com/aidamian/PurpleRay_SBOM_Analyzer/releases/download/v1.3.0/purpleray-sbom-analyzer-v1.3.0-windows-x64.zip'
        }] : [release]));
    };
  `);
  const child = spawn(process.execPath, [
    '--permission', `--allow-fs-read=${repository}`, '--import', fixture,
    fileURLToPath(new URL('../server.mjs', import.meta.url))
  ], {
    cwd: repository,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      NODE_ENV: 'production',
      R1EN_APP_ID: 'test-war',
      R1EN_CONTAINER_NAME: 'test-war-container',
      R1EN_HOST_ID: 'test-war-node'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
    await exited;
    clearTimeout(timer);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 5000);
    const finish = (error) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    child.once('error', finish);
    child.once('exit', (code) => finish(new Error(`Startup exited ${code}: ${output}`)));
    child.stdout.on('data', () => {
      if (output.includes('Website listening on port')) finish();
    });
  });

  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  for (const path of ['/', '/purpleray']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /class="node-name">test-war-node<\/span>/);
  }
  const stats = await (await fetch(`${base}/api/purpleray/downloads`)).json();
  assert.equal(stats.downloads, 7);
  assert.equal(stats.stale, false);
  assert.equal(stats.metric, 'package_downloads');
  assert.equal(stats.latestRelease.tag, 'v1.3.0');
  assert.equal(stats.releases.windows.assets[0].format, 'zip');
  assert.match(await (await fetch(`${base}/purpleray`)).text(), /releases\/download\/v1.3.0\/purpleray-sbom-analyzer-v1.3.0-windows-x64.zip/);
  assert.doesNotMatch(output, /ERR_ACCESS_DENIED/);
});
