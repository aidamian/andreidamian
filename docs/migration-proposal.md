Website migration record, 17 September 2026

The owner approved the full refresh after the initial review and has already
published the earlier website through Ratio1 Worker App Runner (WAR), with its
domains configured. This record preserves the content sources and architectural
decisions. [README.md](../README.md) contains the current run and deployment
instructions. Local implementation and repository cleanup do not imply that the
new code has been published or that external hosting resources have been retired.

The initial audit found a static personal homepage whose hosting rewrites sent
`/purpleray` and unknown paths to the same HTML with status 200. That audit
predates the owner's WAR publication; its DNS and hosting observations should
not be treated as the current production configuration.

The profile refresh uses the latest local CV found, English v1.5 dated 5 May
2026, at `TheWriter/projects/aid-CV/cv/cv_andrei_ionut_damian_en_v1.5.md`, and its
`cv-support/website-cross-reference-2026-05-05.md`. Those files live in a separate
local project and are not public website assets. The CV release record calls
v1.5 an owner-review candidate; it is the latest available source, rather than
independent verification of September employment information.

| Earlier website claim | Correction supported by the CV |
| --- | --- |
| Naeural framing, no current Ratio1 role | Lead with Ratio1 CEO, AI researcher, Senior Lecturer, and expert evaluator; do not invent a CEO start date. |
| Lummetry Chief Data Scientist, 2018–present | Founder and Chief Data Scientist, 2018–2025. |
| More than 200 projects evaluated | Over 20 evaluation sessions during 2004–2026; distinguish EU and regional assignments. |
| Two doctorates, including Project Management | Retain the evidenced PhD in Computers and Information Technology; omit the unsupported second doctorate. |
| PhD ending in 2021 | Degree awarded in 2022, defended in December 2021. |
| Stanford AI program, 2019–2021 | Artificial Intelligence Professional Program, Stanford SCPD, 2020–2021. |
| Master in Computer Science / Software Engineering | MSc-equivalent Engineering Degree in Computer Science, awarded in 2000. |
| Pending patents and broad certification claims | Remove claims omitted from the current evidence. |

Use “software development since 1995” instead of a changing experience total.
Personal identifiers and private evidence stay outside `public/`.

