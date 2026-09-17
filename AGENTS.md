# Repository Guidelines

## Structure and development

- `public/` contains the personal homepage, PurpleRay page, shared CSS, and public media. Keep the pages as semantic HTML with two-space indentation and lowercase, hyphenated CSS classes.
- `server.mjs` serves rendered pages and public assets. `lib/` contains node attribution and GitHub download aggregation. Serve only `public/`; keep source, credentials, and the download ledger private.
- Use Node 24 or newer. Run `npm ci`, `npm test`, and `npm start`. The local site listens on `http://localhost:8080`; no frontend build is needed.
- Local runtime data belongs in ignored `.data/`. `npm start` loads an optional `.env` file; use `.env.example` for local settings.

## Content and verification

- Keep profile claims aligned with the CV sources recorded in `docs/migration-proposal.md`.
- Ground PurpleRay descriptions and screenshot captions in its public repository. Keep the download button pointed at its permanent GitHub `releases/latest` URL.
- Count GitHub application-package downloads across published versions, including prereleases. Keep observed asset-ID history across refreshes; do not describe downloads as unique users or reconstruct unobserved deleted assets.
- Run focused server/counter tests for behavior changes. Check both pages at desktop and mobile sizes after visual changes, including long node names, screenshot captions, and unavailable statistics.
- HTML includes the responding node's escaped runtime identity and must remain uncached. Do not let static-file routes bypass HTML rendering.

## Deployment

- Ratio1 Worker App Runner clones the watched branch and runs `npm ci --omit=dev`, then `npm start`. `.github/workflows/checks.yml` runs checks only.
- `deploy/war.example.json` is a plugin configuration fragment with placeholders, not a standalone deployment manifest. Preserve the existing job, tunnel, and domain configuration when updating the running site.
- Target MICRO resources: 0.25 CPU, 512 MiB RAM, and 2 GiB total storage. The example reserves 100 MiB of that storage for a persistent `/data` volume. WAR must set `DATA_DIR=/data`; the application must reject a missing mount.
- Keep persistent data outside `/app`, which WAR replaces during checkout. Data belongs to the current node and pipeline/instance identity; export a backup before moving or recreating that job.
- Prefer `R1EN_HOST_ID` and `R1EN_HOST_ADDR`, with `EE_HOST_ID` and `EE_HOST_ADDR` fallbacks. Let WAR inject them. Never publish the whole environment or a private host IP.
- Store Cloudflare, GitHub API, and VCS credentials in deployment secrets. `GITHUB_TOKEN` serves the application; `VCS_DATA.TOKEN` serves WAR's separate branch polling. Never commit their values.

## Commits and review

- Follow Conventional Commits (`feat:`, `fix:`, `docs:`).
- Describe user-visible behavior and relevant checks; include screenshots for substantial visual changes.
- Publishing to the watched branch can restart production. Report local changes separately from remote deployment and external resource retirement.
