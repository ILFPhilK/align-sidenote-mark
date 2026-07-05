# Changelog

All notable changes to this local Obsidian plugin are documented here.

## v0.6.0 - Parse full document navigation

- Builds navigation from the current Markdown source instead of only rendered DOM.
- Navigation can list all `right` callouts in the current document.
- Clicking an item jumps by source line when possible.

## v0.5.0 - Add DOM based navigation rail

- Adds a right-side sidenote navigation rail.
- Lists visible/rendered `right` callouts and jumps to their marked text.
- Adds a pin button for keeping the navigation rail expanded.

## v0.4.0 - Disable on mobile

- Marks the plugin as desktop-only in `manifest.json`.
- Adds a runtime `Platform.isMobile` guard.

## v0.3.0 - Align marked paragraph group

- Detects consecutive marked paragraphs below a callout.
- Aligns the callout center to the whole marked group center.

## v0.2.0 - Stabilize center alignment

- Changes top alignment to vertical center alignment.
- Uses incremental transform updates with a small threshold to avoid visual shaking.

## v0.1.0 - Initial align first mark

- Initial local Obsidian plugin.
- Aligns each `right` callout with the first `<mark>` in the next paragraph in Reading View.

