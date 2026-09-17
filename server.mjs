import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { renderNodeAttribution } from './lib/ratio1-node.mjs';

const publicDirectory = fileURLToPath(new URL('./public/', import.meta.url));

const unavailableDownloads = {
  downloads: null,
  metric: 'package_downloads',
  updatedAt: null,
  stale: true
};

export async function createApp(env = process.env, { downloadStore } = {}) {
  const app = express();
  const assets = await Promise.all(['/styles.css', '/purpleray/downloads.js'].map(async (path) => {
    const contents = await readFile(new URL(`./public${path}`, import.meta.url));
    const version = createHash('sha256').update(contents).digest('hex').slice(0, 16);
    return [path, `${path}?v=${version}`];
  }));
  const routes = [['/', 'index.html'], ['/purpleray', 'purpleray/index.html']];
  const pages = new Map(await Promise.all(routes.map(async ([route, file]) => {
    let template = await readFile(new URL(`./public/${file}`, import.meta.url), 'utf8');
    // A new asset URL bypasses edge/browser copies from earlier deployments.
    for (const [path, versioned] of assets) {
      template = template.replaceAll(`"${path}"`, `"${versioned}"`);
    }
    return [route, template.replace(
      /<!-- RATIO1_NODE -->[\s\S]*?<!-- \/RATIO1_NODE -->/,
      () => renderNodeAttribution(env)
    )];
  })));

  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.set('X-Content-Type-Options', 'nosniff');
    response.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use((request, response, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return next();
    }

    let pathname;
    try {
      pathname = posix.normalize(decodeURIComponent(request.path)).replace(/\/+$/, '') || '/';
    } catch {
      return response.set('Cache-Control', 'no-store').status(400).type('text').send('Invalid URL');
    }

    if (pathname === '/index.html') {
      pathname = '/';
    }
    if (pathname === '/purpleray/index.html') {
      pathname = '/purpleray';
    }
    if (pathname === '/purpleray' && request.path !== '/purpleray') {
      const query = request.originalUrl.includes('?') ? request.originalUrl.slice(request.originalUrl.indexOf('?')) : '';
      return response.set('Cache-Control', 'no-store').redirect(308, `/purpleray${query}`);
    }
    if (pages.has(pathname)) {
      return response.set('Cache-Control', 'no-store').type('html').send(pages.get(pathname));
    }
    // Never serve an unrendered HTML template through static middleware.
    if (posix.extname(pathname).toLowerCase() === '.html') {
      return response.set('Cache-Control', 'no-store').status(404).type('text').send('Not found');
    }
    next();
  });

  app.get('/api/purpleray/downloads', (_request, response) => {
    response.set('Cache-Control', 'no-store').json(downloadStore?.snapshot() || unavailableDownloads);
  });

  app.get('/healthz', (_request, response) => {
    response.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });

  app.use(express.static(publicDirectory, {
    dotfiles: 'deny',
    index: false,
    redirect: false,
    maxAge: '1h'
  }));

  app.use((_request, response) => {
    response.set('Cache-Control', 'no-store').status(404).type('text').send('Not found');
  });

  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const { createDownloadStore } = await import('./lib/github-downloads.mjs');
  const downloadStore = await createDownloadStore({ token: process.env.GITHUB_TOKEN });
  const app = await createApp(process.env, { downloadStore });
  const refresh = () => downloadStore.refresh().catch(() => {
    console.warn('Download statistics refresh failed; keeping the last cached snapshot.');
  });
  // The store gates hourly refreshes and retry backoff; check once a minute.
  const timer = setInterval(refresh, 60 * 1000);
  timer.unref();
  void refresh();
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Website listening on port ${port}`);
  });

  const shutdown = () => {
    clearInterval(timer);
    downloadStore.close?.();
    server.close();
    setTimeout(() => server.closeAllConnections(), 5000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