The PurpleRay page draws from
[aidamian/PurpleRay_SBOM_Analyzer](https://github.com/aidamian/PurpleRay_SBOM_Analyzer).
The reviewed project is a Windows/Linux desktop SBOM analyzer with CycloneDX
export, scan comparison, optional OSV checks, security-findings export, and BSI
readiness reporting. Its README describes offline operation by default and an
Apache-2.0 license. These features do not imply compliance certification or
macOS support. Screenshots come from the repository's
[application images](https://github.com/aidamian/PurpleRay_SBOM_Analyzer/tree/main/assets/images)
and retain their synthetic-demo context. The overview shows v1.2.2; it must not
be presented as a screenshot of the newer release.

The permanent download link is
[the latest GitHub release](https://github.com/aidamian/PurpleRay_SBOM_Analyzer/releases/latest).
At review it resolved to v1.3.0, published 25 August 2026. The link lets GitHub
select the current release and visitors choose the appropriate package.

“Package downloads across all versions” counts uploaded application packages
from published releases, including prereleases. Checksums and package-manager
manifests are excluded. Historical names include `sbom-analyzer-` and
`purpleray-sbom-analyzer-`, with some extensionless Linux binaries. A 17 September
11:13 UTC API snapshot found 22 releases, 99 assets, 101 total asset downloads,
and 52 application-package downloads. These are historical review observations,
not website constants. [Releases API](https://docs.github.com/en/rest/releases/releases#list-releases),
[assets API](https://docs.github.com/en/rest/releases/assets#list-release-assets).

The server refreshes the aggregate hourly, following all release and asset
pagination. It publishes a snapshot only after a complete successful refresh.
The private `purpleray-downloads.json` ledger keeps each asset ID's highest
observed package count after deletion. Failed refreshes retain the previous
snapshot and timestamp. The endpoint `/api/purpleray/downloads` returns
`downloads`, `metric`, `updatedAt`, and `stale`; before the first successful
refresh, the count and timestamp are null.

This metric includes direct GitHub asset downloads and does not identify unique
people or installations. GitHub cannot reconstruct counts for assets deleted
before tracking, or downloads between their last observation and deletion.
Automatically generated source archives do not expose these asset counters.
Retain release assets where possible and capture counts before intentional
removal. Both application API requests and WAR branch polling need credentials:
`GITHUB_TOKEN` and `VCS_DATA.TOKEN` are separate configuration fields. Poll WAR's
branch every 300 seconds. [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
[WAR source](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/worker_app_runner.py).

One Node/Express service handles the homepage, `/purpleray`, and cached
statistics. It has no frontend build or database. MICRO's 0.25 CPU and 512 MiB
RAM are the starting resource target, subject to verification on the selected
node. Reserve 100 MiB for the ledger within its 2 GiB storage allowance: the WAR
example specifies `1948m` container storage plus a `100M` fixed volume at `/data`.
Local development uses `.data/`; WAR requires a writable dedicated mount outside
its `/app` checkout. Back up before changing the node or pipeline/instance
identity. Additional replicas would each have their own ledger and require a
shared-state design. [Resource definitions](https://github.com/Ratio1/edge_node/blob/main/extensions/business/deeploy/deeploy_const.py),
[volume implementation](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/mixins/fixed_size_volumes.py).

The serving node's identity is rendered into both HTML footers from
`R1EN_HOST_ID` and `R1EN_HOST_ADDR`, falling back to their `EE_` equivalents.
Escaping prevents environment values from introducing markup. HTML is uncached
so the footer identifies the responding node; it needs no client-side request.
[WAR environment fields](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/container_utils.py).

| URL choice | Configuration | Assessment |
| --- | --- | --- |
| `andreidamian.ro/purpleray` | Existing website tunnel; route the path in Node. No new DNS record. | Canonical project page. |
| `purpleray.andreidamian.ro` as an alias | Proxied hostname and permanent HTTP redirect to `/purpleray`. | Optional convenience. |
| Subdomain as primary project URL | Hostname/TLS configuration and host-based application routing, or an independent service. | Useful if the project later needs independent hosting. |

A hostname cannot resolve to a URL path through DNS alone. One tunnel can serve
both pages; a second WAR is unnecessary. Cloudflare supports apex CNAME
flattening and same-account tunnel DNS mappings. Cross-account tunnels require
the supported linked-domain/Cloudflare for SaaS flow. WAR selects a host port for
its container port, so do not hard-code the tunnel's origin to host port 8080.
The owner has already configured the domains; retain them during this update.
[Cloudflare tunnel routing](https://developers.cloudflare.com/tunnel/concepts/routing/),
[CNAME flattening](https://developers.cloudflare.com/dns/cname-flattening/),
[Deeploy domain guide](https://ratio1.ai/blog/deeploy-secrets-setup-guide).

Remaining deployment operations:

1. Publish the reviewed repository changes to the intended watched branch and
   update the existing WAR job to `node:24-alpine`, `npm ci --omit=dev`, then
   `npm start`. Add `/data`, `DATA_DIR`, and the secrets from the example. Keep the
   existing job and tunnel identities.
2. Verify startup, both pages, node footers, `/healthz`, 404s, canonical redirects,
   and counter recovery after restart. Check the selected MICRO limits and
   confirm Cloudflare does not override the pages' `no-store` headers.
3. After confirming the new deployment, retire the old external hosting resources
   described below. The checked-in Actions workflow runs tests only.

The repository refresh removes `.firebaserc`, `firebase.json`, both Firebase
Hosting deployment workflows, and obsolete ignore/development instructions.
External Firebase cleanup remains outstanding: remove GitHub secret
`FIREBASE_SERVICE_ACCOUNT_ANDREIDAMIAN_7ACDF`, revoke its dedicated service-account
key, detach the old custom domain, and retire Hosting plus preview channels.
Check the purpose of any verification DNS records before removing them. Delete
the broader Firebase/GCP project only if no other service uses it. This work has
not removed remote secrets, changed Cloudflare settings, deleted hosting
resources, or deployed the new application.
