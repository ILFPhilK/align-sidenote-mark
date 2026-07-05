# Align Sidenote With Mark

Version 0.1.0

A local Obsidian plugin for aligning right-side callouts with marked text in Reading View.

## Features

- Initial local Obsidian plugin.
- Aligns each `right` callout with the first `<mark>` in the next paragraph in Reading View.

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

