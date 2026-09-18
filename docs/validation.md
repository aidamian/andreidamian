Live PurpleRay release check, 18 September 2026

At 07:28–07:30 UTC, direct GitHub API and release-page requests identified
v1.4.0 as the latest release, published at 07:16:51 UTC. The public site's
snapshot had already refreshed at 07:21:30 UTC and supplied matching Windows
ZIP, Linux tar.gz, and Debian package links. The macOS v0.1.0 ZIP remained
correctly labelled as an experimental archive with builds paused.

Direct HTML/API requests to the apex, www, and native WAR domain returned
HTTP 200 with the latest links. Responses used `Cache-Control: no-store` and
Cloudflare reported `DYNAMIC`. Chromium checks on the apex and www confirmed
the same visible versions and download URLs after JavaScript completed, with
no JavaScript exceptions. These public requests reached bia1, running website
v1.1.0, commit 68c498141d4a; the website version is separate from PurpleRay's
application release version.

Direct SSH checks to bia2 timed out, so its independent cache could not be
verified. No node was restarted or reconfigured during this investigation.

No incorrect current package selection was reproduced. Each replica refreshes
its in-memory snapshot hourly, checked by a minute timer, so a new release can
normally take up to about 61 minutes to appear. An already-open browser tab
fetches the snapshot only on initial load and needs reloading to see later
updates. These mechanisms can explain a previously observed older release;
the earlier browser state was not captured. No runtime change was made for
this investigation.

Search, AI access, and BibTeX: local validation, 18 September 2026

Website version 1.1.1 adds server-rendered profile, publication, and software
structured data; canonical redirects; richer social metadata; substantive
sitemap update dates; and an optional generated `/llms.txt` navigation index.
All six references now have a native BibTeX disclosure, a progressive copy
button, and individual `.bib` downloads, plus a combined bibliography.

All 44 automated tests pass. The nine added tests cover graph relationships,
complete authors and publication status/date precision, citation downloads,
GET/HEAD canonical redirects, public versus operational indexing headers,
identical human/crawler responses, and JSON-LD escaping. The production startup
test still passes with subprocesses and filesystem writes denied. No runtime
dependencies were added.

Chromium checks passed on both pages at 1440, 900, 760, 390, and 320 pixels.
All six citations copied exactly to the clipboard at each width. A denied
clipboard operation selected the full citation and displayed manual-copy
instructions. Native disclosure, manual selection, and downloads also worked
without JavaScript. Keyboard Enter/Space toggling, images, internal anchors,
schema parsing, node/version footers, and absence of horizontal overflow or
JavaScript errors were verified. Desktop and mobile screenshots were inspected.
The bibliography was independently parsed and checked against canonical DOI
exports; see [bibliography-sources.md](bibliography-sources.md).

