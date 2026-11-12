# Prastora: manifest for agents

You lay out a page with semantic HTML, `core.css` and the attributes below. Nothing else: no `class`, no `style`, no other stylesheet for layout.

## How the page behaves

A page has a few frames: portrait (phones), landscape, wide. Each frame has its own composition, set once, on a canvas of a fixed number of units (1rem is one unit) and columns: 4 in portrait, 12 in landscape and wide. Within a frame the canvas scales as a whole, like a picture: every element keeps its place against every other on every screen of the frame. What the window has beyond the canvas is margin. You place things by columns of the canvas, not by sizes. Print is a frame too: an A4 sheet, 50 units at 10pt, laid out with the landscape composition; blocks do not split across sheets.

## Rules

1. Semantic HTML first: `header nav main aside article section footer form label fieldset table dl ul button a h1..h6 p`. They are already styled.
2. Composition is given by `data-l="canvas"` and the columns its children take; small assemblies inside use the other relations. Relations nest at any depth.
3. Use only the attributes and values listed here.
4. Headings by meaning: one `h1` per page, `h2` for sections, `h3` inside them. Their size is set by the frame.
5. Run `node check.mjs page.html` and fix every problem until it prints `"ok": true`. The check renders both edges of every frame in both colour schemes.

## Relations: `data-l`

| value | meaning | children |
|---|---|---|
| `page` | the whole page with its gutter; put it on the first element inside `body` | header, main, footer |
| `canvas` | a band of the page laid on the columns of the frame; each child takes columns by `data-x` | placed children |
| `columns` | running text in columns: two on landscape and wide, one on portrait | paragraphs, a pull quote, a floated picture |
| `layer` | children lie on one another: a picture with words on it at set places | a picture and placed text |
| `stack` | one under another | any |
| `cluster` | short things in a wrapping row: links, buttons, marks | short items |
| `split` | main beside side; folds into a stack when main would be under 24 units | two; mark the side `data-side` (default: the first) |
| `switch` | 2 to 4 equal parts in a row, all into a column at once below 36 units | peers |
| `grid` | many equal things, as many 18 unit columns as fit | peers |
| `reel` | a strip that scrolls inside itself; put wide tables in it | items, or one `table` |
| `cover` | a tall area with its content in the middle | any |

## Modifiers

| attribute | values | effect |
|---|---|---|
| `data-x` | `first-last`, columns 1 to 12 | on a child of `canvas`: the columns it takes in landscape and wide, as `1-6` |
| `data-xw` | `first-last`, 1 to 12 | the same for wide only, when it differs |
| `data-xp` | `first-last`, 1 to 4 | the same for portrait; without it the child takes the whole width there |
| `data-bleed` | `up` `down` | on a child of `canvas`: reaches 4 units into the band above or below |
| `data-out` | `start` `end` `both` | on a `layer` or `figure`: its picture reaches the window edge on that side; the block and words on it stay on the canvas |
| `data-place` | `top-start` … `bottom-end` (nine) | on a child of `layer`: where it lies |
| `data-ratio` | `21/9` `16/9` `3/2` `1/1` `3/4` | the proportion of a block; `data-ratiop` (also `2/3` `9/16`) for portrait |
| `data-size` | `1` to `7` | a size set by hand, for a headline set line by line (each line a `span`); `data-sizep` for portrait |
| `data-initial` | | on the first paragraph: an initial letter over three lines |
| `data-pull` | | on a `blockquote` in `columns`: a quote set across the columns |
| `data-float` | `start` `end` | a picture the text runs round, with `data-w` (`quarter` `third` `half` of the columns) and `data-shape` (`arch` `circle`) |
| `data-hide` | `portrait` `landscape` `wide` `print` | not shown in that frame |
| `data-space` | `none` `tight` `loose` | the gap of this relation only |
| `data-side` | | on a child of `split`: the side |
| `data-push` | | on a child of `stack`, `cluster` or `cover`: it and the ones after it go to the end |
| `data-pad` | | padding with no panel |
| `data-surface` | `raised` `outline` `accent` | a panel with padding and rounded corners |
| `data-tone` | `quiet` `strong` `accent` `danger` `ok` `warn` | emphasis; on `button`: `accent` main action, `danger` destructive, `quiet` minor |
| `data-theme` | `light` `dark` | colour scheme of this part (default: the reader's system) |

## Patterns

Page:
```html
<body><div data-l="page">
  <header data-l="cluster"><strong>Name</strong>
    <nav aria-label="Sections"><ul role="list" data-l="cluster"><li><a href="#a">A</a></li></ul></nav>
    <button data-push data-tone="accent">Main action</button></header>
  <main data-l="stack" data-space="loose">…</main>
  <footer data-l="cluster"><small data-tone="quiet">…</small></footer>
</div></body>
```

Hero with a picture bound to the heading and reaching into the next band:
```html
<section data-l="canvas"><div data-x="1-6" data-l="stack"><h1>…</h1><p>…</p></div>
  <svg data-x="8-12" data-xp="2-4" data-bleed="down" …></svg></section>
<section data-l="canvas" data-surface="accent"><p data-x="1-6">…</p></section>
```

Longread: `<section data-l="canvas"><div data-x="1-9" data-l="columns"><p data-initial>…</p><svg data-float="end" data-w="quarter" data-shape="arch" …></svg><p>…</p><blockquote data-pull>…</blockquote><p>…</p></div><aside data-x="10-12" data-l="stack">notes</aside></section>`

Cover: `<section data-l="layer" data-out="both" data-ratio="21/9" data-ratiop="3/4"><svg preserveAspectRatio="xMidYMid slice" …></svg><div data-place="top-start" data-pad><h1><span data-size="6" data-sizep="4">First line</span><span data-size="5" data-sizep="3">second</span></h1></div></section>`

Text of more than one line is set at whole units (the core does this): only then its lines break the same on every screen of a frame. If the check still finds text moving within a frame, a line lies on the edge of its column: move the column by one, or change the words.

Three in a row: `<section data-l="canvas"><article data-x="1-4">…</article><article data-x="5-8">…</article><article data-x="9-12">…</article></section>`

Cards: `<ul data-l="grid"><li data-surface="raised" data-l="stack" data-space="tight"><h3>…</h3><p>…</p><mark data-tone="ok">…</mark></li></ul>`

Figures: `<section data-l="switch"><div data-surface="outline" data-l="stack" data-space="tight"><span data-tone="quiet">Label</span><data value="9">9</data></div>…</section>`

Facts: `<dl><div><dt>Label</dt><dd>Value</dd></div>…</dl>`

Form: `<form data-l="stack">`; a short field `<label data-l="split"><span data-side>Label</span><input name="x"></label>`; a long one in a plain `label`; a choice `<label><input type="checkbox" name="y"> Text</label>`; actions in a `cluster`.

Wide table: `<div data-l="reel"><table>…</table></div>`. Status: `<mark data-tone="ok">…</mark>`.

## Problems the check reports

`composition-moves` an element stands elsewhere on the canvas at the two edges of one frame: something is sized outside the vocabulary · `page-scroll-x` the page is wider than the window · `escapes-parent` · `narrow-measure` prose in a column under 15 em: change the relation · `text-too-small` · `body-text-small` · `target-too-small` under 24×24 px · `contrast` · `vocabulary` an attribute, value, `class` or `style` outside this manifest.
