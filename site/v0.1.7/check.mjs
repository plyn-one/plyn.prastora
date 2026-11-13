#!/usr/bin/env node
// The check of pages laid out with prastora. Each page is rendered in every frame of the core it links,
// once in each distinct screen composition (portrait, landscape), in light and dark, plus A4 print.
// --extended checks every screen frame at both edges and seven interior widths, to verify scaling invariants.
// --html validates source HTML with the locally installed Nu Html Checker (VNU_JAR path).
// --axe runs the local axe-core engine on portrait and landscape in both colour schemes.
// Reports each problem with a fix. Exit 0 when nothing broke.
//   node check.mjs <page.html> [more pages…] [--axe] [--html] [--extended] [--shots <dir>]
// Needs Playwright with Chromium (npm i -D playwright; npx playwright install chromium).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve, dirname, basename, relative, isAbsolute, sep } from 'node:path';
import { mkdirSync, readFileSync, readFile } from 'node:fs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
// Playwright is looked for beside this file and in the folder the check is run from
const { chromium } = (() => {
  for (const base of [import.meta.url, pathToFileURL(process.cwd() + '/').href]) {
    try { return createRequire(base)('playwright'); } catch {}
  }
  console.error('check.mjs needs Playwright with Chromium. In the folder you run it from:\n  npm i -D playwright\n  npx playwright install chromium');
  process.exit(2);
})();

