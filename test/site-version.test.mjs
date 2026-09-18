import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
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

for (const absolute of [false, true]) {
  test(`reads submodule and linked-worktree revisions with ${absolute ? 'absolute' : 'relative'} Git paths`, async (t) => {
    const commonRoot = await fixture(t);
    const root = join(commonRoot, 'checkout');
    const commonDirectory = join(commonRoot, '.git');
    const gitDirectory = join(commonDirectory, 'worktrees', 'checkout');
    await mkdir(root);
    await mkdir(join(gitDirectory, 'refs', 'heads'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ version: '2.3.4' }));
    const pointer = (from, to) => absolute ? to : relative(from, to);
    await writeFile(join(root, '.git'), `gitdir: ${pointer(root, gitDirectory)}\n`);
    const looseRevision = 'd'.repeat(40);
    const packedRevision = 'e'.repeat(40);
    const detachedRevision = 'A'.repeat(64);

    // A submodule's gitfile resolves to its own metadata directory.
    await writeFile(join(gitDirectory, 'HEAD'), 'ref: refs/heads/main\n');
    await writeFile(join(gitDirectory, 'refs', 'heads', 'main'), looseRevision + '\n');
    assert.equal((await readSiteVersion(root)).revision, looseRevision);
    await writeFile(join(gitDirectory, 'HEAD'), detachedRevision + '\n');
    assert.equal((await readSiteVersion(root)).revision, detachedRevision.toLowerCase());

    // Linked worktrees use their own HEAD and the common refs/packed-refs.
    await writeFile(join(gitDirectory, 'HEAD'), 'ref: refs/heads/main\n');
    await writeFile(join(gitDirectory, 'commondir'), pointer(gitDirectory, commonDirectory) + '\n');
    await writeFile(join(commonDirectory, 'HEAD'), 'f'.repeat(40) + '\n');
    await writeFile(join(commonDirectory, 'packed-refs'), `${packedRevision} refs/heads/main\n`);
    assert.equal((await readSiteVersion(root)).revision, packedRevision,
      'worktree-local shadow refs and the common HEAD must not override the shared branch');
    await writeFile(join(commonDirectory, 'refs', 'heads', 'main'), looseRevision + '\n');
    assert.equal((await readSiteVersion(root)).revision, looseRevision);

    await mkdir(join(gitDirectory, 'refs', 'worktree'));
    await writeFile(join(gitDirectory, 'refs', 'worktree', 'local'), packedRevision + '\n');
    await writeFile(join(gitDirectory, 'HEAD'), 'ref: refs/worktree/local\n');
    assert.equal((await readSiteVersion(root)).revision, packedRevision);
  });
}

test('malformed Git pointers, shared paths, and ref contents cannot become published revisions', async (t) => {
  const root = await fixture(t);
  await rm(join(root, '.git'), { recursive: true });
  for (const pointer of ['', 'not-a-gitdir', 'gitdir: missing', 'gitdir: .\nextra', 'gitdir: \0']) {
    await writeFile(join(root, '.git'), pointer);
    assert.deepEqual(await readSiteVersion(root), { version: '2.3.4', revision: null });
  }
  const gitDirectory = join(root, 'metadata');
  await mkdir(join(gitDirectory, 'refs', 'heads'), { recursive: true });
  await writeFile(join(root, '.git'), 'gitdir: metadata\n');
  await writeFile(join(gitDirectory, 'HEAD'), 'ref: refs/heads/main\n');
  await writeFile(join(gitDirectory, 'refs', 'heads', 'main'), 'not-a-hash-or-public-value');
  assert.equal((await readSiteVersion(root)).revision, null);
  await writeFile(join(gitDirectory, 'refs', 'heads', 'main'), 'b'.repeat(40));
  for (const pointer of ['', 'missing', '.\nextra', '\0']) {
    await writeFile(join(gitDirectory, 'commondir'), pointer);
    assert.equal((await readSiteVersion(root)).revision, null);
  }
});
