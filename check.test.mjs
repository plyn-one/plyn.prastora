// Browser regressions for alpha resources, real keyboard traversal and probe cleanup.
// Run with Playwright/Chromium installed: node --test check.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const execute = promisify(execFile);
const root = fileURLToPath(new URL('.', import.meta.url));

test('resource loading and keyboard traversal compose without leaving probes', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'prastora-shape-'));
  const pageDir = join(dir, 'pages', 'nested');
  await mkdir(join(pageDir, 'art'), { recursive: true });
  await mkdir(join(dir, 'styles'));
  const css = await readFile(join(root, 'core.css'), 'utf8');
  // A small frame keeps the black-box audit bounded; the real stylesheet still lays out the fixture.
  const bounded = css.replace(/frames[^:]*: \[.*\]/, 'frames: [{"name":"landscape","from":50,"to":50.1}]');
  await writeFile(join(dir, 'styles', 'core.css'), bounded);
  await writeFile(join(pageDir, 'art', 'vase shape.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><path fill="blue" d="M30 0h20v40l30 40-20 40H20L0 80l30-40z"/></svg>');
  const page = shape => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Shape regression</title><link rel="stylesheet" href="../../styles/core.css"></head><body><p><img data-float="end" data-w="third" data-shape="alpha" style="--shape: url('${shape}')" src="art/vase%20shape.svg" alt="Blue vase">A picture with text around its silhouette.</p></body></html>`;
  await writeFile(join(pageDir, 'good.html'), page('art/vase%20shape.svg'));
  await writeFile(join(pageDir, 'bad.html'), page('art/missing.svg'));
  await writeFile(join(pageDir, 'absent.html'), page('art/vase%20shape.svg').replace(/ style="[^"]*"/, ''));
  const keyboardPage = extra => page('art/vase%20shape.svg').replace('</body>', extra + '</body>');
  await writeFile(join(pageDir, 'radio.html'), keyboardPage('<fieldset><legend>Choose</legend><label><input type="radio" name="choice" checked>First</label><label><input type="radio" name="choice">Second</label></fieldset><button>Continue</button>'));
  await writeFile(join(pageDir, 'positive.html'), keyboardPage('<button id="positive" tabindex="2">Continue</button>'));
  await writeFile(join(pageDir, 'trap.html'), keyboardPage('<button id="trap">Trapped</button><script>document.addEventListener("keydown",e=>{if(e.key==="Tab"){e.preventDefault();document.getElementById("trap").focus();}})</script>'));
  await writeFile(join(pageDir, 'combo.html'), (await readFile(join(pageDir, 'trap.html'), 'utf8')).replace("--shape: url('art/vase%20shape.svg')", "--shape: url('art/missing.svg')"));
  await writeFile(join(pageDir, 'frame.html'), keyboardPage('<iframe title="Nested" srcdoc="<button>Nested control</button>"></iframe>'));
  // Observe the actual CLI run, including its failure path, without copying the keyboard implementation.
  const observer = join(dir, 'observe.cjs');
  await writeFile(observer, `const fs=require('node:fs');const {chromium}=require(${JSON.stringify(require.resolve('playwright'))});
const records=[];const launch=chromium.launch.bind(chromium);chromium.launch=async(...a)=>{const browser=await launch(...a);const create=browser.newContext.bind(browser);browser.newContext=async(...a)=>{const ctx=await create(...a);
await ctx.addInitScript(()=>{window.probeMutations={added:0,removed:0};new MutationObserver(events=>{for(const e of events)for(const [key,nodes]of [['added',e.addedNodes],['removed',e.removedNodes]])for(const n of nodes)if(n.id==='__prastora_tab_start__'||n.id==='__prastora_tab_end__')window.probeMutations[key]++;}).observe(document,{childList:true,subtree:true});});
const close=ctx.close.bind(ctx);ctx.close=async(...a)=>{for(const p of ctx.pages())records.push(await p.evaluate(()=>({mutations:window.probeMutations,left:document.querySelectorAll('#__prastora_tab_start__,#__prastora_tab_end__').length})));fs.writeFileSync(process.env.PROBE_REPORT,JSON.stringify(records));return close(...a);};return ctx;};return browser;};`);
  await mkdir(join(dir, 'pages', 'shared'));
  await writeFile(join(dir, 'pages', 'shared', 'vase.svg'), await readFile(join(pageDir, 'art', 'vase shape.svg')));
  const missing = [];
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    try {
      const data = await readFile(join(dir, decodeURIComponent(path)));
      response.writeHead(200, { 'Content-Type': path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/html' });
      response.end(data);
    } catch { missing.push(path); response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  await writeFile(join(pageDir, 'remote-core.html'), page('../shared/vase.svg')
    .replace('href="../../styles/core.css"', `href="http://127.0.0.1:${server.address().port}/styles/core.css"`)
    .replace('src="art/vase%20shape.svg"', 'src="../shared/vase.svg"'));
  let browser;
  try {
    browser = await chromium.launch();
    await t.test('a stylesheet in another directory does not rebase an inline URL', async () => {
      const pg = await browser.newPage({ viewport: { width: 800, height: 900 } });
      await pg.goto(`http://127.0.0.1:${server.address().port}/pages/nested/good.html`, { waitUntil: 'networkidle' });
      const image = await pg.locator('img').evaluate(e => ({ src: e.currentSrc, shape: getComputedStyle(e).shapeOutside, loaded: e.complete && e.naturalWidth > 0 }));
      assert.equal(image.shape, `url("${image.src}")`);
      assert.equal(image.loaded, true);
      assert.deepEqual(missing.filter(p => p.endsWith('.svg')), []);
      await pg.close();
    });
    await t.test('the unchanged relative-URL page passes the real rendering check', async () => {
      const { stdout } = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'good.html')], { cwd: root, timeout: 60000 });
      assert.equal(JSON.parse(stdout).ok, true);
    });
    await t.test('site mode permits branded HTML without changing strict checks', async () => {
      await writeFile(join(pageDir, 'brand.css'), 'body { color: #123456; background-color: #ffffff }');
      await writeFile(join(pageDir, 'brand-bad-contrast.css'), 'body { color: #123456 }');
      const branded = page('art/vase%20shape.svg')
        .replace('</head>', '<meta name="description" content="Site checker regression"><link rel="canonical" href="https://example.test/regression"><link rel="stylesheet" href="brand.css"></head>')
        .replace('<body>', '<body class="brand" data-backend="ramonak"><main>')
        .replace('</body>', '</main></body>')
        .replace('<p>', '<p style="color:#123456">');
      await writeFile(join(pageDir, 'branded.html'), branded);
      const strict = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded.html')], { cwd: root, timeout: 60000 }).catch(e => e);
      assert.equal(strict.code, 1);
      assert.ok(JSON.parse(strict.stdout).problems.some(p => p.rule === 'vocabulary'));
      const result = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded.html'), '--site'], { cwd: root, timeout: 60000 }).catch(error => {
        let report;
        try { report = JSON.parse(error.stdout); } catch {}
        throw new Error('site mode returned ' + error.code + ': ' + JSON.stringify(report?.problems ?? error.stdout).slice(0, 2300));
      });
      assert.equal(JSON.parse(result.stdout).ok, true, result.stdout);
      await writeFile(join(pageDir, 'editorial.css'), 'body { color: #342012; background: #fff1da } header { color: #fff1da; background: #342012; padding: 24px }');
      const editorial = branded
        .replace('href="brand.css"', 'href="editorial.css"')
        .replace('<body class="brand" data-backend="ramonak"><main>', '<body class="editorial"><header><h1>Editorial example</h1></header><main>');
      await writeFile(join(pageDir, 'editorial.html'), editorial);
      const second = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'editorial.html'), '--site'], { cwd: root, timeout: 60000 }).catch(e => {
        let report; try { report = JSON.parse(e.stdout); } catch {}
        throw new Error('second site mode failed: ' + JSON.stringify(report?.problems ?? e.stdout).slice(0, 2200));
      });
      assert.equal(JSON.parse(second.stdout).ok, true, 'a differently styled site with header passes site mode');
      const badContrast = branded.replace('href="brand.css"', 'href="brand-bad-contrast.css"');
      await writeFile(join(pageDir, 'branded-bad-contrast.html'), badContrast);
      const contrastCheck = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded-bad-contrast.html'), '--site'], { cwd: root, timeout: 60000 }).catch(e => e);
      assert.equal(contrastCheck.code, 1, 'inadequate contrast in dark mode must fail');
      assert.ok(JSON.parse(contrastCheck.stdout).problems.some(p => p.rule === 'contrast' && p.where.some(w => w.includes('dark'))), 'dark-mode contrast has a repair instruction');
      const invalid = branded.replace('<link rel="canonical" href="https://example.test/regression">', '');
      await writeFile(join(pageDir, 'branded-bad-seo.html'), invalid);
      const badSeo = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded-bad-seo.html'), '--site'], { cwd: root, timeout: 60000 }).catch(e => e);
      assert.equal(badSeo.code, 1);
      assert.ok(JSON.parse(badSeo.stdout).problems.some(p => p.rule === 'site-seo'));
      const missingResource = branded.replace('src="art/vase%20shape.svg"', 'src="art/not-found.svg"');
      await writeFile(join(pageDir, 'branded-missing-resource.html'), missingResource);
      const resourceCheck = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded-missing-resource.html'), '--site'], { cwd: root, timeout: 60000 }).catch(e => e);
      assert.equal(resourceCheck.code, 1);
      assert.ok(JSON.parse(resourceCheck.stdout).problems.some(p => p.rule === 'resource-load' && p.fix));
      const trapped = branded.replace('</main>', '<button id="trap">Focus trap</button><script>document.addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); document.getElementById("trap").focus(); } });</script></main>');
      await writeFile(join(pageDir, 'branded-trap.html'), trapped);
      const trapCheck = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded-trap.html'), '--site'], { cwd: root, timeout: 60000 }).catch(e => e);
      assert.equal(trapCheck.code, 1);
      assert.ok(JSON.parse(trapCheck.stdout).problems.some(p => p.rule === 'keyboard-trap' && p.fix));
      assert.doesNotMatch(branded, /<(?:header|footer)\b/i, 'site mode must permit a headerless page');
      const overflow = branded.replace('<main>', '<main style="min-width:2400px">');
      await writeFile(join(pageDir, 'branded-overflow.html'), overflow);
      const badGeometry = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded-overflow.html'), '--site'], { cwd: root, timeout: 60000 }).catch(e => e);
      const siteOverflow = JSON.parse(badGeometry.stdout);
      assert.equal(badGeometry.code, undefined, 'intentional horizontal scrolling is a site composition choice');
      assert.ok(!siteOverflow.problems.some(p => p.rule === 'page-scroll-x' || p.rule === 'escapes-parent'));
      const extendedSite = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded.html'), '--site', '--extended'], { cwd: root, timeout: 60000 });
      const extendedReport = JSON.parse(extendedSite.stdout);
      assert.equal(extendedReport.ok, true, extendedSite.stdout);
      assert.ok(!extendedReport.problems.some(p => p.rule === 'composition-moves'));
      assert.equal(extendedReport.frames.some(f => f.startsWith('landscape ')), true, 'extended site audit still samples the frame declared by the fixture core');
      // Core mode still detects page-level overflow outside the Prastora canvas.
      const coreOverflow = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'branded-overflow.html')], { cwd: root, timeout: 60000 }).catch(e => e);
      assert.ok(JSON.parse(coreOverflow.stdout).problems.some(p => p.rule === 'page-scroll-x'));
    });
    await t.test('a missing CSS-only outline fails with a repair instruction', async () => {
      let result;
      try { await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'bad.html')], { cwd: root, timeout: 60000 }); }
      catch (error) { result = error; }
      assert.ok(result, 'a missing outline must not exit successfully');
      assert.equal(result.code, 1);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.ok(report.problems.some(p => p.rule === 'resource-load' && p.at.endsWith('/art/missing.svg') && p.detail.includes('404') && p.fix));
    });
    await t.test('an alpha image without its outline declaration cannot pass', async () => {
      let result;
      try { await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'absent.html')], { cwd: root, timeout: 60000 }); }
      catch (error) { result = error; }
      assert.equal(result?.code, 1);
      assert.ok(JSON.parse(result.stdout).problems.some(p => p.rule === 'shape-outline'));
    });
    await t.test('an HTTP URL is checked using its own deployed core', async () => {
      const url = `http://127.0.0.1:${server.address().port}/pages/nested/good.html`;
      const { stdout } = await execute(process.execPath, [join(root, 'check.mjs'), url], { cwd: root, timeout: 60000 });
      const report = JSON.parse(stdout);
      assert.equal(report.page, url);
      assert.equal(report.ok, true, JSON.stringify(report.problems));
    });
    await t.test('a remote core keeps sibling assets under the caller project root', async () => {
      const { stdout } = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'remote-core.html')], { cwd: dir, timeout: 60000 });
      assert.equal(JSON.parse(stdout).ok, true);
    });
    for (const [name, rules] of [['radio', []], ['positive', ['tab-order']], ['trap', ['keyboard-trap']], ['frame', ['keyboard-unavailable']], ['combo', ['keyboard-trap', 'resource-load']]]) {
      await t.test(`keyboard: ${name}, including cleanup`, async () => {
        for (const mode of [[], ['--extended']]) {
          const reportFile = join(dir, name + (mode.length ? '-extended' : '') + '.json');
          let result;
          try { result = await execute(process.execPath, ['--require', observer, join(root, 'check.mjs'), join(pageDir, name + '.html'), ...mode], { cwd: root, timeout: 60000, env: { ...process.env, PROBE_REPORT: reportFile } }); }
          catch (error) { assert.equal(error.code, 1); result = error; }
          const report = JSON.parse(result.stdout);
          if (rules.length) for (const rule of rules) assert.ok(report.problems.some(p => p.rule === rule), JSON.stringify(report));
          else assert.equal(report.ok, true, JSON.stringify(report));
          const cleanup = JSON.parse(await readFile(reportFile, 'utf8'));
          assert.ok(cleanup.every(r => r.left === 0));
          const used = cleanup.filter(r => r.mutations.added > 0);
          assert.equal(used.length, name === 'frame' ? 0 : 1, JSON.stringify({ mode, frames: report.frames, cleanup }));
          assert.ok(used.every(r => r.mutations.added === 2 && r.mutations.removed === 2));
        }
      });
    }
    await t.test('missing optional axe-core is explicit while standard mode still works', async () => {
      const hide = join(dir, 'hide-axe.cjs');
      await writeFile(hide, "const M=require('node:module'),resolve=M._resolveFilename;M._resolveFilename=function(name,...args){if(name==='axe-core'){const e=new Error('axe-core unavailable in dependency test');e.code='MODULE_NOT_FOUND';throw e;}return resolve.call(this,name,...args);};");
      let failure;
      try { await execute(process.execPath, ['--require', hide, join(root, 'check.mjs'), '--axe', join(pageDir, 'good.html')], { cwd: root, timeout: 60000 }); }
      catch (error) { failure = error; }
      assert.equal(failure?.code, 2);
      assert.match(failure.stderr, /needs a local axe-core/);
      const { stdout } = await execute(process.execPath, ['--require', hide, join(root, 'check.mjs'), join(pageDir, 'good.html')], { cwd: root, timeout: 60000 });
      assert.equal(JSON.parse(stdout).ok, true);
    });
    await t.test('axe-core reports an unnamed button with a repair, flags before or after the page', {
      skip: (() => { try { require.resolve('axe-core'); return false; } catch { return 'axe-core not installed'; } })(),
    }, async () => {
      const file = join(pageDir, 'unnamed-button.html');
      await writeFile(file, keyboardPage('<button id="unnamed-button"></button>'));
      for (const args of [[file, '--axe'], ['--axe', file]]) {
        let failure;
        try { await execute(process.execPath, [join(root, 'check.mjs'), ...args], { cwd: root, timeout: 60000 }); }
        catch (error) { failure = error; }
        assert.equal(failure?.code, 1, 'an unnamed control must fail the axe audit');
        const report = JSON.parse(failure.stdout);
        const issue = report.problems.find(p => p.rule === 'axe:button-name' && p.at.includes('unnamed-button'));
        assert.ok(issue, JSON.stringify(report.problems));
        assert.ok(issue.fix && issue.detail, 'a violation should provide a diagnosis and repair');
      }
    });
    await t.test('missing optional VNU_JAR fails explicitly and normal mode still works', async () => {
      const env = { ...process.env }; delete env.VNU_JAR;
      let failure;
      try { await execute(process.execPath, [join(root, 'check.mjs'), '--html', join(pageDir, 'good.html')], { cwd: root, timeout: 60000, env }); }
      catch (error) { failure = error; }
      assert.equal(failure?.code, 2);
      assert.match(failure.stderr, /requires VNU_JAR/);
      const { stdout } = await execute(process.execPath, [join(root, 'check.mjs'), join(pageDir, 'good.html')], { cwd: root, timeout: 60000, env });
      assert.equal(JSON.parse(stdout).ok, true);
    });
    await t.test('real Nu maps errors and warnings with source positions', {
      skip: !process.env.VNU_JAR && 'VNU_JAR not configured',
    }, async () => {
      const file = join(pageDir, 'invalid-markup.html');
      await writeFile(file, keyboardPage('<section><p id="duplicate">First</p><p id="duplicate">Second</p></section>'));
      for (const args of [[file, '--html'], ['--html', file]]) {
        let failure;
        try { await execute(process.execPath, [join(root, 'check.mjs'), ...args], { cwd: root, timeout: 60000 }); }
        catch (error) { failure = error; }
        assert.equal(failure?.code, 1);
        const issues = JSON.parse(failure.stdout).problems;
        assert.ok(issues.some(i => i.rule === 'html:error' && /duplicate id/i.test(i.detail) && /:\d+:\d+$/.test(i.at) && i.fix), JSON.stringify(issues));
        assert.ok(issues.some(i => i.rule === 'html:warning' && /section lacks heading/i.test(i.detail) && /:\d+:\d+$/.test(i.at) && i.fix), JSON.stringify(issues));
      }
      const broken = join(dir, 'invalid.jar'); await writeFile(broken, 'invalid jar');
      let failure;
      try { await execute(process.execPath, [join(root, 'check.mjs'), file, '--html'], { cwd: root, timeout: 60000, env: { ...process.env, VNU_JAR: broken } }); }
      catch (error) { failure = error; }
      assert.notEqual(failure?.code, 0);
      assert.match(failure.stderr, /Nu Html Checker could not run/);
    });
  } finally {
    if (browser) await browser.close();
    await new Promise(done => server.close(done));
    assert.equal(resolve(dir, '..'), resolve(tmpdir()));
    await rm(dir, { recursive: true, force: true });
  }
});

