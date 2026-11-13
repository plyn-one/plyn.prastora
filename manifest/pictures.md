# Pictures and composition across the page

A gridded layer lays 20 × 20 cells over its picture (a twentieth of its width and height each). Text and drawing share these coordinates, so a label meets its part and a road meets its stops on every screen of a frame. Give such a layer `data-ratio`.

| attribute | values | effect |
|---|---|---|
| `data-grid` | | on a `layer`: the 20 × 20 grid |
| `data-col`, `data-row` | `1` to `20` | on a child of a gridded layer: the cell it starts at |
| `data-w` | `quarter` `third` `half` | its width as a share of the whole picture |
| `data-tag` | | a label: one short line |
| `data-balloon` | `start` `end` | a speech balloon, its tail at its start or end, toward the speaker below |
| `data-stackp` | | on a gridded layer: on portrait its blocks become a stack, the drawing is hidden |
| `data-shape="alpha"` | | on an `img` with `data-float`: text runs round the image's outline; name the image again as `style="--shape: url(…)"`, the only style allowed; an inline relative URL is relative to the document, just like `src` |
| `data-l="book"` | | two pages with a gutter, one page on portrait; a child with `data-across` crosses both |
| `data-reveal` | `fade` `rise` `draw` | appears as it scrolls into view; `draw` on an SVG `path` with `pathLength="1"` draws it; off for readers who ask for less motion |

The core registers `--shape` as a URL so it keeps the base of its declaration when used by the stylesheet. Keep the image and its outline at the same address; no copy beside the stylesheet is needed. Alpha outlines require a browser with CSS `@property` support, and the image must be same-origin or served with CORS permission. The rendering check reports resource loading failures, including missing outline images.

Labels on a drawing: draw the leader in the SVG from the label's cell to the part. With `viewBox="0 0 1000 667"`, cell (col, row) starts at x = (col − 1) × 50, y = (row − 1) × 33.35.
```html
<figure data-x="5-12" data-l="layer" data-grid data-ratio="3/2" aria-label="…">
  <svg viewBox="0 0 1000 667" role="img" aria-label="…">… <path d="M232 36 L385 212" stroke="currentColor"/></svg>
  <span data-col="5" data-row="1" data-tag>Saddle</span>
</figure>
```

Comic panel: `<figure data-l="layer" data-grid data-ratio="1/1" data-surface="outline" aria-label="…"><svg …></svg><p data-col="9" data-row="2" data-balloon="end">Line spoken</p></figure>`.

A road through the page: a gridded layer with `data-ratio="1/1"` and `data-stackp`, holding the drawing (`<path data-reveal="draw" pathLength="1" d="…">`) and stops as `article`s with `data-col`, `data-row`, `data-w="third"`, `data-reveal="rise"`; draw the road past the stops in the same coordinates.

Book: `<article data-l="book"><figure data-across data-l="layer" data-ratio="21/9"><svg …></svg></figure><div>page one</div><div>page two</div></article>`.
