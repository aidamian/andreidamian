import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import test from 'node:test';
import { createApp } from '../server.mjs';
import { renderStructuredData } from '../lib/structured-data.mjs';

const origin = 'https://andreidamian.ro';
const repository = 'https://github.com/aidamian/PurpleRay_SBOM_Analyzer';
const selectedResearch = [
  ['10.3390/info17080794', 7, 'Published', '2026-08-19'],
  ['10.3390/electronics15143046', 9, 'Published', '2026-07-10'],
  ['10.1109/CSCS66924.2025.00046', 7, 'Published', '2025-05-27'],
  ['10.48550/arXiv.2509.12223', 6, 'Preprint', '2025-09-05'],
  ['10.48550/arXiv.2112.11925', 4, 'Preprint', '2021-12-22'],
  ['10.1016/j.procs.2019.12.043', 4, 'Published', '2019']
];

async function startServer(t, env = {}, options = {}) {
  const server = (await createApp(env, options)).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function requestWithHost(url, host, method) {
  // Node's fetch replaces Host with the URL host, so use HTTP directly to test virtual-host routing.
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method, headers: { Host: host } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({
        status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString()
      }));
    });
    request.on('error', reject);
    request.end();
  });
}

function structuredGraph(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'one complete JSON-LD graph must be present without executing JavaScript');
  const data = JSON.parse(scripts[0][1]);
  assert.equal(data['@context'], 'https://schema.org');
  assert.ok(Array.isArray(data['@graph']));
  const graph = new Map(data['@graph'].map(entity => [entity['@id'], entity]));
  assert.equal(graph.size, data['@graph'].length, 'entity IDs must be unique');
  assert.ok(!graph.has(undefined), 'top-level entities need stable identifiers');
  const verifyReferences = value => {
    if (!value || typeof value !== 'object') return;
    if (Object.keys(value).length === 1 && value['@id']) {
      assert.ok(graph.has(value['@id']), `unresolved graph reference: ${value['@id']}`);
    }
    for (const nested of Object.values(value)) verifyReferences(nested);
  };
  verifyReferences(data);
  return graph;
}

function decodeHtml(text) {
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => entities[entity]);
}

function bibtexField(bibtex, name) {
  const value = bibtex.match(new RegExp(`^\\s*${name}\\s*=\\s*\\{([^\\n]+)\\},?\\s*$`, 'm'))?.[1];
  assert.ok(value, `BibTeX must contain ${name}`);
  return value;
}

