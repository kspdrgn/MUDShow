# PLAN: Tauri Schema Sync

## Goal
Keep the generated Tauri schema files in source control without letting Windows and Linux builds drift or create noisy churn.

## Current State
- The repo tracks `tauri/gen/schemas/*.json`.
- `desktop-schema.json`, `windows-schema.json`, and `linux-schema.json` can change when `tauri build` runs.
- Windows and Linux builds do not necessarily regenerate the same schema files.

## Why This Matters
- If schema files are committed from whichever machine happened to build last, cross-platform drift can create unnecessary diffs.
- A Windows-only build may update the Windows and desktop schema files while leaving Linux unchanged.
- A Linux-only build may update the Linux and desktop schema files while leaving Windows unchanged.

## Recommended Approach
Use the CI pipeline to generate schemas on both platforms, then have a follow-up sync step that commits schema changes only when the generated output differs from what is already in source control.

## Implementation Options

### Option 1: Canonical generator
- Pick one platform, usually Linux, as the only source of schema commits.
- Other builds still run, but they only validate.

Pros:
- Simplest to maintain.
- Avoids platform-specific churn.

Cons:
- Only one platform “owns” the schema snapshot.
- Local builds on other platforms may still show changes that are not committed until the canonical job runs.

### Option 2: Dual build, single sync job
- Run both Windows and Linux builds.
- Add a final job that checks the generated schema files and commits them if they changed.

Pros:
- Captures schema output from both platforms.
- Keeps the repo synchronized with the actual build matrix.

Cons:
- More CI complexity.
- Needs care to avoid loops and permission problems.

### Option 3: Auto-PR instead of direct commit
- Run both builds.
- Have the sync job create a bot branch or PR with the schema update.

Pros:
- Works well with protected branches.
- Easier to review schema churn.

Cons:
- Slightly more moving parts than a direct commit.

## Guardrails
- Do not run the auto-commit step on every pull request, especially for forked PRs.
- Prevent infinite rebuild loops by skipping CI on bot-generated schema commits or by limiting the sync job to a specific branch/event.
- Configure Git identity in CI so the commit author is a bot account.
- Normalize file formatting so Windows and Linux do not fight over line endings or JSON pretty-printing.
- If the branch is protected, prefer an auto-PR flow over direct push.

## Recommendation
Use a final schema sync job that runs after both platform builds, then opens a bot PR when schema files change.

That gives us:
- platform coverage from both builds,
- fewer surprises from OS-specific generation,
- and a safer path if branch protection is enabled later.

## Next Step
Update `.github/workflows/ci.yml` so the schema sync runs after the Windows and Linux desktop build jobs succeed.