// A minified core holds the rules of its sources: the browser reads core.min.css as core.css, and core-<palette>.min.css
// as core.css followed by its palette, rule for rule. A page laid out with one needs no check against the other.
test('every minified core holds the rules of its sources', async () => {
  const read = name => readFile(join(root, name), 'utf8');
  const core = await read('core.css');
  const pairs = [['core.min.css', core]];
  for (const f of (await readdir(join(root, 'src', 'palette'))).filter(f => f.endsWith('.css')))
    pairs.push([`core-${f.slice(0, -4)}.min.css`, core + '\n' + await read(join('src', 'palette', f))]);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const rules = text => page.evaluate(css => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      // a group (layer, media, supports) by its head and its rules; a style rule by its whole text. A value holding var()
      // is kept by the browser as written, so spaces in it are evened out on both sides
      const text = r => r.cssText.replace(/\s+/g, ' ').replace(/ ?, ?/g, ',');
      const flat = list => [...list].map(r => r instanceof CSSStyleRule || !r.cssRules ? text(r) : [text(r).slice(0, text(r).indexOf('{')), flat(r.cssRules)]);
      return JSON.stringify(flat(sheet.cssRules));
    }, text);
    for (const [min, source] of pairs) {
      const text = await read(min);
      assert.match(text, /^\/\*![\s\S]*?frames[^:]*: \[/, `${min} keeps the first comment, with the frames the check reads`);
      assert.equal(await rules(text), await rules(source), `${min} holds other rules than its sources`);
    }
  } finally {
    await browser.close();
  }
});