const args = process.argv.slice(2);
const pages = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--shots');
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const extended = args.includes('--extended');
const useHtml = args.includes('--html');
const vnuJar = process.env.VNU_JAR;
const useAxe = args.includes('--axe');
const axeSource = useAxe ? (() => {
  for (const base of [import.meta.url, pathToFileURL(process.cwd() + '/').href]) {
    try { return createRequire(base)('axe-core').source; }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  console.error('check.mjs --axe needs a local axe-core package. Install with: npm i -D axe-core');
  process.exit(2);
})() : null;
if (!pages.length) { console.error('usage: node check.mjs <page.html> [more pages…] [--axe] [--html] [--extended] [--shots <dir>]'); process.exit(2); }
if (shots) mkdirSync(shots, { recursive: true });

if (useHtml && !vnuJar) { console.error('check.mjs --html requires VNU_JAR pointing to a local vnu.jar'); process.exit(2); }

// the frames are read from the core the page links: its first comment lists them, in rem of the window
// (16 px to the rem at the browser's default)
function stylesheetOf(page) {
  const html = readFileSync(page, 'utf8');
  const href = [...html.matchAll(/<link[^>]+>/g)].map(m => m[0]).filter(l => /rel="stylesheet"/.test(l)).map(l => l.match(/href="([^"]+)"/)?.[1]).find(Boolean);
  if (!href) throw new Error(`${page}: no stylesheet linked; link core.css`);
  return href;
}

async function framesOf(page) {
  const href = stylesheetOf(page);
  // the core may be a file beside the page or a pinned release at an address
  const css = /^https?:/.test(href) ? await (await fetch(href)).text() : readFileSync(resolve(dirname(page), href), 'utf8');
  const m = css.match(/frames[^:]*: (\[.*\])/);
  if (!m) throw new Error(`${page}: ${href} is not the prastora core (no list of frames in its first comment)`);
  return JSON.parse(m[1]).map(f => ({ u: f.name, lo: Math.max(f.from * 16, 320), hi: Math.round((f.to ?? 240) * 16) - 1 }));
}

// what to do about each problem, for the agent that reads the report
const FIX = {
  'keyboard-trap': 'check focus management and keydown handlers; allow Tab to leave every component',
  'tab-order': 'remove positive tabindex and follow the DOM reading order',
  'keyboard-unavailable': 'test nested frames separately; this pass inspects only the top document',
  'resource-load': 'repair the resource address or its server/CORS permissions; an inline --shape URL is relative to the document, like the image src',
  'shape-outline': 'give the alpha image --shape: url(...) and use a browser with CSS @property support',
  'composition-moves': 'a line lies on the edge of its column, or something is sized outside the vocabulary: move the column by one, or change the words',
  'page-scroll-x': 'something is wider than the window: see escapes-parent for which',
  'escapes-parent': 'give it more columns, let it wrap, or set it in a reel',
  'narrow-measure': 'prose in a column under 12 em: give it more columns, or hide it in that frame',
  'text-too-small': 'use a size from the vocabulary; in a narrow frame, one step larger',
  'body-text-small': 'the frame starts too narrow for its units',
  'target-too-small': 'a control under 24×24 px: put it in a label or give it its own line',
  'contrast': 'text too pale on its background: drop data-tone="quiet" there, or change the surface',
  'vocabulary': 'only the attributes and values of MANIFEST.md and its sections in manifest/',
  'sheet-overflow': 'move the last clauses to the next sheet',
  'off-grid': 'something in a gridded block is sized outside the vocabulary; borders and odd sizes push lines off',
  'shaped-overflow': 'shorten the text of the figure',
  'basics': 'give the page lang and a title, and every picture words for those who cannot see it',
  'print-pages': 'each sheet should print as one page: a sheet overflows on paper, or something outside the sheets prints',
};

const VOCAB = {
  'data-l': ['page', 'canvas', 'columns', 'layer', 'spread', 'sheet', 'margin', 'book', 'stack', 'cluster', 'split', 'switch', 'grid', 'reel', 'cover'],
  'data-bleed': ['up', 'down'],
  'data-pull': [''], 'data-initial': [''],
  'data-float': ['start', 'end'], 'data-w': ['quarter', 'third', 'half'], 'data-wp': ['full'], 'data-shape': ['arch', 'circle', 'alpha'],
  'data-out': ['start', 'end', 'both'],
  'data-place': ['top-start', 'top-center', 'top-end', 'middle-start', 'middle-center', 'middle-end', 'bottom-start', 'bottom-center', 'bottom-end'],
  'data-ratio': ['21/9', '16/9', '3/2', '1/1', '3/4'], 'data-ratiop': ['21/9', '16/9', '3/2', '1/1', '3/4', '2/3', '9/16'],
  'data-size': ['1', '2', '3', '4', '5', '6', '7'], 'data-sizep': ['1', '2', '3', '4', '5', '6', '7'],
  'data-hide': ['portrait', 'landscape', 'wide', 'print'],
  'data-grid': [''], 'data-tag': [''], 'data-balloon': ['start', 'end'],
  'data-col': Array.from({ length: 20 }, (_, i) => String(i + 1)), 'data-row': Array.from({ length: 20 }, (_, i) => String(i + 1)),
  'data-fit': [''], 'data-lines': ['', 'shown'], 'data-hang': [''], 'data-shaped': ['circle', 'diamond'],
  'data-stackp': [''], 'data-across': [''], 'data-reveal': ['fade', 'rise', 'draw'],
  'data-comb': Array.from({ length: 24 }, (_, i) => String(i + 1)),
  'data-numbered': [''], 'data-line': Array.from({ length: 46 }, (_, i) => String(i + 1)),
  'data-space': ['none', 'tight', 'loose'],
  'data-surface': ['raised', 'outline', 'accent'],
  'data-tone': ['quiet', 'strong', 'accent', 'danger', 'ok', 'warn'],
  'data-theme': ['light', 'dark'],
  'data-side': [''], 'data-push': [''], 'data-pad': [''],
};

// runs in the page: what breaks at this width, and the geometry of every element in rem from the canvas edge
function inspect(VOCAB) {
  const issues = [], boxes = [];
  // the core scales the canvas by what rounding the root size left: a rem on screen is that much larger
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) * (parseFloat(getComputedStyle(document.body).scale) || 1);
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
    // the one style allowed names the image whose outline text runs round: --shape: url(…), with data-shape="alpha"
    const st = el.getAttribute('style');
    const shapeOnly = st && /^\s*--shape:\s*url\([^)]+\)\s*;?\s*$/.test(st) && el.getAttribute('data-shape') === 'alpha';
    if ((st && !shapeOnly) || el.hasAttribute('class')) add('vocabulary', el, 'style and class are not used: say it with the vocabulary');
    if (el.matches('[data-shape=alpha]') && getComputedStyle(el).shapeOutside === 'none') add('shape-outline', el, 'the alpha image has no computed outline');
  }

  // a sheet holds what it was given, and every line on it stands on the grid its numbers name
  for (const s of document.querySelectorAll('[data-l=sheet], [data-lines]')) {
    if (s.matches('[data-l=sheet]') && s.scrollHeight > s.clientHeight + 1) add('sheet-overflow', s, `content ${Math.round((s.scrollHeight - s.clientHeight) / rem * 10) / 10} rem taller than the sheet: move text to the next sheet`);
    const top = s.getBoundingClientRect().top + parseFloat(getComputedStyle(s).paddingTop) * (parseFloat(getComputedStyle(s).zoom) || 1) * (parseFloat(getComputedStyle(document.body).scale) || 1);
    const grid = 1.5 * rem * (parseFloat(getComputedStyle(s).zoom) || 1);
    for (const e of s.querySelectorAll('h1, h2, h3, h4, p, li, dt, dd, blockquote')) {
      const off = ((e.getBoundingClientRect().top - top) / grid) % 1;
      if (off > 0.02 && off < 0.98) add('off-grid', e, `starts ${off.toFixed(2)} of a line off the grid of lines: it would not share lines with what stands beside it`);
    }
  }

  // a paragraph set in a figure must fit it
  for (const s of document.querySelectorAll('[data-shaped]')) {
    const p = s.querySelector(':scope > p');
    if (p && getComputedStyle(s).aspectRatio !== 'auto' && p.scrollHeight > s.clientHeight + 1) add('shaped-overflow', s, `the text is ${Math.round((p.scrollHeight - s.clientHeight) / rem)} rem longer than its figure: shorten it`);
  }

  // what every page needs: its language, its title, and words for its pictures
  if (!document.documentElement.lang) add('basics', document.documentElement, '<html> has no lang');
  if (!document.title.trim()) add('basics', document.documentElement, 'no <title>');
  for (const im of document.querySelectorAll('img:not([alt])')) add('basics', im, 'img without alt (alt="" for a picture that only decorates)');
  for (const sv of document.querySelectorAll('svg')) {
    if (sv.closest('[aria-hidden=true]') || sv.matches('svg svg') || sv.querySelector('text')) continue;
    if (!sv.getAttribute('aria-label') && !sv.querySelector('title') && !sv.closest('figure[aria-label], [role=img][aria-label]'))
      add('basics', sv, 'svg without aria-label (or aria-hidden="true" for one that only decorates)');
  }

  const de = document.documentElement;
  if (document.body.scrollWidth > innerWidth + 1) add('page-scroll-x', document.body, `${document.body.scrollWidth} px wide in a ${innerWidth} px window`);

  const body = parseFloat(getComputedStyle(document.body).fontSize);
  const x0 = document.body.getBoundingClientRect().left;
  for (const el of all) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    // what lies inside a block sent out to the window edge belongs partly to the margin, not to the canvas
    if (!el.parentElement?.closest('[data-out]')) boxes.push([path(el), (r.left - x0) / rem, (r.top + scrollY) / rem, r.width / rem, r.height / rem]);
    const p = el.parentElement;
    if (p && p !== document.body && cs.position === 'static' && !scrolls(p) && !el.closest('[data-out], [data-bleed]')) {
      const q = p.getBoundingClientRect();
      if (r.right > q.right + 1.5 || r.left < q.left - 1.5) add('escapes-parent', el, `${Math.round(r.left)}–${Math.round(r.right)} outside ${Math.round(q.left)}–${Math.round(q.right)}`);
    }
    // inside a sheet made smaller as a whole (a phone), size is judged as on a page of a PDF: the reader zooms
    const shrunk = (() => { const s = el.closest('[data-l=sheet]'); return s && parseFloat(getComputedStyle(s).zoom) < 1; })();
    if (ownText(el) && !shrunk) {
      const f = parseFloat(cs.fontSize);
      if (f < 8.5) add('text-too-small', el, `${f.toFixed(1)} px`);
      if (el.matches('p, li, dd, td, blockquote') && !el.matches('[data-pull], [data-balloon]') && el.textContent.trim().length > 40 && r.width < f * 12) add('narrow-measure', el, `${(r.width / f).toFixed(1)} em`);
    }
    if (!shrunk && el.matches('button, input:not([type=hidden]), select, textarea, summary')) {
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

// Test real Tab navigation after the layout inspection (temporary probes are removed).
async function keyboardAudit(pg) {
  const setup = await pg.evaluate(() => {
    if (document.querySelector('iframe, frame')) return { unsupported: 'nested frames need their own keyboard audit' };
    const positive = [...document.querySelectorAll('[tabindex]')]
      .filter(e => Number(e.getAttribute('tabindex')) > 0)
      .map(e => e.localName + (e.id ? '#' + e.id : ''));
    for (const [id, edge] of [['__prastora_tab_start__', 'prepend'], ['__prastora_tab_end__', 'append']]) {
      const b = document.createElement('button');
      b.id = id; b.type = 'button'; b.setAttribute('aria-hidden', 'true');
      b.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body[edge](b);
    }
    document.getElementById('__prastora_tab_start__').focus();
    return { positive, limit: Math.min(512, document.querySelectorAll('*').length + 2) };
  });
  if (setup.unsupported) return { unavailable: setup.unsupported, issues: [] };
  const issues = setup.positive.map(at => ({ rule: 'tab-order', at, detail: 'positive tabindex changes the natural order' }));
  const visited = new Set();
  let finished = false;
  try {
    for (let step = 0; step < setup.limit; step++) {
      await pg.keyboard.press('Tab');
      const focus = await pg.evaluate(() => {
        const e = document.activeElement;
        if (e?.id === '__prastora_tab_end__') return 'end';
        if (!e || e === document.body || e === document.documentElement) return 'outside';
        return [...document.querySelectorAll('*')].indexOf(e);
      });
      if (focus === 'end') { finished = true; break; }
      if (focus === 'outside' || visited.has(focus)) break;
      visited.add(focus);
    }
    if (!finished) issues.push({ rule: 'keyboard-trap', at: 'document', detail: 'Tab cannot reach the end of the document; inspect focus management' });
  } finally {
    await pg.evaluate(() => {
      document.getElementById('__prastora_tab_start__')?.remove();
      document.getElementById('__prastora_tab_end__')?.remove();
    });
  }
  return { issues };
}

// Run an installed axe-core engine on the actual rendered page; do not fetch scripts at audit time.
async function axeAudit(pg) {
  await pg.addScriptTag({ content: axeSource });
  const violations = await pg.evaluate(async () => {
    const result = await window.axe.run(document);
    return result.violations.map(v => ({
      rule: 'axe:' + v.id, detail: v.help + (v.impact ? ' (' + v.impact + ')' : ''),
      helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => ({ at: n.target.join(' -> '), fix: n.failureSummary || v.help }))
    }));
  });
  return violations.flatMap(v => v.nodes.map(n => ({
    rule: v.rule, at: n.at, detail: v.detail, fix: n.fix + ' (' + v.helpUrl + ')'
  })));
}

