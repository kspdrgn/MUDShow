# Configuration Versioning and Migration Plan

## Current implementation

- The JSON app database is at schema version 2.
- Loading validates the explicit `schemaVersion`, runs registered migrations in
  ascending order, normalizes the result, and immediately writes an explicitly
  migrated file back at the current version.
- Unversioned files remain readable as the original current shape for backward
  compatibility. Invalid versions and versions newer than the app are rejected
  instead of being treated as current data.
- Version 1 to version 2 migrates legacy character-name note keys to character
  IDs. Existing ID keys and unknown keys are retained.
- Non-breaking/defaultable shape changes continue to use the normalizer and do
  not cause a rewrite by themselves.

## Rules for future changes

1. Add a new integer current version only for a breaking storage change.
2. Add one migration keyed by the version it produces.
3. Keep migrations bounded, deterministic, and independent of live session,
   plugin, or surface state.
4. Preserve unknown user-owned data whenever it is safe to do so.
5. Add a fixture-level test for the old shape, the migrated shape, malformed
   versions, and newer-version rejection.
6. Do not migrate disposable transcript history through the app database.
