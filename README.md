# Align Sidenote With Mark

Version 0.12.0

This local Obsidian plugin is desktop-only.

## Features

- Aligns right-side callouts with the vertical center of the marked text below them.
- If several consecutive paragraphs contain `<mark>` or Obsidian `==highlight==`, the callout aligns with the center of the whole marked group.
- Adds a right-side navigation rail for all `right` callouts in the current Markdown file.
- When Obsidian's right sidebar / right split is open, the navigation rail automatically moves left so it does not sit inside that sidebar.
- When collapsed, the navigation rail only shows the top icon.
- When expanded, the navigation list shows up to 20 items at once and scrolls for more.
- Clicking a navigation item jumps to the matching marked text line and tries to center it in the reading area.
- Mobile is disabled both by `isDesktopOnly: true` and by a runtime platform check.
- Navigation item text is left-aligned after the number badge.
- Navigation items no longer show Obsidian black hover tooltips.
- Clicking any navigation item now prefers source-line jumping, preventing stale visible-callout mappings from blocking jumps back to earlier items.

## Expected Markdown

```markdown
> [!note|right]
> This is a sidenote.

<mark>This is the marked passage.</mark>
```

Obsidian highlight syntax is also supported:

```markdown
> [!note|right]
> This is a sidenote.

==This is the marked passage.==
```

## Optional CSS variables

```css
body {
  --sidenote-nav-top: 92px;
  --sidenote-nav-right: 12px;
  --sidenote-nav-width: 230px;
  --sidenote-nav-items-max-height: 772px; /* 约等于 20 条 */
}
```
