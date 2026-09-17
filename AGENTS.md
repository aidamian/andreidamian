# Repository Guidelines

## Structure and development

- `public/` contains the personal homepage, PurpleRay page, shared CSS, and public media. Keep the pages as semantic HTML with two-space indentation and lowercase, hyphenated CSS classes.
- `server.mjs` serves rendered pages and public assets. `lib/` contains node attribution and GitHub download aggregation. Serve only `public/`; keep source and credentials private.
- Use Node 24 or newer. Run `npm ci`, `npm test`, and `npm start`. The local site listens on `http://localhost:8080`; no frontend build is needed.
- Statistics use an in-memory cache; no runtime data directory is needed. `npm start` loads an optional `.env` file; use `.env.example` for local settings.

## Content and verification

- Keep profile claims aligned with the CV sources recorded in `docs/migration-proposal.md` and the company/publication audit in `docs/profile-sources.md`. Distinguish role tenure, acquisition dates, later group outcomes, and publication status; do not infer personal authorship of an acquiring group's products.
- Ground PurpleRay descriptions and screenshot captions in its public repository. Offer direct platform packages discovered from published GitHub release assets, retaining the permanent `releases/latest` link as a fallback. Identify older packages as archives and show the macOS build pause when no current package exists.
- Count current GitHub application-package downloads across all published releases, including prereleases. GitHub is the source of truth; refresh hourly in memory on each replica. Deleted assets may reduce the total. Do not describe downloads as unique users or an immutable lifetime count.
- Run focused server/counter tests for behavior changes. Check both pages at desktop and mobile sizes after visual changes, including long node names, screenshot captions, and unavailable statistics.
- HTML includes the responding node's escaped runtime identity and must remain uncached. Do not let static-file routes bypass HTML rendering.

## Deployment

- Ratio1 Worker App Runner clones the watched branch and runs `npm ci --omit=dev`, then `npm start`. `.github/workflows/checks.yml` runs checks only.
- `deploy/war.example.json` is a plugin configuration fragment with placeholders, not a standalone deployment manifest. Preserve the existing job, tunnel, and domain configuration when updating the running site.
- Keep the existing two replicas on `bia1` and `bia2` for job 69. Each uses MICRO resources: 0.25 CPU, 512 MiB RAM, and 2 GiB storage. No application volume or `DATA_DIR` is required; preserve WAR's `/r1en_system` mount and existing platform secrets.
- Set readiness to `/healthz` with a 300-second timeout and `ON_FAILURE=skip`. A timeout can leave the tunnel stopped; after fixing startup, restart the job to retry readiness.
- Prefer `R1EN_HOST_ID` and `R1EN_HOST_ADDR`, with `EE_HOST_ID` and `EE_HOST_ADDR` fallbacks. Let WAR inject them. Never publish the whole environment or a private host IP.
- Store Cloudflare, GitHub API, and VCS credentials in deployment secrets. `GITHUB_TOKEN` serves the application; `VCS_DATA.TOKEN` serves WAR's separate branch polling. Never commit their values.

## Commits and review

- Follow Conventional Commits (`feat:`, `fix:`, `docs:`).
- Describe user-visible behavior and relevant checks; include screenshots for substantial visual changes.
- Publishing to the watched branch can restart production. Report local changes separately from remote deployment and external resource retirement.
