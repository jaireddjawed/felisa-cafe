# Template 2 — Soft Minimal

The brand turned down two stops.

**Vibe:** calm, premium, grown-up. Lavender stops being a background and becomes
a tint; the doodles survive as small accents instead of decoration. This is the
direction that looks least like a pop-up and most like a brand that ships
bottles nationwide.

**Type:** Outfit at light weights for display and UI · Caveat for the one
handwritten line per section that keeps it from going cold.

**Colour:** near-white `--color-mist-50` page, lavender tints for surfaces,
plum ink. Blurred colour orbs stand in for a lens blur behind the hero.

**Signature moves**
- `eyebrow` — the small letter-spaced all-caps label above every heading.
- `card-soft` — 1px border, barely-there shadow, lifts 4px on hover.
- Wide whitespace and a strict 6-column max width; nothing is tilted.
- Numbered editorial list on the About page instead of stacked cards.

**Trade-off:** the safest and most legible of the four, and the easiest to
extend to checkout, order tracking, and wholesale pages. It also carries the
least of the Instagram personality — a customer coming from the grid may not
immediately recognise it as the same shop.

**Routes:** `/` · `/menu` · `/menu/[slug]` · `/about`, with a working cart
(localStorage-backed, `lib/cart.tsx`).
