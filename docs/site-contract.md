# Site composition contract v1.0 (target)

**Scope:** Plyń Laba #1119/#1124. This describes the target API, not capabilities already shipped in v0.1.7. Checker implementation is #1129, modules are #1134, Ramonak adapter is #1139, downstream adoption is #1144. This document is the single owner of the shared boundary; implementations must not replicate its definitions.

## Responsibility and dependencies

| Component | Owns | Excludes |
| --- | --- | --- |
| Prastora core | frame/canvas layout, CSS tokens, semantic presentation, browser checking | content, routing, SEO metadata generation, storage, publication and form processing |
| Optional Prastora modules | accessible header/navigation/form UI, maps, video shell, news cards, language chooser | persistent data, translation, backend operations, site branding |
| Optional Ramonak adapter | maps Ramonak's established data/template contracts to the public Prastora markup/modules | new CMS, second SEO authority, site-specific Twig glue, visual styling |
| Individual site | own templates, brand CSS, composition, copy and enabled modules | forks of upstream core or another owner's private code |

A site selects Prastora and optionally Ramonak. **Prastora cannot depend on Ramonak.** Any other backend may render compatible HTML. Dependencies are opt-in; unused maps/video must not download SDKs, scripts or CSS. The site pins immutable release versions; no per-site profiles.

## Contract for agents

The site describes its pinned Prastora version, checker mode (`strict` or future `site`), selected module assets, own CSS, and optional backend. No current parser for this description is implied. Browser execution for a site is not an agent choice: the site's owner frame runs browser checks exclusively via its own Klučnik `browser_test` (Cloudflare Browser Run on that frame's account), using a published HTTPS fixture. Unavailable access is an explicit blocker, not a reason to run local Chromium, another frame's browser or a third-party browser. The current `check.mjs` CLI remains a core development and diagnostic tool; its full browser-based site audit has not yet been ported into the bounded `browser_test` contract.

The output is semantic HTML, with exactly one primary `main` landmark and correct document language/title. Header, footer, navigation and link collections are optional; a one-page site without them is valid. `data-l`, `data-x`, `data-xp` and other documented attributes form Prastora's layout API.

`strict` preserves the existing closed-manifest demo behavior (including no `class`, `style` or site CSS). The proposed `site` mode allows `class`, individual stylesheets, unusual composition and omitted header/footer. It validates Prastora frame attributes and their placement, keyboard access, readable text and targets, resources and technical SEO. Frame-column geometry is guaranteed by the pinned core and verified by core regressions, not remeasured for every site element. Intentional site-level horizontal scrolling is an author choice, not an automatic site-mode failure. `--extended --site` samples frame edges rather than running the core's full coordinate-drift sweep. This mode is implemented on #1129's development branch but remains unreleased until its browser regressions pass.

Each module ships an explicit name/version, semantic markup example, CSS and optional JS entry points, configuration, dependency list, keyboard semantics, non-JS fallback, positive/negative tests and no runtime side effects when not selected. Integration is through standard elements and published data attributes, not private CMS internals.

## Ramonak mapping (optional)

Use existing Ramonak Twig variables `site`, `page`, `seo`, `languages`, `request.query`. Include `@ramonak/head.twig` exactly once within `head`; Ramonak remains the sole authority for title, canonical, description, hreflang/x-default, robots, JSON-LD, sitemap and Open Graph. Site templates own the remaining markup and styling.

The adapter reuses Ramonak's language URLs and current-page flags for navigation; existing `/_ramonak/form/<name>` for submissions, validation and anti-spam; current publication/content functions and `request.query.page` for news and pagination; and its experimental/indexable flags for noindex. It must provide an explicit way to bind form labels/status and current-year footer text without handwritten site-specific glue. It must not invent second form storage, routing, translation or publisher.

Ramonak's existing video rewrite changes YouTube iframes into lazy covers/links. A Prastora video module must coexist without a second player initializer. Third-party scripts load only after explicit opt-in/action.

## Minimal reference usages

**Static site:** `<body><div data-l="page"><main><section data-l="canvas"><h1>Home</h1></section></main></div></body>`; link the pinned core and an optional site CSS after it. Header/footer are absent. Future `site` mode accepts it if rendered checks pass.

**Ramonak site:** Twig `head` includes `@ramonak/head.twig`, then a pinned Prastora core and site's stylesheet; `body` contains `data-l="page"`, an optional navigation built from `languages`, a single `main` block for content, and optional form action `/_ramonak/form/contact`. The site supplies branded CSS and chooses only required modules. Other backends supply equivalent final HTML and metadata.

## Acceptance and versioning

1. Existing strict-mode demos remain valid. Site acceptance's browser evidence must be from the owner-frame Klučnik Browser Run executor; source/CI tests are separate evidence.
2. Two visually distinct sites and a headerless one-page site pass the browser-based `site` checker. Invalid frame coordinates, keyboard traps, missing resources and wrong SEO fail with fixes; intentional author-specified horizontal scrolling is permitted. Core regressions independently verify that the layout grid itself does not drift.
3. Unselected map/video assets produce no network requests.
4. Accessible modules work with keyboard and appropriate script-free fallback.
5. A real Ramonak integration validates one SEO head, languages, a submitted form, news pagination, footer-year rollover and staging noindex.
6. A static site validates the same markup contract without Ramonak. Integration changes require pinned upstream releases and independent tests before Michalevic adoption.

Breaking changes increment the contract major version; compatible added modules/minor adapter fields increment minor; fixes increment patch. Required unsupported capabilities must fail explicitly rather than silently degrade. The tests and features above are acceptance conditions, not claimed results.
