# Template 3 — Bold Editorial

The grand-opening flyer, scaled up to a whole storefront.

**Vibe:** loud, confident, print-first. Poster-weight display type set as large
as the viewport allows, hard 4–8px rules, and full-bleed bands that alternate
deep purple and lavender paper. Reads like a record sleeve or a zine.

**Type:** Archivo Black for headlines (uppercase, -3% tracking, 0.86 leading) ·
Instrument Serif italic for the one-line descriptions · Space Grotesk for UI.

**Colour:** `--color-void` (near-black purple) against `--color-paper`
lavender, with `--color-neon` for the high-visibility accent bands.

**Signature moves**
- `poster` utility — the headline treatment, used everywhere headlines appear.
- Scrolling `Marquee` bands carrying the opening date and address, the way the
  flyer repeats the details.
- The signature menu is set as a numbered index list with prices flush right,
  each row inverting to purple on hover — not a card grid.
- Product art is flat and graphic, like a two-colour screen print.

**Trade-off:** the strongest personality per pixel and the most photogenic, but
it is unforgiving. Long product names, a fifth drink, or a promo banner all
need deliberate re-setting; this is the layout most likely to need a designer
each time the menu changes.

**Routes:** `/` · `/menu` · `/menu/[slug]` · `/about`, with a working cart
(localStorage-backed, `lib/cart.tsx`).
