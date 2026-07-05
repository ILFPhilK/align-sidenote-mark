# Align Sidenote With Mark

Version 0.3.0

A local Obsidian plugin for aligning right-side callouts with marked text in Reading View.

## Features

- Detects consecutive marked paragraphs below a callout.
- Aligns the callout center to the whole marked group center.

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

