# Connecting Prastora to a project (for agents)

Prastora is a web page layout framework: a page is composed like a picture, once per frame (portrait, landscape, wide, print), and scales as a whole within a frame. Plain CSS, no build step, no JavaScript. Repository: https://github.com/plyn-one/plyn.prastora, release `v0.1.1`.

## 1. Link the core

Any one of these; the font comes with the core from the same place.

- **By the release tag, nothing copied:** `https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v0.1.1/core.min.css` (minified by the CDN; `core.css` is the readable one)
- **Copied files:** put `core.css` and the folder `fonts/` side by side in the project's static files (the core loads `fonts/…` relative to itself). Take them from the repository at tag `v0.1.1`.
- **In a place of Plyń:** add the repository as the submodule `prastora/`, pinned at a commit on its main branch, and link `prastora/core.css`.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>…</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v0.1.1/core.min.css">
</head>
<body><div data-l="page">…</div></body>
</html>
```
The first stylesheet linked must be the core: the check reads the frames from it.

## 2. Read the manifest

`MANIFEST.md`, and only the section of `manifest/` the page needs. From the repository at `v0.1`, or `https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v0.1.1/MANIFEST.md`.

## 3. Run the check

It is a file of the repository; get it into the project first, then install Playwright in the same folder. Node 20 or later.
```
curl -fsSLo check.mjs https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v0.1.1/check.mjs
npm i -D playwright
npx playwright install chromium
node check.mjs page.html [more pages…]
```
It renders each page in every frame (both edges and seven widths inside, light and dark) and on A4, and prints JSON: `ok`, the pages printed, and problems, each with a `fix`. The page is done when `ok` is `true`. `--shots <dir>` saves a picture of each frame and of print.

If Chromium cannot be installed where you work, say so in your report and hand over the page unchecked; do not call it checked.

## Colours and type of a project

They are values in `:root` of the core (`--paper`, `--ink`, `--accent`, `--font` and the others of its tokens layer). A project may set them in its own small stylesheet linked after the core, with no rules other than these values. Composition always comes from the core's attributes.
