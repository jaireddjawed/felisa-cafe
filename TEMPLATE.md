# Template 4 — Y2K Scrapbook

As if the whole shop were assembled in a physical scrapbook and photographed.

**Vibe:** kawaii, chunky, nostalgic. Bubble lettering, 3px outlines on
everything, hard offset shadows that collapse when you press a button, washi
tape holding cards to the page, and a dotted notebook grid under it all.

**Type:** Chewy for bubble headlines · Baloo 2 for rounded UI · Schoolbell for
the handwritten marginalia.

**Colour:** lavender notebook paper with deep grape ink, plus a full sticker
palette — bubblegum pink, mint, butter yellow — used as card mats so no two
products sit on the same colour.

**Signature moves**
- `pop` / `pop-press` — the outline + hard shadow, and the tactile press where
  the shadow collapses under the cursor. Every button and card uses it.
- `tape` — a torn washi strip pinned across the top of feature cards.
- `starburst` — a 24-point spiky sale tag holding every price.
- Product cards are tilted polaroids that straighten on hover.

**Trade-off:** the most fun and the most distinct from other coffee sites, and
it makes the four-item menu feel bigger than it is. It is also the loudest at
small sizes — the chunky outlines and rotations need testing on a phone before
committing, and accessibility contrast on the pink and butter chips needs a
check if this direction wins.

**Routes:** `/` · `/menu` · `/menu/[slug]` · `/about`, with a working cart
(localStorage-backed, `lib/cart.tsx`).
