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
frontend build. Local statistics use ignored `.data/`. To supply a GitHub token,
copy `.env.example` to `.env` before starting. `npm start` loads this optional
file; environment values supplied by WAR take precedence.

See [local validation results](docs/validation.md) for the test coverage,
desktop/mobile review, and checks under MICRO CPU and memory limits.

The owner has already published the earlier site on WAR and configured its
domains. Updating the existing job requires these settings after the new files
are pushed to its watched branch:

| Setting | Value |
| --- | --- |
| Runtime image | `node:24-alpine` |
| Build/run commands | `npm ci --omit=dev`, then `npm start` |
| Listen address | `0.0.0.0:8080` |
| Readiness endpoint | `/healthz`, with `ON_FAILURE=skip` |
| Resource tier | MICRO: 0.25 CPU, 512 MiB RAM, 2 GiB total storage |
| Persistent volume | `stats`: 100 MiB mounted at `/data` |
| Application environment | `NODE_ENV=production`, `PORT=8080`, `DATA_DIR=/data`, `GITHUB_TOKEN` |
| Repository polling | `VCS_DATA.POLL_INTERVAL=300`, with `VCS_DATA.TOKEN` supplied separately |

Replace the temporary `npx serve` command. Add the persistent volume once and
retain the existing job identity, tunnel token, and domains. No DNS change is
needed for `/purpleray`. [deploy/war.example.json](deploy/war.example.json) contains
a configuration fragment for the WAR plugin; it is not a complete Deeploy job
request or an automatically imported manifest. Replace its placeholders through
deployment secrets. Its `1948m` container storage plus `100M` volume fits the
`2048m` MICRO allowance. Keep node count at one for the local ledger; Deeploy
defaults to two and permits one with a balancing warning.

WAR clones into `/app`, runs the commands there, and restarts on watched-branch
changes. A single instance can briefly interrupt service during restart. MICRO
is the starting resource target; check cold startup and request load on the
selected node. [Runner source](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/worker_app_runner.py),
[resource definitions](https://github.com/Ratio1/edge_node/blob/main/extensions/business/deeploy/deeploy_const.py).

Both footers display the responding node's `R1EN_HOST_ID`, with its
`R1EN_HOST_ADDR` in a tooltip. The legacy `EE_HOST_ID` and `EE_HOST_ADDR` fields
are fallbacks. WAR injects these values; do not configure a fixed node name.
Rendering happens on the server and works without JavaScript. HTML sends
`Cache-Control: no-store`; any Cloudflare cache override must exclude the page
routes and HTML aliases. Static assets remain cacheable.
[WAR environment fields](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/container_utils.py).

The PurpleRay button links to GitHub's permanent `releases/latest` URL. Its
counter refreshes hourly and counts application-package downloads across
published releases, including prereleases. Checksums, manifests, and automatic
source archives are excluded. Downloads include direct GitHub downloads, not
just clicks from this site, and do not represent unique people.

The private `purpleray-downloads.json` ledger retains each asset's highest observed
count after removal. It cannot recover assets deleted before tracking or
downloads between a last observation and deletion. Failed refreshes retain the
previous total and its timestamp; the page remains usable if GitHub is
unavailable. Supply the server's `GITHUB_TOKEN` separately from WAR's
`VCS_DATA.TOKEN` so both API consumers avoid the shared unauthenticated rate limit.

WAR requires `DATA_DIR` to name a writable, dedicated mount outside the checkout;
the example uses `/data`. Keep it outside `/app`. Export and verify a backup of
`/data/purpleray-downloads.json` before changing nodes, pipeline/instance identity,
or volume configuration. Restore it before starting the replacement.
WAR volumes persist on their current node; replicas do not automatically share
them. [Volume implementation](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/mixins/fixed_size_volumes.py).

Repository deployment automation now runs checks only. External retirement of
the old Firebase Hosting site, preview channels, service-account key, and GitHub
secret remains an operator task; no external resources were deleted by this
refresh. See [the migration record](docs/migration-proposal.md) for the original
review, domain assessment, and remaining operations.
