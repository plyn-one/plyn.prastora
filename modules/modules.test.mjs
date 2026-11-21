// Browser regressions for independent optional site modules.
// Run from the repository with Playwright/Chromium installed: node --test modules/modules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));

test('site module selection, native fallback and on-demand third-party resources', async () => {
  const server = createServer(async (request, response) => {
    let path;
    try { path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); }
    catch { response.writeHead(400).end(); return; }
    const rel = relative(root, path);
    if (isAbsolute(rel) || rel.split(sep).includes('..') || rel.split(sep).includes('.git')) {
      response.writeHead(404).end(); return;
    }
    try {
      const data = await readFile(path);
      const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[extname(path)] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type }).end(data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    const remote = [];
    page.on('request', req => { if (!req.url().startsWith(origin + '/')) remote.push(req.url()); });

    await page.goto(origin + '/modules/example-service.html');
    await page.waitForLoadState('networkidle');
    assert.deepEqual(remote, [], 'an idle service page must load no third-party assets');
    assert.equal(await page.locator('[data-pr-header]').count(), 1);
    assert.equal(await page.locator('[data-pr-header]').evaluate(el => getComputedStyle(el).position), 'sticky');
    await page.locator('#focus-start').click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'focus-first');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'focus-first');
    assert.match(await page.locator('#focus-feedback').textContent(), /Сейчас выделен/);
    assert.equal(await page.locator('[data-pr-news] .pr-news__item').count(), 3);
    assert.equal(await page.locator('[data-pr-news] time').count(), 3);
    assert.equal(await page.locator('[data-pr-news] .pr-news__image').count(), 2);
    await page.locator('[data-pr-languages] summary').click();
    assert.equal(await page.locator('[data-pr-languages]').getAttribute('open'), '');

    await page.goto(origin + '/modules/example-editorial.html');
    await page.waitForLoadState('networkidle');
    assert.deepEqual(remote, [], 'a news-only site must not load video/map assets');
    assert.equal(await page.locator('script').count(), 0);
    assert.equal(await page.locator('[data-pr-news] .pr-news__item').count(), 3);
    for (const width of [320, 390, 768, 900, 1280, 2100, 2700]) {
      await page.setViewportSize({ width, height: 900 });
      const dims = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      assert.ok(dims.scroll <= dims.width + 1, 'horizontal overflow at ' + width + ': ' + JSON.stringify(dims));
    }

    // Within each Prastora frame, normalized locations and widths must not drift.
    const geometry = async width => {
      await page.setViewportSize({ width, height: 900 });
      return page.evaluate(() => {
        const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const scale = parseFloat(getComputedStyle(document.body).scale) || 1;
        const rem = root * scale, left = document.body.getBoundingClientRect().left;
        return [...document.querySelectorAll('[data-x]')].map(el => {
          const rect = el.getBoundingClientRect();
          return { x: (rect.left - left) / rem, width: rect.width / rem };
        });
      });
    };
    for (const [small, large] of [[320, 600], [900, 1500], [2100, 2700]]) {
      const first = await geometry(small), last = await geometry(large);
      assert.equal(first.length, last.length);
      for (let i = 0; i < first.length; i++) {
        assert.ok(Math.abs(first[i].x - last[i].x) < 0.6
          && Math.abs(first[i].width - last[i].width) < 0.6,
          'frame composition drift for canvas child ' + i + ': ' + small + '/' + large);
      }
    }

    await page.goto(origin + '/modules/example-service.html');
    await page.route('https://unpkg.com/**', route => route.abort());
    const mapRequest = page.waitForEvent('request', req => req.url().includes('unpkg.com/maplibre-gl@5.0.0'));
    await page.locator('[data-pr-map-enable]').click();
    assert.match((await mapRequest).url(), /maplibre-gl/);
    await page.waitForFunction(() => document.querySelector('[data-pr-map-status]')?.textContent.includes('Map unavailable.'));
    assert.match(await page.locator('[data-pr-map-status]').textContent(), /Map unavailable/);
    assert.equal(await page.locator('[data-pr-map] a[href^="https://www.openstreetmap.org/"]').count(), 1);

    await page.goto(origin + '/modules/example-service.html');
    await page.route('https://www.youtube-nocookie.com/**', route => route.abort());
    const videoRequest = page.waitForEvent('request', req => req.url().startsWith('https://www.youtube-nocookie.com/embed/'));
    await page.locator('[data-pr-video-link]').click();
    assert.match((await videoRequest).url(), /\/embed\//);

    const noScript = await browser.newContext({ javaScriptEnabled: false });
    const fallback = await noScript.newPage();
    await fallback.goto(origin + '/modules/example-service.html');
    assert.equal(await fallback.locator('[data-pr-video-link][href^="https://www.youtube.com/watch"]').count(), 1);
    assert.equal(await fallback.locator('[data-pr-map] a[href^="https://www.openstreetmap.org/"]').count(), 1);
    await fallback.locator('[data-pr-languages] summary').click();
    assert.equal(await fallback.locator('[data-pr-languages]').getAttribute('open'), '');
    await noScript.close();
    await page.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(ok => server.close(ok));
  }
});
