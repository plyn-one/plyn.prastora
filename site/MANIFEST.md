# Prastora: manifest for agents

Prastora lays out web pages as a picture: a page has a few frames (portrait for phones, landscape, wide, and print), and in each frame its composition is set once on a canvas of fixed units and columns, which scales as a whole with the window. What you see at one width of a frame, every screen of that frame gets. You write semantic HTML, link `core.css`, and say composition with the attributes below. No `class`, no `style`, no stylesheet of your own.

## Work

1. Read this file. If the page needs more, read only the section it needs (see Sections).
2. Write the page. Composition first: bands of `data-l="canvas"`, children placed by columns.
3. Run `node check.mjs page.html` (several pages at once are fine). Each problem comes with a `fix`. Repeat until `"ok": true`.

## Rules

1. Semantic HTML: `header nav main section article aside footer h1..h4 p ul ol dl table figure form label button a`. They are styled already.
2. One `h1` per page, then `h2`, `h3` by meaning. Sizes come from the frame.
3. Only the attributes and values in this manifest and its sections. Sizes and positions only through them.

## Frames and canvas

| frame | windows | canvas | columns |
|---|---|---|---|
| portrait | under 800 px | 22 units, edge to edge | 4 |
| landscape | 800 to 1999 px | 80 units, edge to edge | 12 |
| wide | 2000 px and up | 85 units, 85% of the window, the rest margin | 12 |
| print | A4 | 56 units at 10pt | 12, as landscape |

A child of `data-l="canvas"` takes columns with `data-x="first-last"` in landscape, wide and print (`data-x="1-6"`). Without `data-xp` it takes the whole width on portrait; `data-xp="2-4"` places it there; `data-xw` overrides `data-x` on wide. `data-hide="portrait"` (or `landscape`, `wide`, `print`, several separated by spaces) leaves it out of those frames. A canvas marked `data-reelp` is a strip on portrait: its children side by side, the next one showing at the window's edge, swiped with a finger; use it for a row of cards that would be long as a column. Forms, buttons, navigation and video never print.

## Palette

The core has its own colours. For others, link the core built with a palette instead of the core: `core-cobalt.min.css` in place of `core.min.css`, one stylesheet either way. A palette sets the paper, the ink and the accent for the light and the dark scheme, and nothing else.

| file | light | dark |
|---|---|---|
| `core-cobalt.min.css` | white, a cobalt accent | graphite, an orange accent |
| `core-paper.min.css` | warm paper, a vermilion accent | ink, the same accent lighter |

## Relations: `data-l`

| value | meaning |
|---|---|
| `page` | the whole page with its gutter: the first element in `body`, holding header, main, footer |
| `canvas` | a band laid on the columns of the frame; children placed by `data-x` |
| `stack` | one under another |
| `cluster` | short things in a wrapping row: links, buttons, marks |
| `split` | main beside side, folding into a stack when main would be under 24 units; mark the side `data-side` (default: first child) |
| `switch` | 2 to 4 peers in a row, all into a column below 36 units |
| `grid` | many peers, as many 18-unit columns as fit |
| `reel` | a strip scrolling inside itself; put wide tables in it |
| `cover` | a tall area, its content in the middle |

## Modifiers

| attribute | values | effect |
|---|---|---|
| `data-space` | `none` `tight` `loose` | the gap of this relation |
| `data-side` | | the side of a `split` |
| `data-push` | | in `stack`, `cluster`, `cover`: this and what follows go to the end; a `stack` on the canvas with it fills its row, so text beside a picture can stand at the picture's foot |
| `data-pad` | | padding without a panel |
| `data-surface` | `raised` `outline` `accent` `solid` | a panel; `solid` is filled with the accent and what is inside reads on it as on the page |
| `data-tone` | `quiet` `strong` `accent` `danger` `ok` `warn` | emphasis; on `button`: `accent` main action, `danger` destructive, `quiet` minor |
| `data-button` | | on `a`: a link that looks like a button, for an action that goes somewhere; with `data-tone="accent"` the main one |
| `data-bleed` | `up` `down` `over` | a canvas child reaching 4 units into the band above or below; `over`: lying on the top edge of its band, its middle on the edge (draw the picture so what rests on the edge is at its middle) |
| `data-theme` | `light` `dark` | colour scheme of this part |

## Patterns

```html
<body><div data-l="page">
  <header data-l="cluster"><strong>Name</strong>
    <nav aria-label="Sections" data-push><ul role="list" data-l="cluster"><li><a href="#a">A</a></li></ul></nav></header>
  <main data-l="stack" data-space="loose">
    <section data-l="canvas"><div data-x="1-6" data-l="stack"><h1>…</h1><p>…</p></div>
      <svg data-x="8-12" data-xp="2-4" data-bleed="down" viewBox="…" role="img" aria-label="…">…</svg></section>
    <section data-l="canvas" data-surface="accent"><p data-x="1-6">…</p></section>
    <section data-l="canvas"><article data-x="1-4">…</article><article data-x="5-8">…</article><article data-x="9-12">…</article></section>
  </main>
  <footer data-l="cluster"><small data-tone="quiet">…</small></footer>
</div></body>
```

Menus and switches, all without script:
- **Menu** (a choice among four or more, e.g. languages): `<details data-l="menu"><summary>EN</summary><ul><li><a href="…" aria-current="page">EN</a></li>…</ul></details>`. Opens over the page; the summary shows the current item.
- **Choice among a few** (two or three): a `cluster` of links, each `data-button` or plain; the current one `aria-current="page"`.
- **One open at a time** (questions, FAQ): `<details name="faq">` on each item with the same `name`; the browser closes the others.
- **Fold** (a list that shows in full on wide screens and waits behind a label on a phone, up to 50em, with no script): `<input type="checkbox" id="m" data-fold><label for="m" data-fold-label>Menu</label><nav data-l="fold">…links…</nav>`. The checkbox must come before the nav; the label may sit anywhere in the page, e.g. in a row of controls.
- **Colour scheme**: `data-theme="light"` or `"dark"` on `html` (or on a part); without it the system decides. Optional switch: `<script src="…/theme.js" defer>` and `<button type="button" data-theme-switch hidden>`; the script shows the button, applies and keeps the choice on the device. Without the script no switch shows and the system decides.

Cards `<ul data-l="grid"><li data-surface="raised" data-l="stack" data-space="tight"><h3>…</h3><p>…</p></li></ul>` · figures `<div data-l="stack" data-space="tight"><span data-tone="quiet">Label</span><data value="9">9</data></div>` · facts `<dl><div><dt>…</dt><dd>…</dd></div></dl>` · status `<mark data-tone="ok">…</mark>` · wide table `<div data-l="reel"><table>…</table></div>` · form `<form data-l="stack">`, a field `<label data-l="split"><span data-side>Label</span><input name="x"></label>`, actions in a `cluster`.

## Sections: read only when the page needs them

| section | read it for |
|---|---|
| `manifest/magazine.md` | columns of running text, a pulled quote, an initial letter, text round a shape, a cover with words on its picture, a picture reaching the window edge, headlines set by hand |
| `manifest/documents.md` | documents in sheets the same on screen and paper, numbered lines, notes at lines, blanks with a box per letter |
| `manifest/pictures.md` | labels on parts of a picture, text round an image's outline, comic balloons, a drawing through the page, a book spread, motion on scrolling |
| `manifest/type.md` | headline lines filling their column, a shared grid of lines, hanging quotes, text set in a figure |
