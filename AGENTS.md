Update this file whenever you make structural, dependency or convention changes.

# Project

- Planning Poker is a web app for teams to estimate sprint work together.
- This repository is the frontend; the backend is maintained separately and communicates over WebSocket.
- The frontend must build as a static site deployable to GitHub Pages.
- The project backlog defines feature scope; `docs/api-contract.md` is the fixed backend interface.

# Stack and structure

- Frontend: dependency-free static HTML and CSS; no framework or package manager is used.
- `index.html` and `styles.css`: marketing landing page.
- `docs/`: project documentation and backend API contract.
- `tools/`: developer tooling.
- `.backlog/`: backlog configuration and templates; work items are managed in GitHub Projects.
- `.agents/skills/`: repository-specific agent skills.
- `transcripts/`: input, output, and archived transcripts.

# Commands

- Install: not needed; the page has no dependencies.
- Run: open `index.html` directly in a modern browser; no server or build command is configured.
- Test: not configured; there is no test suite or test script.
- Lint: not configured; there is no linter or lint script.

# Conventions and testing

- Follow the backlog acceptance criteria and preserve the API contract.
- Use semantic HTML, responsive CSS, and no new dependencies unless approved.
- Add focused tests when interactive application behavior is introduced; no test framework is configured yet.
- Check HTML/CSS changes with `git diff --check`; run configured tests and lint checks when available.

# Boundaries

- Never push to `main`.
- Never commit without my approval.
- Never add dependencies without asking.
- Use the create-pr skill when asked to open a pull request.
