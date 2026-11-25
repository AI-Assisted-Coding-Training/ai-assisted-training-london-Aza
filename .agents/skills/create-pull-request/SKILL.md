---
name: create-pull-request
description: 'Create a GitHub pull request using the gh CLI. Use when asked to open or create a PR, submit changes for review, or publish a branch as a pull request. First verify branch suitability and that all relevant changes are committed, then describe the highest-level effects, key changes, critical decisions, and an effective reviewer starting point.'
---

# Create a Pull Request

Use the `gh` CLI for GitHub operations, including PR creation. Follow repository
instructions and PR templates. Do not create a PR merely because the user asks
to create or edit this skill.

## 1. Check the branch and changes

Before drafting or publishing anything:

- Run `git branch --show-current`, `git status --short --untracked-files=all`,
  and `git remote -v` to establish the current branch, working tree, and remotes.
- Use `gh repo view --json nameWithOwner,defaultBranchRef` to confirm the
  target repository and its default branch. Respect an explicitly requested
  base branch; otherwise use the default. Resolve ambiguous remotes, fork
  ownership, or a non-obvious base with the user rather than guessing.
- Fetch the relevant remote branches so comparisons use current information.
  Surface authentication or network failures rather than continuing with stale
  comparisons.
- The head must be a named working branch, not detached HEAD, the target base,
  or a protected integration/release branch. Check repository branch policies
  where available. If unsuitable, ask the user to confirm a suitable feature
  branch before creating or switching to it; preserve existing work.
- Compare against the fetched base using `git log <base-ref>..HEAD` and
  `git diff <base-ref>...HEAD`, including the diff summary and full relevant
  diff. Substitute actual verified refs for these placeholders.
- Confirm the branch contains the intended changes, has commits ahead of the
  base, and produces a nonempty PR diff. Stop if there is nothing to propose.
  Ask about unrelated commits or changes rather than silently including them.

Inspect staged, unstaged, and untracked changes to establish whether any belong
in the PR. All relevant changes must be committed before proceeding. If any
remain, ask whether to commit them or deliberately exclude them from this PR.
Stage only explicitly selected paths or hunks, review the staged diff, and
follow repository commit conventions. Never automatically stage the entire
working tree, discard changes, or include secrets. Unrelated local changes may
remain untouched; explain that they are excluded.

Check for an existing PR for this head and base using `gh pr list` with explicit
repository, head, and base filters. If one exists, report its URL rather than
creating a duplicate; update it only if requested.

## 2. Understand and validate the changeset

Base the PR text on the complete base-to-head diff, not just branch names,
commit subjects, or the latest commit. Read relevant surrounding code and
documentation to explain the purpose and effects accurately.

Run the smallest appropriate repository checks for the changes, or inspect
reliable results for the same revision. Report failures and checks not run
honestly; never claim an unrun check passed. Resolve blocking problems or ask
whether to publish a draft when readiness is uncertain. Use a normal PR when
ready unless the user requests a draft.

## 3. Write the title and description

**Title:** A concise sentence describing the highest-level effect or effects
of applying the PR. Prefer an imperative sentence such as
`Let teams reveal and compare estimation votes`. Avoid file lists, low-level
implementation details, vague titles, or merely repeating a branch name.

**Description:** Use this order, adapting headings to repository templates
without losing the opening summary or final reviewer guidance:

1. Start with a short paragraph expanding on the key changes and why they
   matter. Do not open with a checklist or a long implementation inventory.
2. Explain the important changes in enough detail to understand behaviour,
   scope, and interactions between components.
3. Explain any critical business or architectural decisions and their
   rationale, constraints, or trade-offs. Distinguish evidenced decisions from
   unknown rationale; do not invent decisions or rejected alternatives.
   Omit this section if there are no critical decisions to explain.
4. Record validation performed, results, and material limitations or risks.
   Include issue references only when verified and relevant.
5. **Finish with reviewer guidance:** identify the best entry point in the
   actual changeset and a short reading order that explains it effectively.
   Link to the relevant files or symbols using repository-relative Markdown
   links. Explain why this starting point helps, and highlight any decisions
   requiring particular scrutiny. Do not append other sections after this.

## 4. Publish using gh

Recheck the current branch, relevant working-tree changes, and HEAD before
publishing; if the changeset changed, refresh validation and the PR text.
Confirm the intended push remote and remote head branch, including fork
ownership. Push the verified branch if necessary, setting its upstream for a
first push. Never force-push or overwrite a divergent remote branch; surface
the conflict and ask how to proceed.

Write the prepared description to a temporary file outside the repository and
run:

```bash
gh pr create --repo OWNER/REPO --base BASE --head HEAD \
  --title "Concise sentence describing the highest-level effects" \
  --body-file /absolute/path/to/pr-body.md
```

Replace placeholders with verified values. Use `OWNER:BRANCH` for a fork head
when necessary, and add `--draft` only when appropriate. Pass text as literal
data, not executable shell content. If creation fails or the result is
ambiguous, inspect PR state with `gh` before retrying to avoid duplicates.

Verify the created PR using `gh pr view` and confirm its URL, head, base, title,
description, and draft state match the intended submission. Remove the
temporary body file. Report the PR URL, target base, and any important
validation limitations; do not report success until creation is verified.
