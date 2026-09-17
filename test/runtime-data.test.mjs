import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { prepareDataDirectory } from '../lib/runtime-data.mjs';

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'andreidamian-data-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('local data directory is usable without a container mount', async (t) => {
  const directory = await temporaryDirectory(t);
  assert.equal(await prepareDataDirectory({ DATA_DIR: directory }), await realpath(directory));
});

test('WAR refuses missing, relative, and repository-local storage', async () => {
  await assert.rejects(prepareDataDirectory({ R1EN_APP_ID: 'test-war' }), /absolute persistent-volume/);
  await assert.rejects(prepareDataDirectory({ R1EN_APP_ID: 'test-war', DATA_DIR: '.data' }), /absolute persistent-volume/);
  const repositoryData = fileURLToPath(new URL('../.data', import.meta.url));
  await assert.rejects(prepareDataDirectory({ R1EN_APP_ID: 'test-war', DATA_DIR: repositoryData }), /outside the repository/);
});

test('WAR refuses a writable directory that is not a persistent mount', async (t) => {
  const directory = await temporaryDirectory(t);
  await assert.rejects(prepareDataDirectory({ R1EN_CONTAINER_NAME: 'test-war', DATA_DIR: directory }), /persistent-volume mount/);
});

test('the counter ledger cannot be placed in public assets, including through a symlink', async (t) => {
  const directory = await temporaryDirectory(t);
  const publicDirectory = fileURLToPath(new URL('../public', import.meta.url));
  await assert.rejects(prepareDataDirectory({ DATA_DIR: publicDirectory }), /outside the public directory/);
  const link = join(directory, 'public-link');
  await symlink(publicDirectory, link);
  await assert.rejects(prepareDataDirectory({ DATA_DIR: link }), /outside the public directory/);
});
