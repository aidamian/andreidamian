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

The existing WAR job is job 69, with replicas on `bia1` and `bia2` and its domains
already configured. The 17 September inspection found both replicas launching
`npx serve`; pushing new files alone does not change that command. After
publishing the new server code to the watched branch, update the existing job
with these settings:

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
