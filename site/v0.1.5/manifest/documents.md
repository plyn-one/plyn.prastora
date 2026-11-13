# Documents and blanks

A sheet is 50 × 70 units: the print area of A4 at 10pt. Its lines break the same on every screen and on paper, it prints as one page with its margins, and on a phone it shrinks as a whole, as a page of a PDF. Every line on it stands on a grid of 1.5 units, 46 lines a sheet.

| attribute | values | effect |
|---|---|---|
| `data-l="spread"` | | a sheet and its margin of notes; one per sheet |
| `data-l="sheet"` | | the sheet; a `footer` as its last child is its foot |
| `data-numbered` | | on a sheet: its lines numbered in its left margin |
| `data-l="margin"` | | notes beside a sheet (screen only) |
| `data-line` | `1` to `46` | on a note: the line it stands at, with a line drawn to the text |
| `data-comb` | `1` to `24` | on an `input` on a sheet: a box per letter, letters typed one in each; give `maxlength` the same number |

Document: put as much on one sheet as fits; start a new sheet only when the check reports `sheet-overflow`. Clauses (`ol` inside `li`) are numbered through all sheets.
```html
<section data-l="spread" aria-label="The agreement">
  <article data-l="sheet" data-numbered>
    <h1>Title</h1><p>Preamble…</p>
    <ol><li>Subject<ol><li>Clause text…</li><li>…</li></ol></li><li>Fees<ol><li>…</li></ol></li></ol>
    <footer>Title · sheet 1</footer>
  </article>
  <aside data-l="margin" aria-label="Notes"><p data-line="11">A note on line 11.</p></aside>
</section>
```
To find the line of a clause, run the check once with `--shots`, or count: a heading of the sheet takes 2 lines, a paragraph its lines, a blank line between blocks.

Blank: a `form data-l="canvas"` on a sheet. Inside a sheet the grid has 12 columns in every frame. Each field is a `label` with an `input`; a choice (`checkbox`, `radio`) takes two lines. A blank prints with what was entered, without its buttons.
```html
<article data-l="sheet"><form data-l="canvas" action="…">
  <h1 data-x="1-12">Request</h1>
  <fieldset data-x="1-12" data-l="canvas"><legend data-x="1-12">1. Applicant</legend>
    <label data-x="1-12">Surname *<input data-comb="24" maxlength="24" name="surname" required></label>
    <label data-x="1-6"><input type="checkbox" name="a"> Choice</label>
  </fieldset>
  <div data-x="1-12" data-l="cluster"><button type="submit" data-tone="accent">Send</button></div>
</form></article>
```
