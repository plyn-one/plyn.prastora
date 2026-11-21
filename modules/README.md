# Optional Prastora site modules (draft 0.1)

Work: Plyń Laba #1134. These files are **not a release** until browser tests are run and landed. Load only selected CSS and optional JS files; no unselected module is fetched. Site-owned CSS may follow and override module tokens. All public selectors are prefixed `data-pr-*` or `pr-*`; use a pinned Prastora core for layout and semantic HTML. The module does not own content or a CMS.

| Module | CSS | JS | Data source |
|---|---|---|---|
| Sticky header | `header.css` | optional `header.js` (shrink after scroll) | Site supplies brand and nav links |
| Forms | `forms.css` | none (native validation) | The site backend owns field checks, CSRF, storage and mail |
| News cards | `news.css` | none | The backend owns items, dates, URLs, pagination |
| Languages | `languages.css` | none (native details) | The backend owns language URLs/current page |

Minimal markup:

```html
<header data-pr-header><div class="pr-header__inner">
  <a class="pr-header__brand" href="/">Brand</a>
  <nav class="pr-header__nav" aria-label="Primary"><ul><li><a href="/" aria-current="page">Home</a></li></ul></nav>
</div></header>
<details data-pr-languages><summary>English</summary><ul><li><a href="/en/" aria-current="page">English</a></li><li><a href="/fr/" hreflang="fr">Français</a></li></ul></details>
<div data-pr-news><article class="pr-news__item"><time datetime="2026-11-21">21 November 2026</time><h2><a href="/news">News</a></h2><p>A description.</p></article></div>
<form data-pr-form method="post" action="/your-backend/submit"><div class="pr-form__field"><label for="email">Email</label><input id="email" type="email" name="email" required></div><button>Send</button></form>
```

The form action above is illustrative: Ramonak sites use `/_ramonak/form/<name>` with the configured fields and anti-spam protocol, other backends use their own. Do not duplicate Ramonak's routing, form processing, SEO metadata or translation. Site templates own the markup; these CSS modules only provide conventional accessible presentation. Header remains sticky without JS, and the native language menu works without JS. Header shrink is progressive and respects reduced motion.

Two deliberately different sample site templates: [service](example-service.html) and [editorial](example-editorial.html). They require browser verification; they are not evidence of passed checks.

News cards use a frame-composed `data-l=canvas` container, and each article selects `data-x`, `data-xp` and `data-xw` explicitly. Minimal content is title, date and summary. Image, category, author, reading time or additional actions are optional fields supplied by the site. The CSS module does not choose a CSS auto-fit grid. The service demo contains a test-only keyboard focus guide. Two compositions deliberately use different styling but both use Prastora frame coordinates.

Browser regression source: `node --test modules/modules.test.mjs` with Playwright and Chromium installed. It is not proof of execution until results are recorded.

Required before release: automated regression for the components, two visually distinct sample sites, keyboard/mobile checks and independently verified no-load behavior for unused modules. Video and MapLibre are optional click-to-load modules described in [video.md](video.md) and [map.md](map.md); their browser checks are still pending.