An additional Python robots check initially raised `AssertionError` because
its standard-library parser chooses the first matching rule: `Allow: /` hid
the subsequent `Disallow: /api/` from that parser. Google uses the most specific
matching path instead. The specific exclusion was moved first to support both
behaviours. All 11 tested crawler tokens then allowed public pages, scripts,
and bibliography resources while excluding `/api/`. Sitemap XML contains exactly
the two canonical pages and valid, nonfuture dates. The application continued
serving HTTP 200 during that validation failure. This was a local check, not
evidence of a production outage. [Google's rule precedence](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).

These are local implementation checks, not proof of search indexing or model
training. The earlier live baseline and remaining account-side checks are in
[search-ai-guidance.md](search-ai-guidance.md). JSON-LD was parsed and checked
for consistency; no Google rich-result eligibility is claimed for PurpleRay,
which has no fabricated ratings or reviews. No Cloudflare, Google, or Bing
account settings were changed. This update has not been pushed or tested in WAR.
`git diff --check` passed.

Site release identification: local validation, 18 September 2026

Both footers display website version 1.1.0 and the startup checkout's short
Git revision. `/healthz` exposes the version and full revision, and responses
include matching version headers. The version comes from `package.json`;
Git metadata is read without subprocesses, writes, or extra dependencies.

All 35 tests pass, including loose and packed refs, detached HEAD, missing or
malformed Git metadata, consistent page/health/header values, and the existing
WAR startup test with subprocesses and filesystem writes denied. Chromium
checks passed on both pages at 1440, 760, 520, 390, and 320 pixels with JavaScript
enabled and disabled: 20 combinations. Release labels matched the response
revision, node attribution remained visible, and neither page overflowed.
Desktop and mobile footer screenshots were inspected. `git diff --check` passed.

This change is local and ready to publish. Local uncommitted edits retain the
checkout's current HEAD; the next deployed commit will supply its own revision.

Entrepreneurship and research update: local validation, 17 September 2026

The homepage now includes the venture history, Lummetry's 2021 acquisition,
the later Hyperfy rebrand and MotionMask launch, and the investor's reported
2024 AI-security deployment figure. Two 2026 journal papers and the published
2025 IEEE Ratio1 conference paper were added. The conference paper and arXiv
whitepaper have separate citations and publication labels. The source audit,
including all six supplied acquisition articles and unresolved historical
details, is in [profile-sources.md](profile-sources.md).

All 32 existing automated tests pass. Chromium checks passed on both pages at
1440, 900, 760, 390, and 320 pixels, with no horizontal overflow, broken images,
missing internal anchor targets, duplicate IDs, or JavaScript exceptions.
The homepage has six research citations and three education entries. All
three new DOI links are present. Homepage content, research links, section
navigation, and the responding node's identity also work with JavaScript
disabled. A long preview node alias wraps on mobile. Desktop and mobile
screenshots were inspected, including the entrepreneurship section.

These checks used the local production server entry point. No dependencies,
deployment configuration, or server behavior changed. `git diff --check`
passed. The profile update is local; it has not been pushed or verified in WAR.

Platform download options: local validation, 17 September 2026

All 32 automated tests pass. The release catalog uses GitHub's designated latest
stable release, preserves older platform packages as explicitly labelled
archives, rejects unsafe asset URLs, and refreshes atomically with the counter.
Checks cover backports, missing platforms, pagination, drafts/prereleases,
rate limits, failed refreshes, server-rendered links, and updates without a
server restart. The production startup test still runs without DATA_DIR and
with filesystem writes denied.

A live GitHub refresh returned v1.3.0 Windows ZIP, Linux tar.gz and Debian
packages, the archived v0.1.0 macOS ZIP, and 52 package downloads. These are
observations, not hard-coded versions or counts. macOS is marked as paused;
the archive is labelled experimental. A simulated current macOS package
replaces that state with a normal download automatically.

Chromium checks passed at 1440, 900, 390, and 320 pixels: all four download links
matched the GitHub snapshot, cards fit without horizontal overflow, and there
were no JavaScript errors. Cached links remain visible when API refreshes
fail, stale results are labelled, and links plus node attribution work with
JavaScript disabled. Desktop and mobile screenshots were inspected. The
fallback layout also passed at 770 pixels. `git diff --check` passed.

These platform-download changes are local and ready to publish. The earlier
site deployment and Cloudflare sitemap repair were separately verified live.

Earlier stateless validation, before the first WAR rollout

The approved version uses GitHub as the source of truth and caches results in
memory on each replica. All 22 current tests pass, including deleted-asset/count
changes, independent replica convergence, restart refetch, pagination, partial
failure handling, backoff, node attribution, and versioned asset URLs.

An integration test starts the production server with injected WAR identity,
no DATA_DIR, and filesystem writes denied by Node's permission model. Health,
both pages, and a complete mocked counter succeed without a writable directory.
A separate local run with writes denied completed a live GitHub refresh and
returned 52 package downloads. That observation is not a hard-coded value.

Chromium checks of the revised server passed at 1440 and 320 pixels: versioned
CSS and all images loaded, layouts fit the viewport, the counter reached its
ready state, and both footers rendered the injected node. Release links and
node attribution also worked with JavaScript disabled. No JavaScript exceptions
were observed. `git diff --check` passed. The revised code has not yet been
published or tested inside the production WAR; follow README's rollout steps.

Earlier local validation, 17 September 2026

These results cover the earlier implementation with a persistent download
ledger, before the owner approved two replicas with in-memory GitHub snapshots.
The 25-test result and resource measurements below are historical evidence;
they do not validate the revised cache or the final live deployment. Current
deployment settings are in [README.md](../README.md) and
[war.example.json](../deploy/war.example.json).

The refresh passed 25 automated tests covering runtime node attribution,
canonical routes, private-file isolation, persistent-data configuration, and
the GitHub download ledger. Ledger cases include pagination, historical package
names, restart recovery, deleted assets, partial failures, rate limits, corrupt
state, and shutdown. `git diff --check` passed.

Chromium checks covered both pages at 1440, 390, and 320 pixels wide. Images
loaded, each page had one main heading, neither page overflowed horizontally,
and both footers displayed the injected preview node. The latest-release links
and footer worked with JavaScript disabled. The counter's ready, stale, and
unavailable states were checked; a long node alias also wrapped at 320 pixels.
The browser reported no JavaScript errors. Full-page screenshots were inspected
for desktop and mobile layout.

The Node process ran in a Linux cgroup with a 0.25 CPU quota, a 512 MiB memory
limit, and swap disabled. These are local resource-limit checks, not an Alpine
container or a production Ratio1-node benchmark; Docker was unavailable in this
WSL environment.

| Check | Observed result |
| --- | --- |
| Clean `npm ci --omit=dev` under the limits | Completed in 6.9 seconds; 68 packages |
| Complete live GitHub refresh under the limits | 6.2 seconds; 52 package downloads; process peak RSS about 85 MiB |
| Mixed HTTP load: 500 requests, concurrency 20 | 500 successful responses in 2.6 seconds; p95 about 260 ms |
| Serving process during load and browser checks | Peak RSS about 69 MiB |

The live total was saved to a private temporary ledger for that review. It was
not a hard-coded website value or committed production state. The owner has
since removed the persistent-ledger requirement. After the current local checks,
verify actual WAR startup, both node identities, statistics refetch after
restart, and Cloudflare cache behavior after updating job 69.
