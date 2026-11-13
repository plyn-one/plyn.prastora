# Magazine devices

Within a frame lines break the same on every screen, so devices of print hold. Running text of more than one line is set at whole units by the core.

| attribute | values | effect |
|---|---|---|
| `data-l="columns"` | | running text in columns: two on landscape, wide and print, one on portrait |
| `data-pull` | | on a `blockquote` in `columns`: a quote across the columns |
| `data-initial` | | on the first paragraph: an initial letter over three lines |
| `data-float` | `start` `end` | a picture the text runs round; with `data-w` (`quarter` `third` `half` of the columns block) and `data-shape` (`arch` `circle`) |
| `data-l="layer"` | | children lie on one another: a picture and words on it |
| `data-place` | `top-start` `top-center` `top-end` `middle-…` `bottom-…` | on a child of `layer`: where it lies |
| `data-ratio` | `21/9` `16/9` `3/2` `1/1` `3/4` | the proportion of a block; `data-ratiop` for portrait (also `2/3` `9/16`) |
| `data-out` | `start` `end` `both` | on a `layer` or `figure`: its picture reaches the window edge on that side; the block and its words stay on the canvas |
| `data-size` | `1` to `7` | the size of one line of a headline set by hand (each line a `span`); `data-sizep` for portrait |

Longread:
```html
<section data-l="canvas">
  <div data-x="1-9" data-l="columns">
    <p data-initial>…</p>
    <svg data-float="end" data-w="quarter" data-shape="arch" viewBox="…" role="img" aria-label="…">…</svg>
    <p>…</p><blockquote data-pull>…</blockquote><p>…</p>
  </div>
  <aside data-x="10-12" data-l="stack"><p data-tone="quiet">a note</p></aside>
</section>
```
Text after a `data-pull` is laid in the columns again, split between them: leave at least eight lines after it, or put the quote earlier; two or three lines split in two are set with gaps between the words.

Cover, picture to both window edges, words on it:
```html
<section data-l="layer" data-out="both" data-ratio="21/9" data-ratiop="3/4" aria-labelledby="t">
  <svg viewBox="0 0 2100 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="…">…</svg>
  <div data-place="top-start" data-pad><h1 id="t"><span data-size="6" data-sizep="4">First line</span><span data-size="5" data-sizep="3">second</span></h1></div>
  <p data-place="bottom-end" data-pad>Author</p>
</section>
```

A picture into the right margin with a caption on it: `<figure data-x="5-12" data-out="end" data-l="layer" data-ratio="21/9"><svg …></svg><figcaption data-place="bottom-start" data-pad>…</figcaption></figure>`. Put a heading for it before it in the same canvas with `data-x="1-3"`, so they share a row.
