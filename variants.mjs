#!/usr/bin/env node
// Builds the core from the parameters of its frames, and a lab page for each variant.
//   node variants.mjs     core.css from the variant marked "core"; lab/<id>/ and lab/index.html from all variants
// A frame holds the windows from `from` rem up to the next frame (rem of the window: the reader's base text
// size); its canvas is `units` units wide and has `cols` columns; `grow` says how the canvas follows the window:
// "pure" (the canvas is the window), {"cap": rem} (the canvas stops growing there), {"slow": k} (past the start
// of the frame the canvas takes k of what the window grows). What the window has beyond the canvas is margin.
// Everything inside the canvas is in units, so its composition holds exactly whatever the growth.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const variants = JSON.parse(readFileSync('lab/variants.json', 'utf8'));
const base = readFileSync('src/base.css', 'utf8');
const demo = readFileSync('demo/index.html', 'utf8');

const canvasExpr = f => {
  const g = f.grow;
  if (g === 'pure') return '100vw';
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

function css(v) {
  const frames = v.frames.map((f, i) => ({ ...f, start: Math.max(f.from, 20), to: v.frames[i + 1]?.from ?? null }));
  const block = f => [
    // the root size is set from the window, in rem of the window; the canvas is then exactly `units` rem
    `  :root { --units: ${f.units}; --cols: ${f.cols}; --gutter: ${f.name === 'portrait' ? '1rem' : '2rem'}; font-size: calc(${canvasExpr(f)} / ${f.units}); }`,
    f.name === 'portrait'
      ? `  :root { --t4: 2.25rem; --t3: 1.75rem; --t2: 1.4rem; --t1: 1.15rem; }\n  :where([data-l=canvas]) > :where(*) { grid-column: 1 / -1; }\n  :where([data-l=canvas][data-pad]) { padding-inline: 0; }\n${placement(f.cols, 'data-xp')}`
      : `${placement(f.cols, 'data-x')}${f.name === 'wide' ? '\n' + placement(f.cols, 'data-xw') : ''}`,
  ].join('\n');
  const head = `/* prastora core, variant ${v.id}: ${v.title}. Built by variants.mjs from lab/variants.json; edit src/base.css or the variant, not this file.
   frames (rem of the window): ${JSON.stringify(frames.map(({ name, from, to, units, cols, grow }) => ({ name, from, to, units, cols, grow })))} */\n`;
  const frameCss = `@layer frame {\n` + frames.map((f, i) =>
    (i === 0 ? '' : `  @media (width >= ${f.from}rem) {\n`) + block(f).replace(/^/gm, i === 0 ? '' : '  ') + (i === 0 ? '\n' : '\n  }\n')).join('') + `}\n`;
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
  writeFileSync(`lab/${v.id}/core.css`, css(v));
  writeFileSync(`lab/${v.id}/index.html`, labPage(v));
  if (v.core) writeFileSync('core.css', css(v));
}
writeFileSync('lab/index.html', labIndex());
console.log('built', variants.map(v => v.id + (v.core ? ' (core)' : '')).join(', '));
