# Template 1 — Sticker Doodle

The Instagram grid, translated directly to the web.

**Vibe:** playful, hand-made, maximalist. This is the direction that looks most
like the posts already being published — marker lettering, white cut-out sticker
edges, sparkles that twinkle, cards tilted a degree or two off square.

**Type:** Gloria Hallelujah (marker display) · Patrick Hand (handwritten body) ·
Nunito (small UI text that still needs to be legible).

**Colour:** lavender field (`--color-lav-200`) with deep purple ink, a paper
grain over the whole page so the flat purple does not read as plastic.

**Signature moves**
- `sticker` utility — white 4px edge + purple halo + hard offset shadow.
- Tilted product cards that straighten on hover.
- SVG doodles (`app/components/doodles.tsx`): the cat, the girl from the logo,
  sparkles, and a wobbly hand-drawn rule used as a section divider.
- Illustrated drinks rather than photography — layered gradient glasses in each
  drink's real colours, so the menu works before a photo shoot happens.

**Trade-off:** highest personality, lowest formality. Prices and checkout steps
inherit the handwritten type, which is charming but is the least "trustworthy
storefront" of the four. Worth testing on the checkout screen specifically.

**Routes:** `/` · `/menu` · `/menu/[slug]` · `/about`, with a working cart
(localStorage-backed, `lib/cart.tsx`).
