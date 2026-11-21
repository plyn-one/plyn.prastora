# Optional MapLibre map module

Load `map.css` and the optional `map.js` module only on a page with
a map. MapLibre itself, map styles and tiles are not loaded until the
visitor chooses to activate the interactive map.

```html
<section data-pr-map data-pr-map-lat="50.08" data-pr-map-lng="14.42"
         data-pr-map-zoom="12" data-pr-map-js="/assets/maplibre-gl.js"
         data-pr-map-css="/assets/maplibre-gl.css"
         data-pr-map-style="/assets/map-style.json">
  <figure class="pr-map__preview" data-pr-map-preview>
    <img src="/assets/map-preview.webp" alt="Static map showing the location">
  </figure>
  <button type="button" class="pr-map__enable" data-pr-map-enable>
    Load interactive map
  </button>
  <div class="pr-map__canvas" data-pr-map-canvas hidden></div>
  <p class="pr-map__status" data-pr-map-status role="status"></p>
  <a href="https://www.openstreetmap.org/?mlat=50.08&mlon=14.42">
    View address without the map
  </a>
</section>
```

Replace the example coordinates and addresses with verified site data.
The site must pin compatible MapLibre assets and a style with correct
source attribution. The map link works without JavaScript and remains
available when the interactive map fails. No geocoding is performed.

The local preview and address link remain visible when JavaScript is disabled or MapLibre fails; an explicit status reports load errors.

The module itself contains no MapLibre code and has no dependency on
Ramonak. It only loads a site-provided MapLibre bundle after interaction.
