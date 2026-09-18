import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const validRevision = (value) => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value);

async function readGitDirectory(root) {
  const path = join(root, '.git');
  if ((await stat(path)).isDirectory()) return path;
  const pointer = (await readFile(path, 'utf8')).match(/^gitdir: ([^\r\n\0]+)\r?\n?$/)?.[1];
  return pointer ? resolve(root, pointer) : null;
}

async function readCommonDirectory(gitDirectory) {
  try {
    const pointer = (await readFile(join(gitDirectory, 'commondir'), 'utf8'))
      .match(/^([^\r\n\0]+)\r?\n?$/)?.[1];
    return pointer ? resolve(gitDirectory, pointer) : null;
  } catch (error) {
    if (error.code === 'ENOENT') return gitDirectory;
    throw error;
  }
}

async function readRevision(root) {
  try {
    const gitDirectory = await readGitDirectory(root);
    if (!gitDirectory) return null;
    const head = (await readFile(join(gitDirectory, 'HEAD'), 'utf8')).trim();
    if (validRevision(head)) return head.toLowerCase();

    const reference = head.match(/^ref: (refs\/[A-Za-z0-9_./-]+)$/)?.[1];
    if (!reference || reference.split('/').some((part) => !part || part === '.' || part === '..')) return null;
    const commonDirectory = await readCommonDirectory(gitDirectory);
    if (!commonDirectory) return null;
    // Linked worktrees share ordinary refs but keep these namespaces local.
    const referenceDirectory = /^refs\/(?:bisect|rewritten|worktree)\//.test(reference)
      ? gitDirectory : commonDirectory;
    try {
      const revision = (await readFile(join(referenceDirectory, reference), 'utf8')).trim();
      return validRevision(revision) ? revision.toLowerCase() : null;
    } catch (error) {
      if (error.code !== 'ENOENT') return null;
    }

    const packed = await readFile(join(commonDirectory, 'packed-refs'), 'utf8');
    for (const line of packed.split('\n')) {
      const [revision, name] = line.trim().split(' ');
      if (name === reference && validRevision(revision)) return revision.toLowerCase();
    }
  } catch {
    // Source exports may omit Git metadata. Serving the site must still work.
  }
  return null;
}

export async function readSiteVersion(root = repository) {
  const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('package.json must contain a valid site version');
  }
  return { version, revision: await readRevision(root) };
}

export function renderSiteVersion({ version, revision }) {
  const revisionLabel = revision
    ? `<span title="Git commit ${revision}">commit ${revision.slice(0, 12)}</span>`
    : 'revision unavailable';
  return `Site v${version} · ${revisionLabel}`;
}
