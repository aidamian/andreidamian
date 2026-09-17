import { mkdir, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryDirectory = fileURLToPath(new URL('../', import.meta.url));

function isWithin(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

export async function prepareDataDirectory(env = process.env) {
  const inWar = Boolean(env.R1EN_APP_ID || env.R1EN_CONTAINER_NAME || env.EE_CONTAINER_NAME);
  const configured = env.DATA_DIR?.trim();
  if (inWar && (!configured || !isAbsolute(configured))) {
    throw new Error('WAR requires DATA_DIR to name an absolute persistent-volume mount, such as /data');
  }

  const directory = resolve(repositoryDirectory, configured || '.data');
  if (isWithin(resolve(repositoryDirectory, 'public'), directory)) {
    throw new Error('DATA_DIR must be outside the public directory');
  }

  if (inWar) {
    if (isWithin(repositoryDirectory, directory)) {
      throw new Error('WAR DATA_DIR must be outside the repository, which is replaced on restart');
    }
    const mountedDirectory = await realpath(directory);
    const mounts = await readFile('/proc/self/mountinfo', 'utf8');
    const hasVolume = mounts.split('\n').some((line) => {
      const point = line.split(' ')[4]?.replace(/\\([0-7]{3})/g, (_, code) => String.fromCharCode(parseInt(code, 8)));
      const type = line.split(' - ')[1]?.split(' ')[0];
      return point === mountedDirectory && point !== '/' && !['tmpfs', 'ramfs'].includes(type);
    });
    if (!hasVolume) {
      throw new Error('WAR DATA_DIR must be a persistent-volume mount; refusing an ephemeral counter ledger');
    }
    if (isWithin(repositoryDirectory, mountedDirectory)) {
      throw new Error('WAR DATA_DIR must resolve outside the repository');
    }
    return mountedDirectory;
  }

  await mkdir(directory, { recursive: true });
  const resolved = await realpath(directory);
  if (isWithin(resolve(repositoryDirectory, 'public'), resolved)) {
    throw new Error('DATA_DIR must resolve outside the public directory');
  }
  return resolved;
}
