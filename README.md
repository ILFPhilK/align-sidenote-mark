# Align Sidenote With Mark

Version 0.5.0

A local Obsidian plugin for aligning right-side callouts with marked text in Reading View.

## Features

- Adds a right-side sidenote navigation rail.
- Lists visible/rendered `right` callouts and jumps to their marked text.
- Adds a pin button for keeping the navigation rail expanded.

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

