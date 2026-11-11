#!/usr/bin/env node
// The check of a page laid out with prastora: renders it at both edges of every frame
// and in both colour schemes, and prints what broke as JSON. Exit 0 when nothing did.
//   node check.mjs <page.html> [--shots <dir>]
// Needs Playwright with Chromium.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const page = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (!page) { console.error('usage: node check.mjs <page.html> [--shots <dir>]'); process.exit(2); }
if (shots) mkdirSync(shots, { recursive: true });

// the frames are read from the stylesheet the page links: its first comment lists them
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
const html = readFileSync(page, 'utf8');
const href = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1] ?? html.match(/<link[^>]+href="([^"]+)"[^>]+rel="stylesheet"/)?.[1];
const FRAMES = JSON.parse(readFileSync(resolve(dirname(page), href), 'utf8').match(/frames[^:]*: (\[.*\])/)[1]);
// frames are in rem of the window; 16 px to the rem at the browser's default
const EDGES = FRAMES.map(f => ({ u: f.name, lo: Math.max(f.from * 16, 320), hi: Math.round((f.to ?? 240) * 16) - 1 }));

const VOCAB = {
  'data-l': ['page', 'canvas', 'stack', 'cluster', 'split', 'switch', 'grid', 'reel', 'cover'],
  'data-bleed': ['up', 'down'],
  'data-space': ['none', 'tight', 'loose'],
  'data-surface': ['raised', 'outline', 'accent'],
  'data-tone': ['quiet', 'strong', 'accent', 'danger', 'ok', 'warn'],
  'data-theme': ['light', 'dark'],
  'data-side': [''], 'data-push': [''], 'data-pad': [''],
};

