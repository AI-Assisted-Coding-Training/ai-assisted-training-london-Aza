# Repository-wide agent guidance

Apply this guidance to every task in this repository, including planning,
documentation, implementation, testing, and delivery. Task-specific work must
stay within these boundaries; surface conflicts rather than silently bypassing
them.

## Understand the project before acting

- Read [README.md](README.md) and the existing files relevant to the task before
  proposing or making changes. Inspect the worktree and preserve existing user
  changes.
- This repository owns the Planning Poker **frontend**. The backend is an
  existing, separately maintained service.
- Do not assume a framework, package manager, application structure, or command
  exists. At the time this guidance was written, the repository had no frontend
  implementation, dependency manifest, automated tests, or deployment workflow.
  Discover the current setup on each task; do not treat that initial state as a
  permanent restriction.
- Read and follow any applicable repository skill before carrying out its
  workflow. Skills live under [.agents/skills/](.agents/skills/) and
  [.github/skills/](.github/skills/).

## Keep requirements grounded

- The project backlog's epics, stories, and acceptance criteria are the source
  of truth for application features, UI, and behaviour. Use the relevant item
  when implementing or assessing a feature; do not invent requirements or issue
  references.
- [The backlog configuration](.backlog/config.json) identifies the GitHub
  repository and project. Use the current configuration rather than guessing
  where work is tracked.
- When creating or editing backlog items, follow the corresponding
  [epic](.backlog/_templates/epic.template.json) or
  [story](.backlog/_templates/story.template.json) template, including required
  sections and acceptance-criteria format.
- Distinguish confirmed requirements from assumptions and open questions. If
  required context is unavailable or contradictory, report the gap and clarify
  decisions that materially affect scope or behaviour.

## Preserve the architecture and contract

- Keep the application buildable as a static site deployable to GitHub Pages.
  Do not introduce a required application server or rely on server-side route
  rewrites that GitHub Pages does not provide.
- [The backend API contract](docs/api-contract.md) is the fixed integration
  boundary. Read it for any integration or behaviour work. Do not modify the
  contract or backend expectations to make a frontend implementation work.
  Raise inconsistencies or proposed protocol changes separately.
- Treat server state as authoritative: replace full state snapshots, derive
  identity from `welcome.userId`, and derive host status from the current
  `state.hostId`. Do not infer identity from display names.
- Preserve vote privacy and lifecycle rules. Do not expose other users' votes
  before reveal, allow voting after reveal, or assume host-only actions succeed
  merely because the UI allows them.
- Treat reconnections as fresh sessions, not restoration of the previous user,
  vote, or host role. Handle connection failures and server errors explicitly;
  never present an unconfirmed action as successful.
- Follow the contract's validation rules and message shapes. Do not add
  unsupported endpoints, messages, authentication, or persistence assumptions.

## Make focused, safe changes

- Make the smallest coherent change that satisfies the request. Reuse existing
  patterns and helpers; avoid unrelated fixes, speculative features, and
  unnecessary dependencies.
- Maintain documentation as part of each change, not as deferred follow-up.
  Update the README, relevant project documentation, and this AGENTS.md whenever
  codebase changes or confirmed decisions make their guidance incomplete or
  outdated. Record durable decisions, their rationale, and relevant constraints
  in the appropriate documentation; distinguish proposals from agreed decisions.
  Remove or revise superseded guidance, keep links and commands accurate, and
  keep directly affected tests consistent with changes. Do not change the fixed
  backend API contract to document a frontend-only decision.
- Never commit credentials, secrets, or private source material. Do not
  force-add ignored files.
- Preserve the local-only boundaries in [.gitignore](.gitignore): transcript
  inputs, summaries, and archives, along with temporary backlog working files,
  must remain untracked. Do not copy their contents into tracked files without
  explicit authorization and a sensitivity check.
- Do not install or execute bundled tooling merely because it is present in
  [tools/](tools/). Establish that it is needed for the requested task first.
- Do not discard user work, rewrite history, force-push, or change repository
  protections without explicit authorization. Commit, publish, and open pull
  requests only when requested.

## Verify and report honestly

- Discover validation commands from the current manifests, configuration, and
  documentation. Run the smallest relevant existing checks for the change; do
  not invent commands or claim checks passed when they were not run.
- For application changes, verify the affected acceptance criteria and failure
  paths. Where relevant, cover multiple participants, host changes, private
  voting, reveal/reset, and fresh-session reconnection semantics.
- For build, routing, or asset changes, verify static output and compatibility
  with GitHub Pages project-site paths and the chosen room-link format.
- If suitable tooling does not exist, state that limitation and describe any
  manual validation performed. Documentation-only work does not require
  introducing a build or test framework.
- Finish with a concise account of what changed, validation performed, and any
  unresolved assumptions or blockers. Never imply that a remote issue, pull
  request, deployment, or backend change occurred without verifying it.
