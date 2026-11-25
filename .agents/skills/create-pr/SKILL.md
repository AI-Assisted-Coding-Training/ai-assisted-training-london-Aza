---
name: create-pr
description: 'Use when the user asks to open, create, or raise a pull request for current changes.'
---

# Create a Pull Request

Prepare the current branch's changes, commit them when needed, push the branch,
and open a pull request.

## Procedure

1. **Confirm the branch.** Check the current branch with `git branch --show-current`.
   Do not create a commit or pull request from `main` or `master`; tell the user
   and ask them to switch to a working branch first.

2. **Show the current state and change summary.** Run `git status --short --branch`,
   `git diff --stat`, and `git diff --cached --stat`. Summarize the changes and
   inspect the relevant diffs before staging anything. Do not include unrelated
   user changes.

3. **Validate the changes.** Run the relevant tests or checks for the changes.
   Report failures and resolve them before proceeding where possible.

4. **Commit if needed.** Stage only the intended changes, inspect the staged
   diff, and create a commit with a clear Conventional Commit message, such as
   `feat: add account export` or `fix: handle empty search results`. If there
   are no changes to commit, continue only if the branch already contains
   commits to propose; otherwise stop and tell the user there is nothing to
   open a pull request for.

5. **Push and open the pull request.** Push the current branch to its upstream
   (set the upstream when needed). Check for an existing pull request for the
   branch before creating one. Use `gh pr create` with a concise title and a
   body summarizing the changes and validation performed. If the base branch,
   title, or other required PR details cannot be determined from the repository
   context, ask the user rather than guessing.

6. **Report the result.** Provide the pull request URL and the commit created,
   or explain clearly what prevented creation.
