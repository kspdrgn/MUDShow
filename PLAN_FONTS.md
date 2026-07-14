# Font and Color Customization Plan

## Goal

Add a settings experience for customizing the transcript and input box appearance, including fonts, colors, spacing, and background treatment, while preserving the existing app-level, world-default, and per-character inheritance model.

The core design goals are:

- keep the settings understandable
- use native OS pickers for fonts and colors where the platform allows it
- let the world default character provide the baseline style
- let named characters override only the pieces they need
- keep the transcript readable under every combination of settings

## Current Findings

These are the main things the codebase and spec already imply:

- The app already treats styles as hierarchical settings in `spec/settings.md`.
- The transcript currently has a global monospace-first look, with the font family and size effectively controlled through shared CSS.
- The settings UI already exists and already stores app-wide preferences such as color scheme.
- The transcript renderer already supports style-driven output, including ANSI colors and highlight colors.
- There is already a separate concept of app settings versus world and character settings, so this feature fits the existing storage model rather than introducing a new one.
- Native font pickers are not uniformly available across web UIs, so the plan should include a graceful fallback if the platform cannot expose a true OS font dialog.

## Scope

### Font and Color Settings

- Font
  - used by both transcript and input box
  - includes family and style
- Font size
  - used by both transcript and input box
- Foreground color
  - default transcript text color
- Background color
  - background color of the transcript pane
- Background image
  - image rendered behind the transcript
  - opacity
  - tiling / fill / fit behavior
  - optional gradient treatment over the image layer
- Stripes
  - alternating row treatment for transcript lines

### Layout Settings

- Margins
  - replace the current single display width concept
  - control all four sides of the transcript pane more precisely

### Paragraph Settings

- Wrapped line indent before
- Wrapped line indent after
- Paragraph padding

## Hierarchy Model

The intended hierarchy is:

1. App-wide defaults
2. World default character settings
3. Named character settings

The world default character should be the primary source for world-specific styling.
If the default character has no explicit style setting, the app-wide default should be used.

### Recommended Override Strategy

There are two realistic ways to model sparse per-character overrides:

1. Field-by-field overrides
   - each style property can be independently present or absent
   - simplest to reason about
   - best fit for sparse named-character settings
2. Section-level overrides
   - a character could override a whole section such as "font" or "background"
   - easier for a simpler UI
   - less flexible when the user only wants to tweak one value

Recommended direction:

- use field-by-field overrides for the stored data
- optionally group fields into sections in the UI
- keep inheritance resolution separate from the editor controls

That gives us sparse overrides without forcing the user to duplicate unrelated defaults.

## Native Picker Strategy

The implementation should try to use OS-native pickers where they add real value.

Recommended approach:

- use a native font picker if the platform exposes one cleanly through the desktop layer
- use a native color picker if available
- if a true native font dialog is not practical on a platform, provide a fallback picker that still feels native enough and remains functional
- keep the UI contract the same regardless of picker implementation so the feature remains portable

Practical note:

- color selection can often be satisfied by a native-style color input or platform dialog
- font selection is the harder part, so the plan should not depend on a single OS-specific capability

## Implementation Options

### Option A: Fully Native Dialogs

Use platform dialogs for both font and color selection.

Pros:

- best match for the request
- familiar to users
- minimal custom picker UI

Cons:

- font picker support may vary by OS and desktop bridge
- harder to keep behavior consistent across platforms
- more backend work if the dialog is not already exposed

Best when:

- the desktop layer already offers dependable font and color dialogs

### Option B: Hybrid Native Plus Custom

Use native dialogs where available, and provide a custom in-app editor as fallback.

Pros:

- most robust cross-platform plan
- still satisfies the native-preference goal where possible
- lets us ship even if one picker type is missing

Cons:

- slightly more UI surface area
- requires careful wording so the fallback does not feel like a second-class feature

Best when:

- the app needs portability more than strict native purity

### Option C: Custom Settings Panel Only

Build a custom picker experience entirely inside the settings page.

Pros:

- simplest to implement in one place
- easy to tailor to transcript-specific needs

Cons:

- does not satisfy the native picker preference as well
- may feel less polished for font selection

Best when:

- native integration is not practical for the target platforms

Recommended direction:

- pursue Option B
- use native dialogs when they are practical
- keep a clean custom fallback so the feature works everywhere

## Suggested Data Shape

The stored style model probably wants to be split into a few logical groups:

