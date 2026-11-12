#!/usr/bin/env node
// Builds the core from the parameters of its frames, and a lab page for each variant.
//   node variants.mjs     core.css from the variant marked "core"; lab/<id>/ and lab/index.html from all variants
// A frame holds the windows from `from` rem up to the next frame (rem of the window: the reader's base text
// size); its canvas is `units` units wide and has `cols` columns; `grow` says how the canvas follows the window:
// "pure" (the canvas is the window), {"share": k} (the canvas is k of the window, the rest even margins),
// {"cap": rem} (the canvas stops growing there), {"slow": k} (past the start
// of the frame the canvas takes k of what the window grows). What the window has beyond the canvas is margin.
// Everything inside the canvas is in units, so its composition holds exactly whatever the growth.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const VERSION = '0.1';
const variants = JSON.parse(readFileSync('lab/variants.json', 'utf8'));
const base = readFileSync('src/base.css', 'utf8');
const demo = readFileSync('demo/index.html', 'utf8');

const canvasExpr = f => {
  const g = f.grow;
  if (g === 'pure') return '100vw';
  if (g.share) return `calc(100vw * ${g.share})`;
  if (g.cap) return `min(100vw, ${g.cap}rem)`;
  if (g.slow != null) return `calc(${f.start}rem + (100vw - ${f.start}rem) * ${g.slow})`;
  throw new Error('unknown growth ' + JSON.stringify(g));
};

function placement(cols, attr) {
  const r = [];
  for (let a = 1; a <= cols; a++) for (let b = a; b <= cols; b++)
    r.push(`  :where([${attr}="${a}-${b}"]) { grid-column: ${a} / ${b + 1}; }`);
  return r.join('\n');
}

// on portrait a few things take their own value: size and proportion, as columns take data-xp
const SIZES = { 1: '1rem', 2: '1.4rem', 3: '2rem', 4: '2.8rem', 5: '4rem', 6: '5.6rem', 7: '8rem' };
const RATIOS = { '21/9': '21 / 9', '16/9': '16 / 9', '3/2': '3 / 2', '1/1': '1', '3/4': '3 / 4', '2/3': '2 / 3', '9/16': '9 / 16' };
const portraitOverrides = [
  ...Object.entries(SIZES).map(([k, v]) => `  :where([data-sizep="${k}"]) { font-size: ${v}; }`),
  ...Object.entries(RATIOS).map(([k, v]) => `  :where([data-ratiop="${k}"]) { aspect-ratio: ${v}; }`),
  `  :where([data-float][data-wp=full]) { float: none; inline-size: auto; margin-inline: 0; }`,
  `  :where([data-l=columns]) > :where(p) { text-align: start; }`,
  // a picture whose blocks are set on its grid becomes a stack on a phone when it asks so (data-stackp)
  `  :where([data-l=layer][data-stackp]) { display: flex; flex-direction: column; gap: var(--s1); aspect-ratio: auto; contain: none; }`,
  `  :where([data-l=layer][data-stackp]) > :where(svg) { display: none; }`,
  `  :where([data-l=layer][data-stackp]) > :where(*) { inline-size: auto; }`,
  // a book shows one page at a time on a phone
  `  :where([data-l=book]) { grid-template-columns: minmax(0, 1fr); padding: var(--s1); }`,
  `  :where([data-l=book])::after { content: none; }`,
  // a paragraph in a figure needs width: on a phone it is an ordinary paragraph
  `  :where([data-shaped]) { aspect-ratio: auto; overflow: visible; text-align: start; }`,
  `  :where([data-shaped])::before, :where([data-shaped]) > :where(p)::before { content: none; }`,
  // a sheet keeps its lines on a phone as a page of a PDF does: it is made smaller as a whole
  `  :where([data-l=sheet]) { zoom: calc((var(--units) - 2) / 56); }`,
  // the grid inside a sheet is the same in every frame
  `  :where([data-l=sheet] [data-l=canvas]) > :where([data-x]) { grid-column: auto; }`,
  ...[...placement(12, 'data-x').split('\n')].map(l => l.replace(':where([data-x=', ':where([data-l=sheet] [data-l=canvas]) > :where([data-x=')),
  `  :where([data-l=margin]) { padding-block-start: 0; display: flex; flex-direction: column; gap: var(--s0); }`,
  `  :where([data-l=margin]) > :where([data-line]) { position: static; }`,
  `  :where([data-l=margin]) > :where([data-line])::before { content: "Line " attr(data-line) ". "; position: static; border: 0; inline-size: auto; font-weight: 600; color: var(--accent); }`,
].join('\n');

