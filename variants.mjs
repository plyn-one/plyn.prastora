#!/usr/bin/env node
// Builds the core from the parameters of its frames, and the lab that compares variants of them.
//   node variants.mjs            core.css from the variant marked "core", and lab/ from all variants
// A frame: the windows from `from` px up to the next frame; its canvas is `units` rem wide and has `cols`
// columns; `grow` says how the canvas follows the window: "pure" (the canvas is the window), {"cap": px}
// (the canvas stops growing there), {"slow": k} (the canvas grows k of what the window grows past `from`).
// Whatever the window has beyond the canvas is margin. Within a frame everything is in rem, so the
// composition on the canvas holds exactly whatever the growth.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const variants = JSON.parse(readFileSync('lab/variants.json', 'utf8'));
const base = readFileSync('src/base.css', 'utf8');
const demo = readFileSync('demo/index.html', 'utf8');
const DEVICES = [
  ['phone', 360, 780], ['large phone', 412, 915], ['tablet, upright', 768, 1024], ['tablet, lying', 1024, 768],
  ['laptop', 1280, 800], ['laptop', 1440, 900], ['monitor', 1920, 1080], ['monitor', 2560, 1440], ['4K at 100%', 3840, 2160],
];

const canvasExpr = f => {
  const g = f.grow;
  if (g === 'pure') return '100vw';
  if (g.cap) return `min(100vw, ${g.cap}px)`;
  if (g.slow != null) return `calc(${f.start}px + (100vw - ${f.start}px) * ${g.slow})`;
  throw new Error('unknown growth ' + JSON.stringify(g));
};
const canvasPx = (f, w) => {
  const g = f.grow;
  if (g === 'pure') return w;
  if (g.cap) return Math.min(w, g.cap);
  return f.start + (w - f.start) * g.slow;
};
const frameAt = (v, w) => [...v.frames].reverse().find(f => w >= f.from) ?? v.frames[0];

function placement(cols, attr) {
  const r = [];
  for (let a = 1; a <= cols; a++) for (let b = a; b <= cols; b++)
    r.push(`  :where([${attr}="${a}-${b}"]) { grid-column: ${a} / ${b + 1}; }`);
  return r.join('\n');
}

function css(v) {
  const frames = v.frames.map((f, i) => ({ ...f, start: f.start ?? Math.max(f.from, 320), to: v.frames[i + 1]?.from ?? null }));
  const block = f => [
    `  :root { --canvas: ${canvasExpr(f)}; --units: ${f.units}; --cols: ${f.cols}; --gutter: ${f.name === 'portrait' ? '1rem' : '2rem'}; font-size: calc(var(--canvas) / var(--units)); }`,
    f.name === 'portrait'
      ? `  :root { --t4: 2.25rem; --t3: 1.75rem; --t2: 1.4rem; --t1: 1.15rem; }\n  :where([data-l=canvas]) > :where(*) { grid-column: 1 / -1; }\n  :where([data-l=canvas][data-pad]) { padding-inline: 0; }\n${placement(f.cols, 'data-xp')}`
      : `${placement(f.cols, 'data-x')}${f.name === 'wide' ? '\n' + placement(f.cols, 'data-xw') : ''}`,
  ].join('\n');
  const head = `/* prastora core, variant ${v.id}: ${v.title}. Built by variants.mjs from lab/variants.json; edit src/base.css or the variant, not this file.
   frames: ${JSON.stringify(frames.map(({ name, from, to, units, cols, grow }) => ({ name, from, to, units, cols, grow })))} */\n`;
  const frameCss = `@layer frame {\n` + frames.map((f, i) =>
    (i === 0 ? '' : `  @media (width >= ${f.from}px) {\n`) + block(f).replace(/^/gm, i === 0 ? '' : '  ') + (i === 0 ? '\n' : '\n  }\n')).join('') + `}\n`;
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

function row(v, [label, w, h]) {
  const f = frameAt(v, w), c = canvasPx({ ...f, start: f.start ?? Math.max(f.from, 320) }, w), body = c / f.units;
  return { label, w, h, frame: f.name, canvas: Math.round(c), body: body.toFixed(1), margin: Math.round((w - c) / 2) };
}

function labPage(v) {
  const cells = DEVICES.map(d => {
    const r = row(v, d), s = Math.min(1, 380 / d[1]);
    return `<figure style="margin:0;display:flex;flex-direction:column;gap:6px">
  <figcaption style="font:13px/1.4 system-ui"><b>${r.label}, ${r.w}×${r.h}</b><br>${r.frame} · text ${r.body} px · canvas ${r.canvas} px · margins ${r.margin} px</figcaption>
  <div style="width:${Math.round(d[1] * s)}px;height:${Math.round(d[2] * s)}px;overflow:hidden;border:1px solid #9995;border-radius:6px">
    <iframe src="demo.html" title="${r.label}" style="width:${d[1]}px;height:${d[2]}px;border:0;transform:scale(${s});transform-origin:0 0"></iframe></div>
</figure>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prastora lab: ${v.title}</title></head>
<body style="margin:0;padding:16px;font:15px/1.5 system-ui;background:#eef0f3;color:#222">
<p><a href="../index.html">All variants</a> · <a href="demo.html">Open the page alone</a></p>
<h1 style="font-size:22px;margin:0 0 4px">${v.id}: ${v.title}</h1><p style="margin:0 0 16px;max-width:70ch">${v.note}</p>
<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">
${cells}
</div></body></html>\n`;
}

function labIndex() {
  const head = `<tr><th style="text-align:left">Variant</th>${DEVICES.map(d => `<th>${d[1]}×${d[2]}<br><small>${d[0]}</small></th>`).join('')}</tr>`;
  const rows = variants.map(v => `<tr><td><a href="${v.id}/index.html"><b>${v.id}</b></a>: ${v.title}</td>${DEVICES.map(d => {
    const r = row(v, d);
    return `<td style="text-align:center">${r.body} px<br><small>${r.frame}${r.margin ? `, margins ${r.margin}` : ''}</small></td>`;
  }).join('')}</tr>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prastora lab</title></head>
<body style="margin:0;padding:16px;font:15px/1.5 system-ui;background:#eef0f3;color:#222">
<h1 style="font-size:22px;margin:0 0 4px">Prastora lab: how the canvas follows the window</h1>
<p style="max-width:80ch">The same page in each variant. Every frame keeps its composition exactly; the variants differ in where frames begin, how many units a canvas has, and how the canvas grows with the window (what is left becomes margin). Each cell: body text in px, the frame, the side margins in px. Open a variant to see the page in every window.</p>
<div style="overflow-x:auto"><table style="border-collapse:collapse;background:#fff" cellpadding="8" border="1">${head}\n${rows}</table></div>
</body></html>\n`;
}

for (const v of variants) {
  mkdirSync(`lab/${v.id}`, { recursive: true });
  writeFileSync(`lab/${v.id}/core.css`, css(v));
  writeFileSync(`lab/${v.id}/demo.html`, demo.replace('href="../core.css"', 'href="core.css"'));
  writeFileSync(`lab/${v.id}/index.html`, labPage(v));
  if (v.core) writeFileSync('core.css', css(v));
}
writeFileSync('lab/index.html', labIndex());
console.log('built', variants.map(v => v.id + (v.core ? ' (core)' : '')).join(', '));
