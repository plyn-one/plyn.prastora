// Browser regressions for document-relative alpha outlines and the audit's resource failures.
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

const { chromium } = createRequire(import.meta.url)('playwright');
const execute = promisify(execFile);
const root = fileURLToPath(new URL('.', import.meta.url));

test('alpha URLs keep the document base and missing resources cannot pass', async t => {
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
  } finally {
    if (browser) await browser.close();
    await new Promise(done => server.close(done));
    assert.equal(resolve(dir, '..'), resolve(tmpdir()));
    await rm(dir, { recursive: true, force: true });
  }
});
