# Align Sidenote With Mark

Version 0.7.0

This local Obsidian plugin is desktop-only.

## Features

- Aligns right-side callouts with the vertical center of the marked text below them.
- If several consecutive paragraphs contain `<mark>`, the callout aligns with the center of the whole marked group.
- Adds a right-side navigation rail for all `right` callouts in the current Markdown file.
- Collapsed navigation now shows only the top icon, not item numbers.
- Clicking a navigation item tries to center the matching `<mark>` / target line vertically in the reading pane.
- Mobile is disabled both by `isDesktopOnly: true` and by a runtime platform check.

## Expected Markdown

```markdown
> [!note|right]
> This is a sidenote.

<mark>This is the marked passage.</mark>
```

## Optional CSS variables

```css
body {
  --sidenote-nav-top: 92px;
  --sidenote-nav-right: 12px;
  --sidenote-nav-width: 230px;
}
```
