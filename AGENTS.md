# Repository Guidelines

## Project Structure & Module Organization
- Static site lives in `public/`; update `index.html`, `styles.css`, and assets together to keep markup, styling, and imagery aligned.
- Deployment configuration sits in `firebase.json` and `.firebaserc`; adjust rewrites or hosting targets there rather than embedding config in HTML.
- GitHub Actions under `.github/workflows/` handle merge and PR previews; edit with care so automated deploys keep working.

## Build, Test, and Development Commands
- `firebase emulators:start --only hosting` (requires Firebase CLI auth) spins up a local preview that matches production routing.
- `firebase hosting:channel:deploy <branch-name>` creates a temporary preview link for stakeholders.
- `firebase deploy --only hosting` publishes `public/` to the live channel once changes are approved.

## Coding Style & Naming Conventions
- Follow the existing two-space indentation in HTML and CSS; keep sections semantic (`header`, `section.about`, `footer`) to preserve accessibility landmarks.
- Use lowercase, hyphenated class names (e.g., `profile-img`, `resume-section`) and keep shared layout helpers in `.container`.
- Place new media under `public/` and reference with relative paths so Firebase rewrites continue to resolve correctly.

## Testing Guidelines
- No automated suite exists; before opening a PR, exercise the Firebase emulator preview and validate layout across desktop and mobile breakpoints.
- Run HTML and CSS validators or browser dev tools to catch regressions; document known visual quirks in the PR description.

## Commit & Pull Request Guidelines
- Follow the Conventional Commits pattern visible in history (`fix: ...`, `feat: ...`, `docs: ...`) to keep actions and changelog tooling consistent.
- PRs should explain intent, link any tracked issue, and include before/after screenshots for visual updates; note manual checks performed.
- The PR workflow deploys to a preview channel automatically—confirm the status check before requesting review, and avoid committing secret material exposes.

## Deployment & Security Notes
- Keep Firebase service accounts and API keys in GitHub Secrets or local `.env` files; never commit credentials to `public/`.
- When rotating hosting credentials, update both GitHub secrets referenced by the workflows and your local `firebase login` session.
