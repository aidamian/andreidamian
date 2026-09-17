Local validation, 17 September 2026

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

The live total was saved to a private temporary ledger for the review. It is not
a hard-coded website value or committed production state. A new WAR volume
starts its own ledger on the first successful refresh. Verify the actual WAR
mount, startup, node identity, counter recovery after restart, and Cloudflare
cache behavior after publishing. Deployment settings are in
[README.md](../README.md) and [war.example.json](../deploy/war.example.json).
