# YouTube-first video module

This module supplies an optional, privacy-preserving video presentation.
Load `video.css`, and only if click-to-play is wanted, `video.js`
as a module script. It never contacts YouTube before a visitor's click.

```html
<figure data-pr-video>
  <a class="pr-video__link" data-pr-video-link
     href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
     data-pr-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
     aria-label="Watch a video">
    <img src="/assets/video-poster.webp" alt="">
  </a>
  <figcaption>A caption for the video.</figcaption>
</figure>
```

The video ID above is an example. Replace it with the actual video's ID.
The entire optimized poster is the link; no separate text Play button is needed. Serve the image from the site, not a third party. When the backend is Ramonak, its existing `video.cover` job fetches the video's title and cover from YouTube, saves the cover through `media.add`, and provides a local image URL. Reuse this image-processing pipeline rather than adding another downloader to Prastora. The SVG used in the test is only an illustration, not a real YouTube thumbnail.

With no JavaScript, the link opens YouTube. With the optional script,
clicking replaces the link with a youtube-nocookie.com iframe.
An unrecognized embed URL is never loaded or intercepted.

A Ramonak site already has video rewrite and its own enhancement.
Use one handler per player, not both. The backend keeps content ownership.
