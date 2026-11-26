---
name: implement-ticket
description: 'Implement a backlog ticket (story or bug) end-to-end using test-driven development. Use when the user asks to implement, pick up, start, or work on a ticket/story, or asks to build what a ticket describes.'
argument-hint: "[ticket key]"
user-invocable: true
---

# Implement a Ticket

Turn a single backlog ticket into working, tested code through a disciplined
red-green-refactor loop, grounded in a shared understanding reached with the
user before any code is written.

Respect [AGENTS.md](../../../AGENTS.md) at all times: never push to `main`,
never commit without the user's approval, never add a dependency (including a
test framework) without asking first.

## Step 1 — Retrieve the ticket

Use the Backlog Assistant to get the ticket's real content rather than
guessing from the key alone:

- If a `.ticket` file for the key already exists locally, call
  `backlogAssistant_getLocalTicket` with the ticket key.
- Otherwise call `backlogAssistant_fetchTicketFromRemote` with the ticket key
  to pull the latest state into `.backlog/remote/`.

Read the resulting file: title, introduction (persona/goal/outcome),
acceptance criteria, and any technical or testing notes. If the key is
unknown or ambiguous, ask the user for it before continuing.

## Step 2 — Get git ready

- Run `git status --short --branch` and `git fetch`.
- If there are uncommitted changes unrelated to this ticket, stop and ask the
  user how to proceed — never stash or discard work silently.
- If the current branch is `main` (or the repo's default branch), pull the
  latest changes before branching. Never commit directly to it.

## Step 3 — Evaluate complexity

- Read the ticket's acceptance criteria and technical notes in full.
- Dispatch the **Explore** subagent (thoroughness: medium) to summarise the
  current state of the relevant parts of the codebase: what exists, what's
  missing, and any conventions already in place that the implementation must
  follow.
- Form a rough sense of scope (small fix vs. multi-part feature) to calibrate
  how many isolated units of work to expect in Step 5.

## Step 4 — Create a branch

Name it after the repo's convention (`feature/<slug>`, `bugfix/<slug>`,
`chore/<slug>`, `task/<slug>` — see
[create-pr](../../../.github/skills/create-pr/SKILL.md)), prefixed with the
ticket key, e.g. `feature/PPO-12-cast-a-vote`. Use `feature/` for stories and
`bugfix/` for bug tickets. Create and check out the branch before writing any
code.

## Step 5 — Grill the user about the ticket

Before identifying test cases, follow the
[grilling](../grilling/SKILL.md) skill to interview the user about the
ticket: ambiguous acceptance criteria, edge cases, error handling, and any
design decisions the ticket leaves open. Do not proceed to Step 6 until that
session's frontier is empty and the user has confirmed shared understanding.

## Step 6 — Identify units of work and write failing tests

- Break the ticket into isolated, independently testable units of behaviour
  (not architectural layers — each unit should be a small, observable piece
  of the outcome agreed in Step 5).
- If no test framework is configured yet for the relevant part of the
  codebase, propose one to the user and get explicit approval before adding
  it as a dependency.
- For each unit, write one or more automated tests that exercise it through
  its real interface. Run the suite once to confirm the new tests fail for
  the expected reason (not a typo or setup error).
- Present the proposed test cases and what each one verifies. Agree the list
  with the user — add, drop, or reword cases as requested — before writing
  any implementation code.
- Order the agreed test cases from simplest to most complex; this order
  drives Step 7.

## Step 7 — Red-green-refactor loop

Repeat for each agreed test case, in order:

1. **Red**: confirm the next test case fails (it should already, from Step 6).
2. **Green**: implement the smallest change that makes it pass.
3. **Verify**: run the full automated test suite. If anything fails, debug
   and iterate — do not move on with red tests.
4. **Commit**: once everything is green, propose a commit message describing
   the behaviour just added. Get the user's approval, then commit.
5. **Refactor**: look for refactoring opportunities in the code just touched
   (duplication, unclear naming, misplaced logic). If you refactor, rerun the
   full suite to confirm it's still green, then propose and get approval for
   a separate commit for the refactor.
6. Move to the next test case.

## Step 8 — Final exploratory testing

Once all agreed test cases pass, exercise the feature manually (or via a
quick script/browser check, as appropriate) against the ticket's acceptance
criteria and the decisions reached in Step 5. Note anything that looks off
before declaring the ticket done — fix and loop back into Step 7 if a gap
surfaces.

## Step 9 — Wrap up

Summarise for the user: the branch, the commits made, the test cases covered,
and any ticket acceptance criteria or grilling decisions still open. If the
work introduced new structural, dependency, or convention changes, update
[AGENTS.md](../../../AGENTS.md) per its own instruction to do so. Do not open
a pull request unless the user asks — use the
[create-pr](../../../.github/skills/create-pr/SKILL.md) skill when they do.