// Validate the original HTML once, without a remote service or a browser DOM rewrite.
function htmlAudit(page) {
  const run = spawnSync('java', ['-jar', resolve(vnuJar), '--format', 'json', '--stdout',
    '--exit-zero-always', '--skip-info-messages', resolve(page)], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (run.error || run.status !== 0) {
    throw new Error('Nu Html Checker could not run for ' + page + ': ' +
      (run.error?.message || run.stderr?.trim() || 'exit ' + run.status));
  }
  let report;
  try { report = JSON.parse(run.stdout); }
  catch { throw new Error('Nu Html Checker produced invalid JSON for ' + page + ': ' + run.stdout.slice(0, 250)); }
  if (!Array.isArray(report.messages)) throw new Error('Nu Html Checker returned no messages array for ' + page);
  return report.messages.filter(m => m.type === 'error' || m.type === 'non-document-error' || (m.type === 'info' && m.subType === 'warning'))
    .map(m => ({
      rule: 'html:' + (m.type === 'info' ? 'warning' : m.type), at: m.lastLine ? page + ':' + m.lastLine + ':' + (m.firstColumn || 1) : page,
      detail: m.message, fix: 'Correct the HTML at the reported line/column; see https://validator.github.io/validator/'
    }));
}

// A missing CSS outline must not silently turn into a passing layout.
async function openPage(pg, url, note, where) {
  pg.on('requestfailed', request => {
    const error = request.failure()?.errorText ?? 'request failed';
    if (error !== 'net::ERR_ABORTED') note({ rule: 'resource-load', at: request.url(), detail: `${request.resourceType()}: ${error}` }, where);
  });
  pg.on('response', response => {
    if (response.status() >= 400) note({ rule: 'resource-load', at: response.url(), detail: `${response.request().resourceType()}: HTTP ${response.status()}` }, where);
  });
  await pg.goto(url);
}

// Font loading can invalidate SVG geometry; sample after the browser renders that layout.
async function renderedLayout(pg) {
  await pg.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

// CSS shape images use CORS: file URLs are not a same-origin web site, even when the image exists.
// Serve the page and its linked local core from one temporary loopback origin, without changing either.
async function servePages(pages) {
  const files = pages.flatMap(page => {
    const href = stylesheetOf(page);
    return [resolve(page), ...(/^https?:/.test(href) ? [] : [resolve(dirname(page), href)])];
  });
  const inside = (parent, file) => !isAbsolute(relative(parent, file)) && relative(parent, file).split(sep)[0] !== '..';
  // Keep the caller's project paths when its core is on a CDN and images live beside the page directory.
  let root = files.every(file => inside(process.cwd(), file)) ? resolve('.') : dirname(files[0]);
  for (const file of files) while (isAbsolute(relative(root, file)) || relative(root, file).split(sep)[0] === '..') {
    const parent = dirname(root);
    if (parent === root) throw new Error('pages must be on the same filesystem volume');
    root = parent;
  }
  const types = { html: 'text/html; charset=utf-8', css: 'text/css', svg: 'image/svg+xml', js: 'text/javascript', mjs: 'text/javascript', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2' };
  const server = createServer((request, response) => {
    let file;
    try { file = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); }
    catch { response.writeHead(400).end(); return; }
    const rel = relative(root, file);
    if (isAbsolute(rel) || rel.split(sep).some(p => p === '..' || p === '.git')) { response.writeHead(404).end(); return; }
    readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'Content-Type': types[file.split('.').pop()] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : data);
    });
  });
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  return {
    url: page => `http://127.0.0.1:${server.address().port}/` + relative(root, resolve(page)).split(sep).map(encodeURIComponent).join('/'),
    close: () => new Promise(done => server.close(done)),
  };
}

