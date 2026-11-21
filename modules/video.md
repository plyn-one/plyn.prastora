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
    <span class="pr-video__play">Play video</span>
  </a>
  <figcaption>A caption for the video.</figcaption>
</figure>
```

The video ID above is an example. Replace it with the actual video's ID.
The poster must be served by the site itself, not a third party.

With no JavaScript, the link opens YouTube. With the optional script,
clicking replaces the link with a youtube-nocookie.com iframe.
An unrecognized embed URL is never loaded or intercepted.

A Ramonak site already has video rewrite and its own enhancement.
Use one handler per player, not both. The backend keeps content ownership.
