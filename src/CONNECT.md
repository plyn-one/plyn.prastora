<!-- written by variants.mjs from src/CONNECT.md with the version of the release; edit src/CONNECT.md -->
# Connecting Prastora to a project (for agents)

Prastora is a web page layout framework: a page is composed like a picture, once per frame (portrait, landscape, wide, print), and scales as a whole within a frame. Plain CSS, no build step, no JavaScript. Repository: https://github.com/plyn-one/plyn.prastora, release `v{{VERSION}}`.

## 1. Link the core

Any one of these.

- **By the release tag, nothing copied:** `https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v{{VERSION}}/core.min.css` (minified by the CDN; `core.css` is the readable one)
- **Copied file:** put `core.css` in the project's static files, taken from the repository at tag `v{{VERSION}}`.
- **In a place of Plyń:** add the repository as the submodule `prastora/`, pinned at a commit on its main branch, and link `prastora/core.css`.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>…</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v{{VERSION}}/core.min.css">
</head>
<body><div data-l="page">…</div></body>
</html>
```
The first stylesheet linked must be the core: the check reads the frames from it.

## 2. Read the manifest

`MANIFEST.md`, and only the section of `manifest/` the page needs. From the repository at `v{{VERSION}}`, or `https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v{{VERSION}}/MANIFEST.md`.

## 3. Run the check

It is a file of the repository; get it into the project first, then install Playwright in the same folder. Node 20 or later.
```
curl -fsSLo check.mjs https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v{{VERSION}}/check.mjs
npm i -D playwright
npx playwright install chromium
node check.mjs page.html [more pages…]

# Optional local accessibility engine; no API key or runtime network dependency:
npm i -D axe-core
node check.mjs page.html --axe

# Optional local Nu Html Checker (Java 17+):
VNU_JAR=/path/to/vnu.jar node check.mjs page.html --html
```
The normal audit renders portrait and landscape once each in light and dark, plus A4 print. `--extended` adds the wide frame, both frame edges and seven interior widths in light, checking whether the composition moves. Both modes test real Tab traversal in portrait and landscape, reporting positive tabindex and focus traps; temporary focus probes are removed before the page closes. Nested frames are reported as requiring their own keyboard check. Focus appearance and screen-reader completeness are not evaluated by this pass.

The optional `--axe` checks portrait and landscape in both colour schemes with locally installed axe-core. Missing axe-core fails explicitly instead of silently passing. Each axe violation has a relevant fix; a clean axe scan is not proof of complete WCAG compliance. Standard mode does not require axe-core.

Optional `--html` checks the original source with the Nu Html Checker locally, reporting errors and warnings with line numbers and fixes; it requires Java and `VNU_JAR`, and fails explicitly when the checker cannot run. It does not use the public validator service, an API key or a network request during checking.

The check prints JSON: `ok`, the pages printed, and problems, each with a `fix`. The page is done when `ok` is `true`. `--shots <dir>` saves a picture of the checked frame edges and of print.

The check serves the input pages and their linked local core on a temporary loopback HTTP origin. This lets CSS alpha outlines load under the same origin and CORS rules as a real site; opening a file directly in a browser does not provide that origin. Missing or failed resources are reported as `resource-load`.

If Chromium cannot be installed where you work, say so in your report and hand over the page unchecked; do not call it checked.

## Colours and type of a project

They are values in `:root` of the core (`--paper`, `--ink`, `--accent`, `--font` and the others of its tokens layer). A project may set them in its own small stylesheet linked after the core, with no rules other than these values. Composition always comes from the core's attributes.
