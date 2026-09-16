# Template 5 — Night Bar

The flyer says 5:00PM–12:00AM. This direction takes that literally.

**Vibe:** late, moody, lit by neon. Near-black violet room, two pools of light
bleeding in from off-screen, and the drinks as the only real light source —
each one throws its own colour onto the wall behind it.

**Type:** Syne extrabold uppercase for display (geometric, slightly strange) ·
Plus Jakarta Sans for body copy.

**Colour:** `--color-night-950` base, `--color-glow-*` lavender for the neon,
and `--color-sign` amber reserved for the one thing that should read as a lit
sign: the hours.

**Signature moves**
- `neon` / `neon-warm` — layered text shadows that make headlines read as tubes
  rather than type, plus a `flicker` keyframe with the stutter real signs have.
- `panel` — frosted glass cards: translucent fill, one bright top edge,
  backdrop blur. They lift and their border ignites on hover.
- Drinks are backlit: a blurred copy of the pour sits behind each glass, and
  light spills onto the bar beneath it.
- The hours block is treated as the hero fact, not fine print.

**Trade-off:** the most atmospheric of the six and the only one that says
"we are open when nobody else is," which is a genuine differentiator worth
owning. But it is dark-only — product photography has to be shot against dark
backgrounds to sit in it, and the glow effects need a contrast audit before
launch. It also fights the lavender daytime feel of the existing grid.

**Routes:** `/` · `/menu` · `/menu/[slug]` · `/about`, with a working cart
(localStorage-backed, `lib/cart.tsx`).
