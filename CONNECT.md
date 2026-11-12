# Connecting Prastora to a project (for agents)

Prastora is a web page layout framework: a page is composed like a picture, once per frame (portrait, landscape, wide, print), and scales as a whole within a frame. It is plain CSS with no build step and no JavaScript.

## What to take

| file | needed for |
|---|---|
| `core.css` | every page |
| `fonts/` | every page: the core's font, next to `core.css` (the core loads `fonts/…` relative to itself) |
| `MANIFEST.md`, `manifest/` | you, before laying out a page |
| `check.mjs` | you, after: the check of a page |

## Three ways, pick one

1. **A pinned release, nothing copied:** link `https://plyn-prastora.pages.dev/v0.1/core.css`; the fonts come with it. Fetch the manifest and the check from the same address (`/v0.1/MANIFEST.md`, `/v0.1/manifest/<section>.md`, `/v0.1/check.mjs`).
2. **Copied files:** put `core.css` and `fonts/` in the project's static folder side by side; keep `check.mjs` among the project's tools. Record the version (first line of `core.css`) where the project keeps its dependencies.
3. **In a place of Plyń:** add `plyn-one/plyn.prastora` as the submodule `prastora/`, pinned at a commit on its main branch; link `prastora/core.css` and run `prastora/check.mjs`.

## A page

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>…</title>
<link rel="stylesheet" href="…/core.css">
</head>
<body><div data-l="page">…</div></body>
</html>
```
Link `core.css` with `rel="stylesheet"` and no other stylesheet for layout: the check reads the frames from the core the page links.

## The check

Needs Node 20 or later and Playwright with Chromium:
```
npm i -D playwright
npx playwright install chromium
node check.mjs pages/*.html
```
It renders each page in every frame (both edges and seven widths inside, light and dark) and on A4, and prints JSON: `ok`, the pages printed, and problems, each with a `fix`. A page is done when `ok` is `true`. `--shots <dir>` also saves pictures of each frame and of print for looking at.

## What a project keeps to itself

Colours and type are values in `:root` of the core (`--paper`, `--ink`, `--accent`, `--font` and the others in its tokens layer); a project may set them in its own small stylesheet linked after the core, with no rules other than these values. Composition always comes from the core's attributes.
