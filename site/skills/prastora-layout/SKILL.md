---
name: prastora-layout
description: Lay out a web page with Prastora, a CSS framework made for agents, so the page keeps its composition on phones, screens, wide screens and A4 paper, and prove it with the framework's rendering check. Use when asked to make or fix a page that links Prastora's core.css.
---

# Laying out a page with Prastora

Prastora composes a page like a picture: once for each frame (portrait under 800 px, landscape, wide from 2000 px, print on A4), and within a frame the page scales as a whole. A page is semantic HTML with a closed set of `data-` attributes: no `class`, no `style`, no stylesheet of its own.

1. Link the core, one stylesheet: `https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v0.1.7/core.min.css`, or the core built with a palette, such as `core-cobalt.min.css` from the same release.
2. Read the manifest: https://plyn-prastora.pages.dev/MANIFEST.md. Read a section of `manifest/` only when the page needs its devices.
3. Write the page: bands of `data-l="canvas"`, children placed on columns with `data-x`, `data-xp` on phones.
4. Run the check and repeat until it says `"ok": true`; every problem comes with a `fix`:
   ```
   curl -fsSLo check.mjs https://cdn.jsdelivr.net/gh/plyn-one/plyn.prastora@v0.1.7/check.mjs
   npm i -D playwright && npx playwright install chromium
   node check.mjs --extended page.html
   ```

How to connect it to a project in other ways: https://plyn-prastora.pages.dev/CONNECT.md