- typography
- colors
- background image
- spacing and layout
- paragraph flow
- stripe behavior

That structure makes it easier to:

- resolve inheritance
- render a grouped settings editor
- keep future additions from becoming one giant settings object

Recommended data rule:

- store explicit values only
- omit fields that should inherit from the parent scope

## Suggested UI Shape

The settings screen should likely expose the feature in grouped cards or sections:

- Typography
- Colors
- Background
- Layout
- Paragraphs
- Stripes

Each group should show:

- the effective value
- a clear reset-to-inherit action
- a visible hint about whether the current value comes from app defaults, the world default character, or the current character

For the transcript background image, the UI should probably include:

- choose image
- clear image
- opacity slider
- tile/fill/fit mode selector
- optional gradient toggle and gradient shape options

## Transcript Rendering Considerations

The rendering pipeline will need to combine several layers cleanly:

- base background color
- optional background image
- optional image opacity and gradient overlay
- optional stripes
- foreground text
- existing ANSI and highlight styling

Key rule:

- background styling should never make transcript text unreadable

That suggests the implementation should include guardrails such as:

- minimum contrast checks or soft warnings
- a safe default fallback when a custom style becomes too low-contrast
- careful layering so the image cannot obscure the text completely

## Stripes

Stripes are the least settled piece.

Possible interpretations:

1. Alternate background color only
   - simplest and most readable
   - lowest risk
2. Alternate foreground plus background treatment
   - more dramatic
   - harder to preserve readability
3. Alternate row accent overlay
   - visually distinct
   - can coexist with background image and color

Recommended direction:

- start with background-only row striping
- keep it optional
- avoid changing foreground color unless there is a strong accessibility reason

## Layout and Paragraph Settings

The current "display width" concept should be replaced by a margin-aware transcript layout.

Recommended modeling:

- top margin
- right margin
- bottom margin
- left margin

Paragraph-related controls should then layer on top of that:

- wrapped line indent before
- wrapped line indent after
- paragraph padding

This split is useful because it keeps page geometry separate from text flow.

## Proposed Work Phases

### Phase 1: Audit and model

- identify the current settings types and persistence flow
- locate the transcript rendering entry points
- define the style inheritance resolver
- decide which fields are app-wide only versus world/character capable

### Phase 2: Add settings schema

- extend the app settings and world/character settings models
- store sparse overrides cleanly
- update migration or versioning paths if needed

### Phase 3: Build the settings UI

- add grouped controls to the settings page
- support reset-to-inherit actions
- show the effective value and its source
- wire native picker hooks or fallbacks

### Phase 4: Apply styles to the transcript and input box

- update the transcript pane styles
- update the input box styles
- apply margins, spacing, stripes, background image, and typography consistently

### Phase 5: Verify readability and fallback behavior

- test low-contrast combinations
- test image backgrounds with and without gradients
- test inherited values at every level
- test the same style in transcript and input box

## Risks

- Native font picker support may not exist uniformly across platforms.
- Background images and stripes can easily create unreadable combinations if the contrast rules are too loose.
- If the settings model does not keep sparse overrides clean, named characters may become hard to maintain.
- Replacing display width with margins could affect existing layout assumptions in other parts of the UI.

## Recommended Decisions

1. Keep the inheritance model hierarchical and sparse.
2. Prefer field-by-field overrides in storage.
3. Use native pickers where available, with graceful fallback.
4. Keep stripes background-only at first.
5. Separate margin controls from paragraph flow controls.
6. Preserve readability as the main constraint for every visual setting.

## Open Questions

1. Should font selection apply to the transcript and input box as a single shared setting, or should those ever split later?
2. Should named characters be allowed to override every field individually, or should some sections be locked to the world default character?
3. Should stripes be a simple alternating background treatment or a more elaborate row style?
4. Should the background image settings live with transcript styling or in a separate visual subpanel?
5. What is the best fallback experience if the platform cannot provide a real native font picker?

## Acceptance Criteria

- The user can change the transcript and input box font family and style.
- The user can change the transcript and input box font size.
- The user can change transcript foreground and background colors.
- The user can choose a transcript background image and control its opacity and placement.
- The user can configure optional transcript striping.
- The user can configure transcript margins and paragraph spacing.
- The effective style resolves correctly from app defaults, world defaults, and character overrides.
- The UI remains readable and usable with inherited defaults as well as custom overrides.
