Update this file whenever you make structural, dependency or convention changes.

# Project

- Planning Poker is a web app for teams to estimate sprint work together.
- This repository is the frontend; the backend is maintained separately and communicates over WebSocket.
- The frontend must build as a static site deployable to GitHub Pages.
- The project backlog defines feature scope; `docs/api-contract.md` is the fixed backend interface.

# Stack and structure

- Frontend: dependency-free static HTML and CSS; no framework is used. `package.json` exists only to expose npm scripts (e.g. `npm test`) and has no runtime or dev dependencies. All JavaScript (`app/`, `tests/`, `tools/`) uses native ES modules (`import`/`export`; `package.json` sets `"type": "module"`).
- `index.html` and `styles.css`: marketing landing page.
- `app/`: the Planning Poker application itself (static HTML/CSS/JS), separate from the marketing landing page.
- `tests/`: automated tests, run with Node's built-in test runner (`node:test`); no test dependency is added.
- `docs/`: project documentation and backend API contract.
- `tools/`: developer tooling.
- `.backlog/`: backlog configuration and templates; work items are managed in GitHub Projects.
- `.agents/skills/`: repository-specific agent skills.
- `transcripts/`: input, output, and archived transcripts.

# Commands

- Install: not needed; `package.json` has no dependencies.
- Run: `npm start` serves the repo locally at `http://localhost:8080/` (app at `/app/`) via `tools/serve.js`, a dependency-free static file server; or open `index.html`/`app/index.html` directly in a browser.
- Test: `npm test` (or `node --test` directly; requires Node.js, runs everything under `tests/`).
- Lint: not configured; there is no linter or lint script.

# Conventions and testing

- Follow the backlog acceptance criteria and preserve the API contract.
- Use semantic HTML, responsive CSS, and no new dependencies unless approved.
- Add a `node:test` test under `tests/` for new application behaviour; run `node --test` before committing.
- Check HTML/CSS changes with `git diff --check`; run configured tests and lint checks when available.

# Boundaries

- Never push to `main`.
- Never commit without my approval.
- Never add dependencies without asking.
- Use the create-pr skill when asked to open a pull request.
