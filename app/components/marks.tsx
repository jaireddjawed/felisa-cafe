/** Botanical line art, drawn at one hairline weight so it reads as an
 *  engraving rather than an illustration. */

export function Sprig({
  className = "",
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 40 64"
      width={size}
      height={size * 1.6}
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
    >
      <path d="M20 62V6" />
      <path d="M20 46c-9 0-13-5-13-11 7 0 13 4 13 11ZM20 46c9 0 13-5 13-11-7 0-13 4-13 11ZM20 30c-8 0-12-5-12-10 7 0 12 3 12 10ZM20 30c8 0 12-5 12-10-7 0-12 3-12 10ZM20 16c-6 0-9-4-9-8 5 0 9 3 9 8ZM20 16c6 0 9-4 9-8-5 0-9 3-9 8Z" />
    </svg>
  );
}

export function Succulent({
  className = "",
  size = 56,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 80 72"
      width={size}
      height={size * 0.9}
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M40 66c-16 0-28-9-28-20 0-7 6-11 13-9-4-8 1-16 9-16-2-9 4-15 12-14-2 8 2 13 8 13-6 4-8 10-6 16 7-3 14 1 14 8 0 12-10 22-22 22Z" />
      <path d="M40 66c-5-8-7-17-5-26M40 66c6-7 9-15 9-24M33 40c-4-5-5-11-3-17M49 40c4-4 6-10 5-15" />
    </svg>
  );
}

export function Grass({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 40"
      preserveAspectRatio="none"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
    >
      <path d="M8 40c2-14 6-22 12-27M20 40c-1-16 2-25 8-31M34 40c3-12 8-19 15-23M48 40c-2-15 1-24 7-30M64 40c2-13 7-21 13-26M78 40c-1-16 2-26 9-32M94 40c3-12 8-20 15-24M108 40c-2-15 2-25 8-31M124 40c2-13 7-21 13-26M138 40c-1-16 3-26 9-32M154 40c3-12 8-20 15-24M168 40c-2-15 1-24 7-30M184 40c2-13 7-21 13-26M198 40c-1-16 2-25 9-31M214 40c3-12 8-20 15-24M228 40c-2-14 1-23 6-29" />
    </svg>
  );
}

export function Cloud({
  className = "",
  size = 64,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 96 48"
      width={size}
      height={size * 0.5}
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 44c-9 0-16-6-16-13s7-13 15-12c2-9 10-15 19-15 11 0 20 8 21 18 8 0 15 5 15 12s-7 10-15 10Z" />
    </svg>
  );
}

export function CatLine({
  className = "",
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 86"
      width={size}
      height={size * 0.86}
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 30 18 6l20 14M78 30 82 6 62 20" />
      <path d="M20 34c0-12 13-20 30-20s30 8 30 20c0 22-12 38-30 38S20 56 20 34Z" />
      <path d="M38 38h.5M62 38h.5" strokeWidth={5} />
      <path d="M50 48v4M50 52c-3 5-9 3-9-1M50 52c3 5 9 3 9-1" />
      <path d="M6 34h20M4 44l22-4M8 54l18-8M94 34H74M96 44 74 40M92 54 74 46" />
    </svg>
  );
}

/** Each drink was photographed somewhere specific — the succulent bed, the
 *  lawn, open sky, petals on asphalt. The motif follows the drink around. */
const MOTIFS: Record<string, "succulent" | "grass" | "sky" | "sprig"> = {
  "mabuhay-mocha": "succulent",
  "turon-milk-tea": "grass",
  "lubi-chai-latte": "sky",
  "felisa-latte": "sprig",
};

export function Motif({
  slug,
  className = "",
}: {
  slug: string;
  className?: string;
}) {
  switch (MOTIFS[slug]) {
    case "succulent":
      return <Succulent className={className} />;
    case "grass":
      return <Grass className={`h-8 w-24 ${className}`} />;
    case "sky":
      return <Cloud className={className} />;
    case "sprig":
      return <Sprig className={`sway ${className}`} size={28} />;
    default:
      return <Sprig className={className} size={24} />;
  }
}

/** The drink as a catalogue plate: flat muted fill, hairline ink outline. */
export function DrinkGlass({
  top,
  bottom,
  className = "",
  ice = true,
}: {
  top: string;
  bottom: string;
  className?: string;
  ice?: boolean;
}) {
  const uid = `${top}${bottom}`.replace(/#/g, "");
  const shape = "M25 24h70l-7 124a13 13 0 0 1-13 12H45a13 13 0 0 1-13-12Z";

  return (
    <svg viewBox="0 0 120 172" aria-hidden className={className}>
      <defs>
        <clipPath id={`gp-${uid}`}>
          <path d={shape} />
        </clipPath>
      </defs>
      <g clipPath={`url(#gp-${uid})`}>
        <rect x="20" y="20" width="80" height="88" fill={top} />
        <rect x="20" y="108" width="80" height="64" fill={bottom} />
        {/* Engraved hatching instead of a gloss highlight. */}
        <g stroke="#fff" strokeWidth="1" opacity="0.35">
          <path d="M32 24v148M37 24v148M42 24v148" />
        </g>
        {ice && (
          <g fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.5">
            <rect x="36" y="32" width="22" height="20" rx="3" />
            <rect x="62" y="40" width="20" height="18" rx="3" />
            <rect x="48" y="58" width="24" height="18" rx="3" />
          </g>
        )}
      </g>
      <path d={shape} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <ellipse
        cx="60"
        cy="24"
        rx="35"
        ry="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
