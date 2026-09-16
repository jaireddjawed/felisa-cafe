# Template 6 — Garden Press

Every drink photo is shot outdoors. This direction builds the shop around that.

**Vibe:** warm, botanical, small-press. Cream laid paper instead of lavender,
hairline engravings instead of doodles, and arched frames borrowed from a
garden gate. Reads like a seed catalogue that happens to sell coffee.

**Type:** Playfair Display (roman for headings, italic for every subhead) ·
Karla for body and UI.

**Colour:** `--color-paper-*` creams carrying plum as the ink, with `sage`,
`sky`, and `clay` pulled directly out of the photo backgrounds — the succulent
bed, the open sky, the parking-lot gravel.

**Signature moves**
- `arch` — the arched image frame used on every product plate and the hero.
- `Motif` — each drink keeps the setting it was photographed in. Mabuhay Mocha
  gets a succulent, Turon gets grass, Lubi gets a cloud, Felisa gets a sprig.
  The motif follows the drink across every card and page.
- `pressed` — a double-keyline frame, like a pressed flower mounted on card.
- `drop-cap` on product descriptions; hairline rules under every heading.
- Drinks drawn as catalogue plates with engraved hatching, not gloss.

**Trade-off:** the warmest and most distinctive editorial system of the six,
and the only one that gives each drink its own visual identity rather than
treating the four as interchangeable. It is also the furthest from the purple
the account is currently known for — lavender survives only as ink. If the
grid's purple is a real brand asset, this direction spends it.

**Routes:** `/` · `/menu` · `/menu/[slug]` · `/about`, with a working cart
(localStorage-backed, `lib/cart.tsx`).
