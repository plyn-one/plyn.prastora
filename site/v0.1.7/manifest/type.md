# Typography of print

| attribute | values | effect |
|---|---|---|
| `data-fit` | | on an `svg` in a heading: a line of real text filling its column exactly |
| `data-lines` | `` `shown` | every line inside on one grid of 1.5 units, shared by blocks side by side; `shown` draws the grid |
| `data-hang` | | on a paragraph opening with a quote: the quote hangs outside the edge |
| `data-shaped` | `circle` `diamond` | on a `div` holding one `p`: the paragraph set inside the figure (a plain paragraph on portrait and paper) |

A fitted line: choose `font-size` so the text is near 1000 wide at its natural spacing; `textLength` brings it exactly to the width. Italic and round capitals reach a little past their letters' width: for them give `textLength="970"` and `x="10"`, or the check finds the line outside its column.
```html
<h1 data-l="stack" data-space="tight">
  <svg data-fit viewBox="0 0 1000 176"><text x="0" y="160" font-size="214" textLength="1000" lengthAdjust="spacing">IDLENESS</text></svg>
  <svg data-fit viewBox="0 0 1000 166"><text x="0" y="150" font-size="200" textLength="1000" lengthAdjust="spacing">SO CALLED</text></svg>
</h1>
```

Shared lines: `<section data-l="canvas" data-lines><div data-x="1-9" data-l="columns">…</div><aside data-x="10-12">notes</aside></section>`. Inside, avoid anything with its own height that is not whole lines; the check reports `off-grid`.

Text in a figure: give it enough text to fill the figure in landscape; the check reports `shaped-overflow` when it is too long.
