<!-- written by variants.mjs from src/README.md with the version of the release; edit src/README.md -->
# Prastora

A web page layout framework made first for AI agents. A page is laid out the way a picture is composed: for each class of screen (a frame: phone, landscape screen, wide screen, and print on A4) its layout is set once on a canvas of fixed units and columns, and within the frame the whole layout scales with the window, so every element keeps its place against every other. This makes devices of print layout hold on the web: columns, initial letters, text round shapes, words placed on pictures, documents and blanks the same on screen and on paper.

Plain HTML and CSS, no build step, no JavaScript. Pages are written with a closed set of attributes, and a check renders a page in every frame and on paper and says what to fix.

## Start here

- To use it in a project: [CONNECT.md](CONNECT.md).
- Before laying out a page: [MANIFEST.md](MANIFEST.md), and the section of [manifest/](manifest/) the page needs.
- Examples: [demo/](demo/), published at https://plyn-prastora.pages.dev.

Release `v0.1.2`. The framework is under the MIT License ([LICENSE](LICENSE)); the core's font, Source Sans 3, under the SIL Open Font License ([fonts/OFL.txt](fonts/OFL.txt)).

`AGENTS.md`, `miesca.toml`, `śled.toml` and `pračytańnie/` belong to Plyń, the system this repository is a place of; they are not needed to use the framework.
