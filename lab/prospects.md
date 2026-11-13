# Prospects of layout as a picture

Notes kept so that the reasons are not lost. They are not instructions for laying out a page; the manifest is.

## Why it may win now

Fluid layout won on the web because of cost, not looks: drawing and keeping a composition for every class of screen was expensive for people, one stretching composition was cheap. With agents the cost turns over.

- An agent makes a composition for phone, laptop and wide screen at almost no cost.
- A fluid page is hard for an agent to verify: its states are endless and a fault shows at a width nobody looked at. A page laid out as a picture is verified completely: one render per frame is the whole truth about every screen of that frame, and the check proves it by rendering widths inside each frame.

So a way that was expensive to make and cheap to verify is now cheap in both. Mainstream tools and AI site builders do not use it: they still produce fluid layouts, because that is what they learned from.

## What it gives that others do not

- Devices of print that the web held impossible: text round a shape, an initial letter, headlines set by hand line by line, a picture leaving the canvas, words laid on a picture at a set place, columns with a pulled quote. All in plain HTML and CSS, without JavaScript.
- Predictability of a mock-up: a canvas of 80 units is an artboard, so a design moves to the page almost one to one.
- Print and PDF from the same page: a print frame lays the composition on an A4 sheet. Reports, contracts and presentations can be one document for screen and paper.
- Verification an agent or a person can trust: three pictures of a page, one per frame, show everything.

## Where it is weaker

- Text of unknown length (content of users, data, translations): exact line breaks are not promised there, only the large blocks hold. Dense applications are better laid out with relations inside the canvas.
- Fonts of different systems: within one device the composition holds, but system fonts differ between macOS, Windows and Android, and lines break differently between them. Pages laid out as pictures need a font of their own.
- The page scales by width; the first screen on very tall or very low windows needs its own attention.

## Found on the way

- Text width is exactly proportional to its size only when the size is a multiple of a quarter of a pixel (spread 0.0018 % against 0.13 % at eighths). The core rounded the page unit down to a quarter of a pixel until 0.1.3; from 0.1.4 it does not, as the steps it made were seen as the page jumping, and a line that nearly fills its column may lose its last word on some screens (the check finds it).
- A size the browser derives from lines (initial-letter) or from optical sizing of a font breaks the proportion; the core avoids both.
- A block reaching the window edge must keep its size on the canvas and let only its picture reach the edge, or what follows it shifts with the margin.

## Fonts measured (Google Fonts, woff2, variable weight 100 to 900, November 2026)

| font | Latin | Cyrillic | Greek | Latin Extended | other scripts |
|---|---|---|---|---|---|
| Noto Sans | 34 KB | 19 KB | 21 KB | 164 KB | the Noto family covers nearly every script in one design |
| Inter | 47 KB | 18 KB | 18 KB | 83 KB | no |
| Source Sans 3 | 28 KB | 18 KB | 14 KB | 58 KB | no |
| Onest | 32 KB | 15 KB | none | 27 KB | no |

Served with unicode-range, a browser loads only the subsets a page uses. Belarusian Latin (ł, ŭ, ź) lies in Latin Extended.

## Next

1. A font of the core's own, self-hosted in subsets, so the picture is the same on every system.
2. A blind test of an agent with the manifest alone on a demanding page.
3. The check rendering the print frame as well.
4. The same principle at the scale of a component: a card as a small picture with frames of its own inside its place on the page.
