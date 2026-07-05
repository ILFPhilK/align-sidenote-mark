# Align Sidenote With Mark

Version 0.4.0

A local Obsidian plugin for aligning right-side callouts with marked text in Reading View.

## Features

- Marks the plugin as desktop-only in `manifest.json`.
- Adds a runtime `Platform.isMobile` guard.

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