test('raw pages identify one consistent person, website, and canonical main entity', async (t) => {
  const base = await startServer(t);
  let profilePerson;
  for (const [path, pageType, entityType] of [['/', 'ProfilePage', 'Person'], ['/purpleray', 'WebPage', 'SoftwareApplication']]) {
    const response = await fetch(`${base}${path}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.equal(html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1], `${origin}${path}`);
    assert.doesNotMatch(html, /<!-- (?:STRUCTURED_DATA|PUBLICATIONS|RATIO1_NODE|SITE_VERSION) -->/);
    const graph = structuredGraph(html);
    const entities = [...graph.values()];
    const page = entities.find(entity => entity['@type'] === pageType);
    assert.ok(page, `${path} must describe its actual page type`);
    assert.equal(page.url, `${origin}${path}`);
    assert.equal(graph.get(page.mainEntity['@id'])['@type'], entityType);
    assert.equal(graph.get(page.isPartOf['@id']).url, `${origin}/`);
    const person = entities.find(entity => entity['@type'] === 'Person');
    assert.equal(person.name, 'Andrei Ionuț Damian');
    assert.ok(person.sameAs.includes('https://orcid.org/0000-0002-5294-6223'));
    assert.ok(person.sameAs.includes('https://github.com/aidamian'));
    if (profilePerson) assert.deepEqual(person, profilePerson);
    else profilePerson = person;
    assert.equal(entities.find(entity => entity['@type'] === 'WebSite').publisher['@id'], person['@id']);
  }
});

test('PurpleRay schema connects the actual software, source, author, screenshots, and release fallback', async (t) => {
  const base = await startServer(t);
  const html = await (await fetch(`${base}/purpleray`)).text();
  const graph = structuredGraph(html);
  const software = [...graph.values()].find(entity => entity['@type'] === 'SoftwareApplication');
  assert.equal(software.name, 'PurpleRay SBOM Analyzer');
  assert.deepEqual(software.operatingSystem, ['Windows', 'Linux']);
  assert.equal(software.isAccessibleForFree, true);
  assert.equal(Number(software.offers.price), 0);
  assert.equal(software.license, 'https://www.apache.org/licenses/LICENSE-2.0');
  assert.equal(software.installUrl, `${repository}/releases/latest`);
  assert.ok(html.includes(`href="${software.installUrl}"`));
  assert.match(html, /Builds temporarily paused/);
  const source = graph.get(software.subjectOf['@id']);
  assert.equal(source['@type'], 'SoftwareSourceCode');
  assert.equal(source.codeRepository, repository);
  assert.equal(source.targetProduct['@id'], software['@id']);
  assert.equal(source.author['@id'], software.creator['@id']);
  assert.equal(graph.get(software.creator['@id']).name, 'Andrei Ionuț Damian');
  assert.equal(software.screenshot.length, 3);
  for (const image of software.screenshot) {
    const path = new URL(image).pathname;
    assert.ok(html.includes(`src="${path}"`));
    assert.match((await fetch(`${base}${path}`)).headers.get('content-type'), /^image\/png/);
  }
  assert.ok(!('aggregateRating' in software) && !('review' in software), 'downloads must not become fabricated ratings');
  assert.ok(!('softwareVersion' in software), 'release-dependent version data must not be frozen in static schema');
});

test('all six publications have complete server-rendered authors, dates, reusable BibTeX, and linked graph records', async (t) => {
  const base = await startServer(t);
  const html = await (await fetch(base)).text();
  const graph = structuredGraph(html);
  const papers = [...graph.values()].filter(entity => entity['@type'] === 'ScholarlyArticle');
  assert.equal(papers.length, 6);
  const blocks = [...html.matchAll(/<li id="([^"]+)">([\s\S]*?)<\/li>/g)];
  assert.equal(blocks.length, 6);
  const profile = [...graph.values()].find(entity => entity['@type'] === 'ProfilePage');
  const list = [...graph.values()].find(entity => entity['@type'] === 'ItemList');
  assert.equal(list.numberOfItems, 6);
  assert.deepEqual(list.itemListElement.map(item => item.position), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(new Set(profile.citation.map(item => item['@id'])), new Set(papers.map(paper => paper['@id'])));
  assert.deepEqual(new Set(list.itemListElement.map(item => item.item['@id'])), new Set(papers.map(paper => paper['@id'])));

  for (const [doi, authorCount, status, date] of selectedResearch) {
    const paper = graph.get(`https://doi.org/${doi}`);
    assert.ok(paper, `missing selected publication ${doi}`);
    assert.equal(paper.identifier.value, doi);
    assert.equal(paper.identifier.propertyID, 'DOI');
    assert.equal(paper.author.length, authorCount);
    assert.equal(paper.creativeWorkStatus, status);
    assert.equal(paper.datePublished, date);
    assert.equal(paper.subjectOf['@type'], 'MediaObject');
    assert.equal(paper.subjectOf.encodingFormat, 'application/x-bibtex');
    assert.equal(paper.subjectOf.about['@id'], paper['@id']);
    assert.ok(paper.author.some(author => author['@id'] === `${origin}/#person`));
    const citationPath = new URL(paper.subjectOf.contentUrl).pathname;
    const block = blocks.find(([, , content]) => content.includes(`href="${citationPath}"`));
    assert.ok(block, 'the visible citation must link to the graph’s bibliography download');
    const [, id, content] = block;
    assert.equal(citationPath, `/publications/${id}.bib`);
    assert.ok(content.includes(`href="${paper.url}"`));
    assert.ok(content.includes(`datetime="${date}"`));
    assert.ok(content.includes(status === 'Preprint' ? 'Preprint' : doi.includes('10.1109/') ? 'Conference paper' : 'Journal article'));
    assert.match(content, /<details\b[^>]*>[\s\S]*<summary\b/);
    const textarea = content.match(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/);
    assert.ok(textarea, 'BibTeX must be readable without client-side fetching');
    assert.match(textarea[1], /\breadonly\b/);
    const bibtex = decodeHtml(textarea[2]);
    assert.equal(bibtexField(bibtex, 'doi'), doi);
    assert.equal(Number(bibtexField(bibtex, 'year')), Number(date.slice(0, 4)));
    assert.equal(bibtexField(bibtex, 'url'), paper.url);
    assert.equal(bibtexField(bibtex, 'title').replace(/^\{|\}$/g, ''), paper.name);
    const authors = bibtexField(bibtex, 'author').split(' and ');
    assert.equal(authors.length, authorCount);
    const visibleAuthors = decodeHtml(content.match(/class="publication-authors">([^<]+)<\/p>/)?.[1] || '');
    assert.equal(visibleAuthors, authors.map(author => {
      const [family, given] = author.split(', ');
      return `${given} ${family}`;
    }).join(', '));
    assert.equal(await (await fetch(`${base}${citationPath}`)).text(), bibtex);
  }
});

test('individual and combined BibTeX downloads are attachments with complete, unique bibliography records', async (t) => {
  const base = await startServer(t);
  const html = await (await fetch(base)).text();
  const graph = structuredGraph(html);
  const paths = [...graph.values()].filter(entity => entity['@type'] === 'ScholarlyArticle')
    .map(paper => new URL(paper.subjectOf.contentUrl).pathname);
  const individual = [];
  for (const path of [...paths, '/publications.bib']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /^application\/x-bibtex(?:;|$)/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const filename = path === '/publications.bib' ? 'andrei-damian-publications.bib' : path.split('/').at(-1);
    assert.equal(response.headers.get('content-disposition'), `attachment; filename="${filename}"`);
    const body = await response.text();
    assert.doesNotMatch(body, /<!DOCTYPE|<html/i);
    const entries = [...body.matchAll(/^@(article|inproceedings|misc)\{([^,]+),/gm)];
    if (path === '/publications.bib') {
      assert.equal(entries.length, 6);
      assert.equal(new Set(entries.map(entry => entry[2])).size, 6);
      for (const citation of individual) assert.ok(body.includes(citation.trim()));
      assert.equal(entries.filter(entry => entry[1] === 'misc').length, 2, 'preprints remain distinct from journal/conference articles');
    } else {
      assert.equal(entries.length, 1);
      individual.push(body);
    }
  }
  const missing = await fetch(`${base}/publications/unknown-paper.bib`);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('x-robots-tag'), 'noindex');
  assert.equal(await missing.text(), 'Not found');
});

test('the optional llms index lists the current public pages, all research, and bibliography', async (t) => {
  const base = await startServer(t);
  const graph = structuredGraph(await (await fetch(base)).text());
  const response = await fetch(`${base}/llms.txt`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/plain/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.text();
  for (const path of ['/', '/purpleray', '/publications.bib']) assert.ok(body.includes(`(${origin}${path})`));
  const papers = [...graph.values()].filter(entity => entity['@type'] === 'ScholarlyArticle');
  assert.equal(papers.length, 6);
  for (const paper of papers) assert.ok(body.includes(`[${paper.name}](${paper.url})`));
  assert.equal((body.match(/; preprint\./g) || []).length, 2);
});

test('page aliases and www produce real permanent redirects that preserve query strings', async (t) => {
  const base = await startServer(t);
  const query = '?utm_source=paper&return=https%3A%2F%2Fexample.org%2Fa%3Fb%3D1';
  const aliases = [
    ['/index.html', '/'], ['/%69ndex.html', '/'], ['/index%2ehtml/', '/'],
    ['/purpleray/', '/purpleray'], ['/purpleray/index.html', '/purpleray'],
    ['/purpleray/index%2ehtml/', '/purpleray'], ['/%70urpleray', '/purpleray']
  ];
  for (const [alias, canonical] of aliases) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${base}${alias}${query}`, { method, redirect: 'manual' });
      assert.equal(response.status, 308, `${method} ${alias}`);
      assert.equal(response.headers.get('location'), `${canonical}${query}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
  }
  for (const path of ['/', '/purpleray', '/purpleray/index.html']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await requestWithHost(`${base}${path}${query}`, 'www.andreidamian.ro', method);
      assert.equal(response.status, 308, `${method} www ${path}`);
      assert.equal(response.headers.location, `${origin}${path}${query}`);
      assert.equal(response.headers['cache-control'], 'no-store');
      if (method === 'HEAD') assert.equal(response.body, '');
    }
  }
});

