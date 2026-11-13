// Browser regressions for alpha resources, real keyboard traversal and probe cleanup.
// Run with Playwright/Chromium installed: node --test check.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
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
  } finally {
    if (browser) await browser.close();
    await new Promise(done => server.close(done));
    assert.equal(resolve(dir, '..'), resolve(tmpdir()));
    await rm(dir, { recursive: true, force: true });
  }
});
