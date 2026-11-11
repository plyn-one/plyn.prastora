# Prastora: manifest for agents

You lay out a page with semantic HTML, `core.css` and the attributes below. Nothing else: no `class`, no `style`, no other stylesheet for layout.

## How the page behaves

The page is always U units wide, and 1rem is one unit. U is a step of a ladder (20, 25, 32, 40, 50, 64, 80, 100, 128), chosen by the window in the reader's own text size. Inside a step the page scales as a whole: every relation resolves the same way, so what you see at one width of a step you get at every width of it. Between steps relations fold by themselves. Body text is never smaller than the reader's size, and zoom makes it larger. You never pick sizes: pick relations and meanings.

## Rules

1. Semantic HTML first: `header nav main aside article section footer form label fieldset table dl ul button a h1..h6 p`. They are already styled.
2. Composition is given only by `data-l`. Relations nest at any depth.
3. Use only the attributes and values listed here.
4. Headings by meaning: one `h1` per page, `h2` for sections, `h3` inside them. Their size follows the step.
5. Run `node check.mjs page.html` and fix every problem until it prints `"ok": true`. The check renders both edges of every step in both colour schemes.

## Relations: `data-l`

| value | meaning | children |
|---|---|---|
| `page` | the whole page with its gutter; put it on the first element inside `body` | header, main, footer |
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

Hero with a picture bound to the text: `<section data-l="split"><div data-l="stack"><h1>…</h1><p>…</p></div><svg data-side …></svg></section>`

Cards: `<ul data-l="grid"><li data-surface="raised" data-l="stack" data-space="tight"><h3>…</h3><p>…</p><mark data-tone="ok">…</mark></li></ul>`

Figures: `<section data-l="switch"><div data-surface="outline" data-l="stack" data-space="tight"><span data-tone="quiet">Label</span><data value="9">9</data></div>…</section>`

Facts: `<dl><div><dt>Label</dt><dd>Value</dd></div>…</dl>`

Form: `<form data-l="stack">`; a short field `<label data-l="split"><span data-side>Label</span><input name="x"></label>`; a long one in a plain `label`; a choice `<label><input type="checkbox" name="y"> Text</label>`; actions in a `cluster`.

Wide table: `<div data-l="reel"><table>…</table></div>`. Status: `<mark data-tone="ok">…</mark>`.

## Problems the check reports

`composition-moves` an element stands elsewhere at the two edges of one step: something is sized outside the vocabulary · `page-scroll-x` the page is wider than the window · `escapes-parent` · `narrow-measure` prose in a column under 15 em: change the relation · `text-too-small` · `body-below-reader-size` · `target-too-small` under 24×24 px · `contrast` · `vocabulary` an attribute, value, `class` or `style` outside this manifest.