// runs in the page: what breaks at this width, and the geometry of every element in rem from the canvas edge
function inspect(VOCAB) {
  const issues = [], boxes = [];
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const path = el => {
    const parts = [];
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      let s = e.localName;
      if (e.id) { parts.unshift(s + '#' + e.id); break; }
      if (e.dataset.l) s += `[data-l=${e.dataset.l}]`;
      const sib = e.parentElement ? [...e.parentElement.children].filter(c => c.localName === e.localName) : [];
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(e) + 1})`;
      parts.unshift(s);
    }
    return parts.join(' > ') || 'body';
  };
  const add = (rule, el, detail) => issues.push({ rule, at: path(el), detail });
  const shown = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const scrolls = el => { for (let a = el; a && a !== document.body; a = a.parentElement) if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(a).overflowX)) return true; return false; };
  const all = [...document.body.querySelectorAll('*')];

  for (const el of all) {
    for (const a of el.getAttributeNames()) {
      if (!a.startsWith('data-')) continue;
      const span = { 'data-x': 12, 'data-xw': 12, 'data-xp': 4 }[a];
      if (span) {
        const m = el.getAttribute(a).match(/^(\d+)-(\d+)$/);
        if (!m || +m[1] < 1 || +m[2] > span || +m[1] > +m[2]) add('vocabulary', el, `${a}="${el.getAttribute(a)}" is not first-last within 1-${span}`);
        else if (el.parentElement?.dataset.l !== 'canvas') add('vocabulary', el, `${a} outside a canvas`);
        continue;
      }
      if (!(a in VOCAB)) add('vocabulary', el, `unknown attribute ${a}`);
      else if (!VOCAB[a].includes(el.getAttribute(a))) add('vocabulary', el, `${a}="${el.getAttribute(a)}" is not one of ${VOCAB[a].join(' ')}`);
    }
    if (el.hasAttribute('data-side') && el.parentElement?.dataset.l !== 'split') add('vocabulary', el, 'data-side outside split');
    if (el.hasAttribute('data-push') && !['stack', 'cluster', 'cover'].includes(el.parentElement?.dataset.l)) add('vocabulary', el, 'data-push outside stack, cluster or cover');
    if (el.hasAttribute('style') || el.hasAttribute('class')) add('vocabulary', el, 'style and class are not used: say it with the vocabulary');
  }

  const de = document.documentElement;
  if (document.body.scrollWidth > innerWidth + 1) add('page-scroll-x', document.body, `${document.body.scrollWidth} px wide in a ${innerWidth} px window`);

  const body = parseFloat(getComputedStyle(document.body).fontSize);
  const x0 = document.body.getBoundingClientRect().left;
  for (const el of all) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    boxes.push([path(el), (r.left - x0) / rem, (r.top + scrollY) / rem, r.width / rem, r.height / rem]);
    const p = el.parentElement;
    if (p && p !== document.body && cs.position === 'static' && !scrolls(p)) {
      const q = p.getBoundingClientRect();
      if (r.right > q.right + 1.5 || r.left < q.left - 1.5) add('escapes-parent', el, `${Math.round(r.left)}–${Math.round(r.right)} outside ${Math.round(q.left)}–${Math.round(q.right)}`);
    }
    if (ownText(el)) {
      const f = parseFloat(cs.fontSize);
      if (f < 12) add('text-too-small', el, `${f.toFixed(1)} px`);
      if (el.matches('p, li, dd, td, blockquote') && el.textContent.trim().length > 40 && r.width < f * 15) add('narrow-measure', el, `${(r.width / f).toFixed(1)} em`);
    }
    if (el.matches('button, input:not([type=hidden]), select, textarea, summary')) {
      const t = (el.closest('label') ?? el).getBoundingClientRect();
      if (t.width < 24 || t.height < 24) add('target-too-small', el, `${Math.round(t.width)}×${Math.round(t.height)}`);
    }
  }

  // contrast of text over the composited background
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = c => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, b) => [0, 1, 2].map(i => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  const lum = c => { const f = v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  for (const el of all) {
    if (!shown(el) || !ownText(el) || el.closest('input, select, textarea, [aria-hidden=true]')) continue;
    const layers = [];
    for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 1) break; }
    let bg = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    const cs = getComputedStyle(el), fg = over(rgba(cs.color), bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x), ratio = (a + .05) / (b + .05);
    const size = parseFloat(cs.fontSize), need = size >= 24 || (parseInt(cs.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5;
    if (ratio < need) add('contrast', el, `${ratio.toFixed(2)} < ${need}`);
  }
  return { issues, boxes, rem, body };
}

const browser = await chromium.launch();
const url = pathToFileURL(resolve(page)).href;
const found = new Map();
const note = (i, where) => { const k = i.rule + '|' + i.at; if (!found.has(k)) found.set(k, { ...i, where: [] }); found.get(k).where.push(where); };

for (const scheme of ['light', 'dark']) {
  for (const { u, lo, hi } of EDGES) {
    const seen = {};
    for (const w of [lo, hi]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
      const pg = await ctx.newPage();
      await pg.goto(url);
      const r = await pg.evaluate(inspect, VOCAB);
      seen[w] = r;
      for (const i of r.issues) if (scheme === 'light' || !['vocabulary'].includes(i.rule)) note(i, `${scheme}@${w}`);
      if (r.body < 12) note({ rule: 'body-text-small', at: 'body', detail: `${r.body.toFixed(1)} px` }, `${scheme}@${w}`);
      if (shots && scheme === 'light') await pg.screenshot({ path: `${shots}/u${u}-${w}.png`, fullPage: true });
      await ctx.close();
    }
    // the promise: within a frame every element stands at the same place of the canvas, in rem
    if (scheme === 'light') {
      const a = new Map(seen[lo].boxes.map(b => [b[0], b])), moved = [];
      for (const b of seen[hi].boxes) {
        const o = a.get(b[0]);
        if (!o) continue;
        const d = Math.max(...[1, 2, 3, 4].map(i => Math.abs(b[i] - o[i])));
        if (d > 0.5) moved.push([b[0], d]);
      }
      for (const [at, d] of moved.sort((x, y) => y[1] - x[1]).slice(0, 5))
        note({ rule: 'composition-moves', at, detail: `moves ${d.toFixed(2)} rem between ${lo} and ${hi} px` }, `frame ${u}`);
    }
  }
}
await browser.close();
const problems = [...found.values()];
console.log(JSON.stringify({ page, ok: problems.length === 0, frames: EDGES.map(e => `${e.u}: ${e.lo}–${e.hi} px`), problems }, null, 2));
process.exit(problems.length ? 1 : 0);