// print is a frame of its own: an A4 sheet is a canvas of 56 units at 10pt, the whole width between its margins,
// laid out with the landscape composition; nothing leaves the sheet, and blocks do not split
// the print area is 56 × 78 units at 10pt (197.6 × 275.2 mm): a sheet on screen with its own margins, so a sheet
// prints as it is shown, its line numbers and its foot included
const PAGE = `@page { size: A4; margin: 10.9mm 6.2mm; }\n`;
const printFrame = `  @media print {
    :root { --units: 56; --cols: 12; --text-cols: 2; --gutter: 0rem; font-size: 10pt; color-scheme: light; --paper: white; --t4: 2.6rem; --t3: 1.6rem; --t2: 1.3rem; --t1: 1.1rem; }
    :where(body) { min-block-size: 0; }
    :where([data-l=page]) { padding: 0; }
    /* paper carries the content and its pictures; what is only for using the screen stays there */
    :where(form, button, nav, input, select, textarea, video, audio, iframe, dialog, [data-hide~=print]) { display: none !important; }
    /* a blank on a sheet prints with what was entered */
    :where([data-l=sheet] form, [data-l=sheet] input, [data-l=sheet] select, [data-l=sheet] textarea) { display: revert !important; }
    :where([data-l=sheet] label) { display: flex !important; }
    :where([data-out]) { --bleed: 0rem; }
    :where(figure, blockquote, article, table, pre, [data-l=layer], [data-surface], [data-float]) { break-inside: avoid; }
    :where(h1, h2, h3, h4) { break-after: avoid; }
    :where(p) { orphans: 3; widows: 3; }
    :where([data-l=spread]) { display: block; }
    :where([data-l=sheet]) { box-shadow: none; break-after: page; }
    :where([data-l=margin]) { display: none; }
    :where([data-l=book]) { box-shadow: none; padding: 0; }
    :where([data-shaped]) { aspect-ratio: auto; overflow: visible; }
    :where([data-shaped])::before, :where([data-shaped]) > :where(p)::before { content: none; }
    :where([data-l=book])::after { content: none; }
    /* a page of sheets prints its sheets only: the sheet is the page */
    :where(body:has([data-l=sheet])) :where([data-l=page] > header, [data-l=page] > footer) { display: none; }
    :where(body:has([data-l=sheet])) :where([data-l=page], [data-l=page] > main) { gap: 0; }
${placement(12, 'data-x').replace(/^/gm, '  ')}
  }
`;

