# Taps Integration

The `taps` world profile activates FuzzBall first and Taps second. Taps depends
on the FuzzBall property service rather than on FuzzBall implementation
classes.

The initial Taps contribution exposes ride mode as a generic world-session
select action. Supported values are `ride`, `hand`, `walk`, and `fly`, backed
by `/ride/_mode`. Connecting requests the current value; selecting a value
sends `@set me=/ride/_mode:<value>`. The displayed value is transient,
session-scoped, and reconciled from captured server property data.

Other Taps features, external plugin loading, and native/UI-specific rendering
remain outside this integration milestone.
