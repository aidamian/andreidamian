Website migration record, 17 September 2026

The owner approved the full refresh after the initial review and published
commit `4e6ffd1` through Ratio1 Worker App Runner (WAR), with its domains already
configured. A subsequent inspection found both website replicas on that commit
but still running the earlier static-server command. The owner then approved
keeping both replicas and using GitHub as the download counter's source of
truth, with an in-memory cache and no application volume. This record preserves
the content sources and decisions. [README.md](../README.md) contains the current
run and manual deployment instructions. Repository changes do not automatically
update the existing Deeploy job configuration or retire external resources.

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
Each replica caches its snapshot in memory and fetches again after restart.
Failed refreshes retain that process's previous snapshot and timestamp. The
endpoint `/api/purpleray/downloads` returns
`downloads`, `metric`, `updatedAt`, and `stale`; before the first successful
refresh, the count and timestamp are null.

This metric includes direct GitHub asset downloads and does not identify unique
people or installations. GitHub is the source of truth: removing release assets
can reduce the total, and the site does not preserve deleted-asset history.
Automatically generated source archives do not expose these asset counters.
Independent refresh times can briefly produce different totals on the two
replicas. `GITHUB_TOKEN` is optional but recommended to avoid the shared
unauthenticated API limit. It is separate from WAR's existing `VCS_DATA.TOKEN`.
The current Deeploy UI uses the runner's default 60-second branch polling.
[Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
[WAR source](https://github.com/Ratio1/edge_node/blob/main/extensions/business/container_apps/worker_app_runner.py).

One Node/Express application handles the homepage, `/purpleray`, and cached
statistics. Keep job 69's existing replicas on `bia1` and `bia2`, each using
MICRO's 0.25 CPU, 512 MiB RAM, and 2 GiB storage. The application has no frontend
build, database, or persistent volume. It requires no `DATA_DIR`; WAR's own
`/r1en_system` mount remains in place. Runtime limits still need verification on
the deployed application.
[Resource definitions](https://github.com/Ratio1/edge_node/blob/main/extensions/business/deeploy/deeploy_const.py).

The initial proposal used a private download ledger on a fixed-size volume and
recommended one replica. The owner's later decision supersedes that proposal:
retain two replicas, recalculate from current GitHub assets, and accept that
deleted assets can reduce the count. The earlier volume, backup, and mount-check
instructions are no longer deployment requirements.

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

1. Publish the revised server code to the watched branch and edit existing WAR
   job 69. Keep `node:24-alpine`, both nodes, and the existing domains. Replace
   `npx serve` with `npm ci --omit=dev`, then `npm start`; set `NODE_ENV=production`
   and `PORT=8080`. Add `GITHUB_TOKEN` as a secret if available, preserving the
   existing secrets and tunnel configuration. Add no application volume.
2. Configure endpoint readiness at `/healthz`, timeout 300 seconds, with
   `ON_FAILURE=skip`. If startup times out, diagnose and fix it, then restart the
   job to retry readiness. Verify startup, both pages, both node identities,
   `/healthz`, 404s, canonical redirects, and fresh statistics after a restart.
   Check the selected MICRO limits and
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
resources, or applied the new application startup settings.
