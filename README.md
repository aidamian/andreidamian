# andreidamian

Personal website and [PurpleRay SBOM Analyzer](https://github.com/aidamian/PurpleRay_SBOM_Analyzer)
project page, served by Node/Express on Ratio1 Worker App Runner (WAR).

With Node 24 or newer:

```sh
npm ci
npm test
npm start
```

Open `http://localhost:8080` or `http://localhost:8080/purpleray`. There is no
frontend build. To supply a GitHub token, copy `.env.example` to `.env` before
starting. `npm start` loads this optional file; environment values supplied by
WAR take precedence.

See [local validation results](docs/validation.md) for the test coverage,
desktop/mobile review, and checks under MICRO CPU and memory limits.
The [profile source audit](docs/profile-sources.md) records the entrepreneurship
history, Lummetry acquisition, subsequent Hyperfy developments, and verified publications.
See [search and AI crawler guidance](docs/search-ai-guidance.md) for provider
controls and account-side checks, and [research evidence](docs/search-research-notes.md)
for the scope and limits of SEO/GEO recommendations.

Publication records live in [data/publications.json](data/publications.json).
The server uses this one collection for the visible research list, scholarly
JSON-LD, each `/publications/<id>.bib` download, and `/publications.bib`.
Each reference has a native BibTeX disclosure; copying is enhanced with a small
script, while selecting text and downloading citations work without JavaScript.
Bibliographic APIs are not called at startup or on page requests. The
[bibliography audit](docs/bibliography-sources.md) records the verified sources.

Both pages serve canonical metadata and structured data in their initial HTML.
Profile identity, author links, publications, and PurpleRay's software/source
metadata describe visible content. `/index.html` aliases and the `www` hostname
redirect permanently to their canonical URLs. Operational endpoints carry
`noindex`; `/api/` also remains excluded from crawling. Public pages, citations,
and assets are open to search and AI crawlers. `/llms.txt` is a small navigation
index generated from the publication collection, not a ranking or training
mechanism. It is identical for human and crawler requests.

Keep sitemap `lastmod` dates aligned with substantive page updates; do not
refresh them automatically on every request, restart, or documentation commit.
After publishing, submit `https://andreidamian.ro/sitemap.xml` in Google Search
Console and Bing Webmaster Tools and inspect both canonical page URLs. Verify
Search Console's effective **Settings → Search generative AI → Include** choice
and Cloudflare's Search, Agent, and Training policies. Details and current
official sources are in the linked crawler guidance. These account settings
have not been verified through authenticated access; public HTTP checks cannot
prove indexing, verified-bot access, ranking, or model-training inclusion.

The existing WAR job is job 69, with replicas on `bia1` and `bia2` and its domains
already configured. Keep the job configuration when publishing content or
citation updates. The required application settings are:

| Setting | Value |
| --- | --- |
| Runtime image | `node:24-alpine` |
| Build/run commands | `npm ci --omit=dev`, then `npm start` |
| Listen address | `0.0.0.0:8080` |
| Readiness endpoint | `/healthz`, timeout 300 seconds, `ON_FAILURE=skip` |
| Replicas | Keep both existing nodes, `bia1` and `bia2` |
| Resource tier, per replica | MICRO: 0.25 CPU, 512 MiB RAM, 2 GiB storage |
| Application environment | `NODE_ENV=production`, `PORT=8080`; optional, recommended `GITHUB_TOKEN` secret |
| Application storage | No application volume or `DATA_DIR` setting |

In Deeploy, open job 69 and choose **Edit**, then **Deployment**:

1. Under **Worker App Runner**, keep **Image** as `node:24-alpine`. Replace
   **Commands** with two rows: `npm ci --omit=dev`, then `npm start`.
2. In **ENV Variables**, add `NODE_ENV=production` and `PORT=8080`. Add
   `GITHUB_TOKEN` as a secret if available. Remove `DATA_DIR` if it was added
   while following the earlier proposal. Preserve the other environment entries
   and secrets, including the platform's `R1EN_CSTORE_AUTH_*` entries.
3. Keep both target nodes and the existing port 8080, tunnel token, repository,
   branch, and repository access token. Leave **Storage Volumes** unchanged;
   no application volume needs adding. Preserve the platform's `/r1en_system`
   mount, which WAR manages itself.
4. Under **Custom Parameters**, add `HEALTH_CHECK`, select **JSON**, and enter
   `{"MODE":"endpoint","PATH":"/healthz","TIMEOUT":300,"ON_FAILURE":"skip"}`.
5. Review the changes and choose **Update Job**. After restart, verify
   `/healthz`, both page footers, and `/api/purpleray/downloads` on both replicas.

No DNS change is needed for `/purpleray`.
[deploy/war.example.json](deploy/war.example.json) is a WAR plugin configuration
fragment with secret placeholders. Git pushes do not import it into Deeploy;
apply the settings above manually and preserve the existing job configuration.
Merge the example's environment additions with the existing entries.
WAR's repository credential is separate from the application's `GITHUB_TOKEN`.
The current UI uses the runner's default branch-polling interval of 60 seconds.

WAR clones into `/app`, runs the commands there, and restarts on watched-branch
changes. Both replicas can restart around the same time after a push, briefly
interrupting service. If readiness times out, `ON_FAILURE=skip` leaves the tunnel
stopped; after diagnosing and fixing startup, use the job's **Restart** action
to rerun readiness. Check cold startup and request load on the selected nodes.
[Runner source](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/worker_app_runner.py),
[resource definitions](https://github.com/Ratio1/edge_node/blob/main/extensions/business/deeploy/deeploy_const.py).

Both footers display the responding node's `R1EN_HOST_ID`, with its
`R1EN_HOST_ADDR` in a tooltip. The legacy `EE_HOST_ID` and `EE_HOST_ADDR` fields
are fallbacks. WAR injects these values; do not configure a fixed node name.
Rendering happens on the server and works without JavaScript. HTML sends
`Cache-Control: no-store`; any Cloudflare cache override must exclude the page
routes and HTML aliases. Static assets remain cacheable.
The server adds content versions to stylesheet and counter-script URLs, so an
update bypasses older browser and Cloudflare cache entries automatically.
[WAR environment fields](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/container_utils.py).

Both footers also display the website release, for example
`Site v1.1.0 · commit abcdef123456`. The release number comes from `package.json`;
the commit comes from the running checkout, read once at startup. WAR supplies
the checkout automatically, so no new environment variables are needed.
`GET /healthz` returns `status`, `version`, and the full `revision` for rollout
checks; responses also include `X-Site-Version` and, when available,
`X-Site-Revision`. A source export without Git metadata still shows the release
number, with `revision unavailable` and a JSON `revision` of `null`.
Compare replicas through `/healthz` or HTML; cached assets may retain old headers.
The revision identifies committed code; local uncommitted edits keep the
checkout's HEAD identifier. Bump the site release before publishing with
`npm version patch --no-git-tag-version`, which updates both package files.
The commit identifier changes automatically with each deployed commit, even
when the release number stays the same. This is the website version, separate
from PurpleRay's downloadable application versions.

PurpleRay offers Windows, Linux, and macOS download options. Package links and
versions come from published GitHub assets and refresh with the hourly cache;
they do not follow unreleased changes in the source repository. Windows ZIPs,
Linux archives and Debian packages, and available macOS ZIPs link directly to
GitHub. Older platform packages are explicitly marked as archives; macOS shows
the build pause while its available package predates the current release.
The permanent `releases/latest` link remains available if GitHub cannot refresh.
The server renders cached package links without JavaScript, and the browser
also updates them from the same API used by the download counter.

The counter refreshes hourly and counts application-package downloads across
published releases, including prereleases. Checksums, manifests, and automatic
source archives are excluded. Downloads include direct GitHub downloads, not
just clicks from this site, and do not represent unique people.

GitHub is the source of truth. Each replica keeps its own hourly snapshot in
memory and fetches again after restart. Refresh times can differ, so the two
replicas may briefly show different totals. Deleting release assets can reduce
the total; this is not an immutable lifetime download record. Failed refreshes
retain that process's previous total and timestamp. Before the first successful
refresh, including after a restart during a GitHub outage, statistics are
unavailable and the rest of the page remains usable. Supply `GITHUB_TOKEN` to
avoid GitHub's shared unauthenticated IP limit; keep WAR's existing
`VCS_DATA.TOKEN` for its separate branch polling.

Repository deployment automation now runs checks only. External retirement of
the old Firebase Hosting site, preview channels, service-account key, and GitHub
secret remains an operator task; no external resources were deleted by this
refresh. See [the migration record](docs/migration-proposal.md) for the original
review, domain assessment, and remaining operations.
