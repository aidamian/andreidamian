import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readSiteVersion } from '../lib/site-version.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'site-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '2.3.4' }));
  await mkdir(join(root, '.git', 'refs', 'heads'), { recursive: true });
  return root;
}

test('reads the checkout revision for loose refs, packed refs, and detached HEAD without Git commands', async (t) => {
  const root = await fixture(t);
  const packedRevision = 'a'.repeat(40);
  const looseRevision = 'b'.repeat(40);
  const detachedRevision = 'c'.repeat(40);
  await writeFile(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  await writeFile(join(root, '.git', 'packed-refs'), `# pack-refs\n${packedRevision} refs/heads/main\n`);
  assert.deepEqual(await readSiteVersion(root), { version: '2.3.4', revision: packedRevision });
  await writeFile(join(root, '.git', 'refs', 'heads', 'main'), looseRevision + '\n');
  assert.equal((await readSiteVersion(root)).revision, looseRevision, 'a newer loose ref overrides a packed one');
  await writeFile(join(root, '.git', 'HEAD'), detachedRevision + '\n');
  assert.equal((await readSiteVersion(root)).revision, detachedRevision);
});

test('source exports and unusable Git metadata retain the package version without leaking file contents', async (t) => {
  const root = await fixture(t);
  await writeFile(join(root, '.git', 'config'), 'must-never-be-published');
  for (const head of ['ref: refs/../../.env', 'ref: refs/heads/missing', '<script>bad</script>', 'not-a-commit']) {
    await writeFile(join(root, '.git', 'HEAD'), head);
    assert.deepEqual(await readSiteVersion(root), { version: '2.3.4', revision: null });
  }
  await rm(join(root, '.git'), { recursive: true });
  assert.deepEqual(await readSiteVersion(root), { version: '2.3.4', revision: null });
});