test('HTML is indexable and uncached while operational JSON is explicitly excluded from indexing', async (t) => {
  const base = await startServer(t);
  for (const path of ['/', '/purpleray', '/api/purpleray/downloads', '/healthz']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    if (path.startsWith('/api/') || path === '/healthz') {
      assert.equal(response.headers.get('x-robots-tag'), 'noindex');
      assert.match(response.headers.get('content-type'), /^application\/json/);
      assert.ok(await response.json());
    } else {
      assert.doesNotMatch(response.headers.get('x-robots-tag') || '', /\bnoindex\b/i);
      const html = await response.text();
      const robots = html.match(/<meta\b[^>]*name="robots"[^>]*content="([^"]+)"/)?.[1];
      assert.ok(robots);
      assert.match(robots, /\bindex\b/);
      assert.doesNotMatch(robots, /\b(?:noindex|nofollow|nosnippet)\b/);
    }
  }
});

test('human and search/AI crawlers receive identical public pages without exposing runtime secrets', async (t) => {
  const secrets = ['github-secret-canary', 'vcs-secret-canary', 'private-ip-canary', '/private/data-canary'];
  const base = await startServer(t, {
    R1EN_HOST_ID: 'public-node', R1EN_HOST_ADDR: 'public-node-address',
    GITHUB_TOKEN: secrets[0], VCS_DATA: secrets[1], R1EN_HOST_IP: secrets[2], DATA_DIR: secrets[3]
  });
  const agents = ['Googlebot', 'bingbot', 'OAI-SearchBot', 'GPTBot', 'PerplexityBot', 'ClaudeBot'];
  for (const path of ['/', '/purpleray']) {
    const normal = await (await fetch(`${base}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    assert.ok(normal.includes('public-node'));
    for (const agent of agents) {
      const response = await fetch(`${base}${path}`, { headers: { 'User-Agent': agent } });
      assert.equal(response.status, 200);
      assert.equal(await response.text(), normal, `${agent} should receive the same ${path} content`);
    }
    for (const secret of secrets) assert.ok(!normal.includes(secret));
  }
  for (const path of ['/healthz', '/api/purpleray/downloads', '/llms.txt', '/publications.bib']) {
    const body = await (await fetch(`${base}${path}`)).text();
    for (const secret of secrets) assert.ok(!body.includes(secret), path);
  }
  for (const path of [
    '/.env', '/.env.example', '/.git/config', '/server.mjs', '/package.json',
    '/lib/structured-data.mjs', '/lib/publications.mjs', '/data/publications.json',
    '/docs/profile-sources.md', '/deploy/war.example.json',
    '/%2e%2e%2flib/publications.mjs', '/publications/..%2f..%2f.env.bib'
  ]) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 404, path);
    assert.equal(await response.text(), 'Not found', path);
  }
});

test('JSON-LD serialization keeps markup-like text inert without corrupting its meaning', () => {
  const value = { '@context': 'https://schema.org', description: '</script><script>alert("injection")</script><img src=x onerror=alert(1)>' };
  const html = renderStructuredData(value);
  assert.equal((html.match(/<script\b/g) || []).length, 1);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.doesNotMatch(html, /<img|<script>alert/);
  const serialized = html.match(/^<script[^>]*>([\s\S]*)<\/script>$/)?.[1];
  assert.deepEqual(JSON.parse(serialized), value);
});