const local = await servePages(pages);
const browser = await chromium.launch().catch(async error => { await local.close(); throw error; });
const reports = [];
try {
  for (const page of pages) {
    const EDGES = await framesOf(page);
    const FRAMES = extended ? EDGES : EDGES.filter(f => f.u === 'portrait' || f.u === 'landscape');
    const url = local.url(page);
    const found = new Map();
    const note = (i, where) => { const k = i.rule + '|' + i.at; if (!found.has(k)) found.set(k, { ...i, where: [] }); found.get(k).where.push(where); };

    if (useHtml) for (const issue of htmlAudit(page)) note(issue, 'source HTML');

    for (const scheme of ['light', 'dark']) {
      for (const { u, lo, hi } of FRAMES) {
        const seen = {};
        // Normal mode samples each distinct composition; extended mode also checks scaling within frames.
        const inner = extended && scheme === 'light' ? [1, 2, 3, 4, 5, 6, 7].map(k => Math.round(lo + (hi - lo) * k / 8)) : [];
        const widths = extended ? [...new Set([lo, ...inner, hi])] : [lo];
        for (const w of widths) {
          const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
          const pg = await ctx.newPage();
          await openPage(pg, url, note, `${u} ${w}px ${scheme}`);
          await renderedLayout(pg);
          const r = await pg.evaluate(inspect, VOCAB);
          seen[w] = r;
          const edge = !extended || w === lo || w === hi;
          if (edge) for (const i of r.issues) if (scheme === 'light' || i.rule !== 'vocabulary') note(i, `${u} ${w}px${scheme === 'dark' ? ' dark' : ''}`);
          if (edge && r.body < 9.5) note({ rule: 'body-text-small', at: 'body', detail: `${r.body.toFixed(1)} px` }, `${u} ${w}px`);
          if (edge && shots && scheme === 'light') await pg.screenshot({ path: `${shots}/${basename(page, '.html')}-${u}-${w}.png`, fullPage: true });
          if (useAxe && w === lo && (u === 'portrait' || u === 'landscape')) {
            for (const issue of await axeAudit(pg)) note(issue, `${u} ${w}px ${scheme} axe`);
          }
          if (w === lo && scheme === 'light' && (u === 'portrait' || u === 'landscape')) {
            const keyboard = await keyboardAudit(pg);
            if (keyboard.unavailable) note({ rule: 'keyboard-unavailable', at: 'document', detail: keyboard.unavailable }, `${u} ${w}px`);
            for (const i of keyboard.issues) note(i, `${u} ${w}px`);
          }
          await ctx.close();
        }
        // the promise: within a frame every element stands at the same place of the canvas, in rem
        if (extended && scheme === 'light') {
          const a = new Map(seen[lo].boxes.map(b => [b[0], b])), moved = new Map();
          for (const w of [...inner, hi]) for (const b of seen[w].boxes) {
            const o = a.get(b[0]);
            if (!o) continue;
            const d = Math.max(...[1, 2, 3, 4].map(i => Math.abs(b[i] - o[i])));
            if (d > 0.5 && !(moved.get(b[0])?.[0] >= d)) moved.set(b[0], [d, w]);
          }
          // the innermost moving element is the cause: a text whose line breaks on the edge, or a size outside the vocabulary
          for (const [at, [d, w]] of [...moved].sort((x, y) => y[0].length - x[0].length).slice(0, 5))
            note({ rule: 'composition-moves', at, detail: `moves ${d.toFixed(2)} rem between ${lo} and ${w} px` }, `${u}`);
        }
      }
    }

    // print, the fourth frame: the layout on an A4 sheet (197.6 mm between the margins, 747 px), then the pages
    const ctx = await browser.newContext({ viewport: { width: 747, height: 1040 }, colorScheme: 'light', reducedMotion: 'reduce' });
    const pg = await ctx.newPage();
    await openPage(pg, url, note, 'print');
    await pg.emulateMedia({ media: 'print' });
    await renderedLayout(pg);
    const r = await pg.evaluate(inspect, VOCAB);
    for (const i of r.issues) if (!['vocabulary', 'target-too-small', 'contrast'].includes(i.rule)) note(i, 'print');
    const pdf = await pg.pdf({ preferCSSPageSize: true, printBackground: true });
    const sheets = await pg.evaluate(() => document.querySelectorAll('[data-l=sheet]').length);
    const printed = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (sheets && printed !== sheets) note({ rule: 'print-pages', at: 'body', detail: `${sheets} sheets print on ${printed} pages` }, 'print');
    if (shots) await pg.screenshot({ path: `${shots}/${basename(page, '.html')}-print.png`, fullPage: true });
    await ctx.close();

    const problems = [...found.values()].map(p => ({ rule: p.rule, at: p.at, detail: p.detail, where: p.where.length > 6 ? [...p.where.slice(0, 6), `+${p.where.length - 6}`] : p.where, fix: p.fix ?? FIX[p.rule] }));
    reports.push({ page, ok: problems.length === 0, frames: FRAMES.map(e => extended ? `${e.u} ${e.lo}–${e.hi}px` : `${e.u} ${e.lo}px`).concat('print A4'), printed_pages: printed, problems });
  }
} finally {
  await browser.close();
  await local.close();
}
console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
process.exit(reports.every(r => r.ok) ? 0 : 1);
