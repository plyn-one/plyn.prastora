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
      const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg':'image/svg+xml' }[extname(path)] || 'application/octet-stream';
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
    assert.equal(await page.locator('html').getAttribute('data-keyboard-test'), 'on');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'focus-first');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'focus-first');
    assert.match(await page.locator('#focus-feedback').textContent(), /Сейчас выделен/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('html').getAttribute('data-keyboard-test'), null);
    assert.equal(await page.locator('[data-pr-news] .pr-news__item').count(), 3);
    assert.equal(await page.locator('[data-pr-news] time').count(), 3);
    assert.equal(await page.locator('[data-pr-news] .pr-news__image').count(), 2);
    const headlineStyle = await page.locator('[data-pr-news] h3').first().evaluate(el => {
      const css = getComputedStyle(el), body = getComputedStyle(document.body);
      return { ratio: parseFloat(css.fontSize) / parseFloat(body.fontSize), weight: Number(css.fontWeight), underlined: getComputedStyle(el.querySelector('a')).textDecorationLine };
    });
    assert.ok(Math.abs(headlineStyle.ratio - 1.1) < 0.01, 'news title is 10 percent above body text');
    assert.ok(headlineStyle.weight >= 700, 'news title is bold');
    assert.equal(headlineStyle.underlined, 'none');
    const widthBefore = await page.locator('[data-pr-languages]').evaluate(e=>e.getBoundingClientRect().width);
    await page.locator('[data-pr-languages] summary').click();
    assert.equal(await page.locator('[data-pr-languages]').getAttribute('open'), '');
    assert.equal(await page.locator('[data-pr-languages] ul').evaluate(el => getComputedStyle(el).position), 'absolute');
    await page.locator('[data-pr-languages] a[hreflang=fr]').click();
    assert.equal(await page.locator('[data-pr-languages]').getAttribute('open'), null);
    assert.equal(await page.locator('[data-pr-languages] .pr-language__current').textContent(), 'Français');
    await page.locator('#focus-first').focus();
    await page.locator('[data-pr-languages] summary').focus();
    const focusStatus = await page.locator('#focus-feedback').textContent();
    assert.match(focusStatus, /Сейчас выделен: Français\./);
    assert.doesNotMatch(focusStatus, /FrançaisFrançais|EnglishFrançais/);
    const widthAfter = await page.locator('[data-pr-languages]').evaluate(e=>e.getBoundingClientRect().width);
    assert.ok(Math.abs(widthBefore-widthAfter)<0.2,'language control width must stay stable after selection');
    await page.locator('[data-pr-languages] summary').click();
    await page.locator('#news-title').click();
    assert.equal(await page.locator('[data-pr-languages]').getAttribute('open'), null);
    assert.equal(await page.locator('[data-pr-map-preview] img').count(), 1);
    assert.equal(await page.locator('[data-pr-map-enable]').count(), 1);
    assert.equal(await page.locator('[data-pr-map-enable]').evaluate(e=>e.tagName), 'BUTTON');
    assert.equal(await page.locator('[data-pr-map]').getAttribute('data-pr-map-style'), 'map-style.json');
    assert.equal(await page.locator('[data-pr-languages] .pr-language__current').textContent(), 'Français');
    assert.equal(await page.locator('[data-pr-map-enable]').getAttribute('data-pr-map-preview'), '');
    assert.equal(await page.locator('[data-pr-video-link] img').count(), 1);
    for(const width of [900,2100]){
      await page.setViewportSize({width,height:900});
      const hero=await page.locator('.hero').evaluate(el=>{
        const blocks=[...el.children].map(x=>x.getBoundingClientRect());
        return {left:blocks[0].left,right:blocks[0].right,artLeft:blocks[1].left,artTop:blocks[1].top,textTop:blocks[0].top};
      });
      assert.ok(hero.artLeft >= hero.right - 3 && Math.abs(hero.artTop-hero.textTop) < 3,
        'hero illustration must appear alongside text at width '+width);
    }
    await page.setViewportSize({width:390,height:900});
    const mobileHero=await page.locator('.hero').evaluate(el=>{
      const blocks=[...el.children].map(x=>x.getBoundingClientRect());
      return {textBottom:blocks[0].bottom,artTop:blocks[1].top};
    });
    assert.ok(mobileHero.artTop>=mobileHero.textBottom-3,'portrait hero should stack');
    const headerBefore = await page.locator('[data-pr-header]').evaluate(e=>e.getBoundingClientRect().height);
    await page.evaluate(()=>window.scrollTo(0,1500));
    await page.waitForTimeout(250);
    const headerAfter = await page.locator('[data-pr-header]').evaluate(e=>e.getBoundingClientRect().height);
    assert.ok(Math.abs(headerBefore-headerAfter) < 0.1, 'header height must not change when scrolling');

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
    await page.waitForFunction(() => document.querySelector('[data-pr-map-status]')?.textContent.includes('Interactive map unavailable'));
    assert.match(await page.locator('[data-pr-map-status]').textContent(), /Interactive map unavailable/);
    assert.equal(await page.locator('[data-pr-map-preview]').isVisible(), true);
    const previewBox=await page.locator('[data-pr-map-preview]').boundingBox();
    const stageBox=await page.locator('.pr-map__stage').boundingBox();
    assert.ok(Math.abs(previewBox.x-stageBox.x)<1 && Math.abs(previewBox.y-stageBox.y)<1,
      'preview must share the same stage position as the interactive map');
    const canvasBox=await page.locator('[data-pr-map-canvas]').evaluate(el=>{
      const css=getComputedStyle(el);return {position:css.position};
    });
    assert.equal(canvasBox.position,'absolute');
    assert.equal(await page.locator('[data-pr-map] a[href^="https://www.openstreetmap.org/"]').count(), 1);

    // Success path without a live tile provider: a controllable MapLibre stub
    // confirms that activation replaces the poster inside one stable stage.
    await page.unroute('https://unpkg.com/**');
    await page.route('https://unpkg.com/maplibre-gl@5.0.0/dist/maplibre-gl.js', route =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body:
        'window.maplibregl={Map:class{constructor(o){this.container=o.container} once(e,cb){if(e==="load")setTimeout(cb,0)}addControl(){}resize(){}},NavigationControl:class{}};' }));
    await page.route('https://unpkg.com/maplibre-gl@5.0.0/dist/maplibre-gl.css', route =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.goto(origin + '/modules/example-service.html');
    const stageBefore=await page.locator('.pr-map__stage').boundingBox();
    await page.locator('[data-pr-map-preview]').click();
    await page.waitForFunction(() => document.querySelector('[data-pr-map-status]')?.textContent === 'Interactive map loaded.');
    assert.equal(await page.locator('[data-pr-map-preview]').isVisible(), false);
    assert.equal(await page.locator('[data-pr-map-canvas]').isVisible(), true);
    const stageAfter=await page.locator('.pr-map__stage').boundingBox();
    assert.ok(Math.abs(stageBefore.height-stageAfter.height)<0.5 &&
      Math.abs(stageBefore.width-stageAfter.width)<0.5,'loaded map must not enlarge the stage');

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
