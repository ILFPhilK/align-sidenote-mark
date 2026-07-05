# Align Sidenote With Mark

Version 0.2.0

A local Obsidian plugin for aligning right-side callouts with marked text in Reading View.

## Features

- Changes top alignment to vertical center alignment.
- Uses incremental transform updates with a small threshold to avoid visual shaking.

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