function css(v) {
  const frames = v.frames.map((f, i) => ({ ...f, start: Math.max(f.from, 20), to: v.frames[i + 1]?.from ?? null }));
  const block = f => [
    // the root size is set from the window, in rem of the window, and rounded down to a quarter of a pixel (1/64 of
    // the base size): text advances are exactly proportional only at such sizes, so lines break the same on every
    // screen of the frame; the canvas is then exactly `units` rem and the little that is left joins the margins
    `  :root { --units: ${f.units}; --cols: ${f.cols}; --text-cols: ${f.name === 'portrait' ? 1 : 2}; --gutter: ${f.name === 'portrait' ? '1rem' : '2rem'}; font-size: calc(${canvasExpr(f)} / ${f.units}); font-size: round(down, calc(${canvasExpr(f)} / ${f.units}), calc(1rem / 64)); }`,
    `  :where([data-hide~=${f.name}]) { display: none !important; }`,
    f.name === 'portrait'
      ? `  :root { --t4: 2.25rem; --t3: 1.75rem; --t2: 1.4rem; --t1: 1.15rem; }\n  :where([data-l=canvas]) > :where(*) { grid-column: 1 / -1; }\n  :where([data-l=canvas][data-pad]) { padding-inline: 0; }\n${placement(f.cols, 'data-xp')}`
      : `${placement(f.cols, 'data-x')}${f.name === 'wide' ? '\n' + placement(f.cols, 'data-xw') : ''}`,
    // portrait's own values come last, so they are not undone by its general rules above
    f.name === 'portrait' ? portraitOverrides : '',
  ].filter(Boolean).join('\n');
  const head = `/* prastora core v${VERSION}, variant ${v.id}: ${v.title}. Built by variants.mjs from lab/variants.json; edit src/base.css or the variant, not this file.
   frames (rem of the window): ${JSON.stringify(frames.map(({ name, from, to, units, cols, grow }) => ({ name, from, to, units, cols, grow })))} */\n`;
  // every frame's rules hold only within its windows; the root size of the first frame is also the default
  const when = f => ['screen', f.from > 0 && `(width >= ${f.from}rem)`, f.to && `(width < ${f.to}rem)`].filter(Boolean).join(' and ');
  const frameCss = `@layer frame {\n` + block(frames[0]).split('\n')[0] + '\n' + frames.map(f =>
    `  @media ${when(f)} {\n` + block(f).replace(/^/gm, '  ') + '\n  }\n').join('') + printFrame + `}\n` + PAGE;
  const canvasRel = `@layer relation {
  /* canvas: the grid of the frame; a child takes columns by data-x (data-xw on wide, data-xp on portrait),
     and without them the whole width; data-bleed lets it reach into the next or previous band */
  :where([data-l=canvas]) { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); column-gap: var(--s1); row-gap: var(--gap, var(--s2)); align-items: start; }
  :where([data-l=canvas]) > :where(*) { grid-column: 1 / -1; min-inline-size: 0; }
  :where([data-bleed=down]) { margin-block-end: calc(var(--s3) * -1); position: relative; z-index: 1; }
  :where([data-bleed=up]) { margin-block-start: calc(var(--s3) * -1); position: relative; z-index: 1; }
}\n`;
  return head + base.replace('@layer reset, tokens, base, relation, surface, tone;', '@layer reset, tokens, base, relation, frame, surface, tone;') + canvasRel + frameCss;
}

// a lab page: the demonstration page itself, laid out with the variant, with its name in the header
const labPage = v => demo
  .replace('href="../core.css"', 'href="core.css"')
  .replace('<title>', `<title>Variant ${v.id}: `)
  .replace('<strong>Prastora</strong>', `<strong>Prastora</strong>\n    <small data-tone="quiet">Variant ${v.id}: ${v.title} · <a href="../index.html">all variants</a></small>`);

const labIndex = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prastora lab</title>
<link rel="stylesheet" href="../core.css">
</head>
<body>
<div data-l="page">
  <main data-l="stack" data-space="loose">
    <section data-l="canvas" aria-labelledby="lab">
      <div data-x="1-8" data-l="stack">
        <h1 id="lab">Prastora lab</h1>
        <p>The same page laid out in ${variants.length} variants. Open one and zoom the browser (Ctrl and the wheel) or resize the window: within a frame the page scales as a picture, and between frames its composition changes. The variants differ in where frames begin, how many units a canvas has, and how the canvas follows the window, what is left becoming margin.</p>
      </div>
    </section>
    <section data-l="canvas" aria-label="Variants">
${variants.map((v, i) => `      <article data-x="${i % 2 ? 7 : 1}-${i % 2 ? 12 : 6}" data-surface="raised" data-l="stack" data-space="tight">
        <h2><a href="${v.id}/index.html">Variant ${v.id}</a></h2>
        <p><strong>${v.title}</strong></p>
        <p data-tone="quiet">${v.note}</p>${v.core ? '\n        <mark data-tone="ok">the core now</mark>' : ''}
      </article>`).join('\n')}
    </section>
  </main>
</div>
</body>
</html>
`;

for (const v of variants) {
  mkdirSync(`lab/${v.id}`, { recursive: true });
  writeFileSync(`lab/${v.id}/core.css`, css(v).replaceAll('url("fonts/', 'url("../../fonts/'));
  writeFileSync(`lab/${v.id}/index.html`, labPage(v));
  if (v.core) writeFileSync('core.css', css(v));
}
writeFileSync('lab/index.html', labIndex());
console.log('built', variants.map(v => v.id + (v.core ? ' (core)' : '')).join(', '));
