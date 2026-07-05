# Align Sidenote With Mark

Version 0.6.0

A local Obsidian plugin for aligning right-side callouts with marked text in Reading View.

## Features

- Builds navigation from the current Markdown source instead of only rendered DOM.
- Navigation can list all `right` callouts in the current document.
- Clicking an item jumps by source line when possible.

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

