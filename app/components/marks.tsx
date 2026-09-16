/** Brand marks drawn as neon tube: a thin stroke plus a blurred copy of
 *  itself underneath, which is what makes them read as lit rather than
 *  printed. */

export function Star({
  className = "",
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={className}
    >
      <path
        d="M12 0c.8 6.4 4.8 10.4 12 12-7.2 1.6-11.2 5.6-12 12-.8-6.4-4.8-10.4-12-12C7.2 10.4 11.2 6.4 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CatSign({
  className = "",
  size = 44,
}: {
  className?: string;
  size?: number;
}) {
  const path = (
    <>
      <path d="M22 30 18 6l20 14M78 30 82 6 62 20" />
      <path d="M20 34c0-12 13-20 30-20s30 8 30 20c0 22-12 38-30 38S20 56 20 34Z" />
      <path d="M38 38h.5M62 38h.5" strokeWidth={7} />
      <path d="M50 48v4M50 52c-3 5-9 3-9-1M50 52c3 5 9 3 9-1" />
      <path d="M6 34h20M4 44l22-4M8 54l18-8M94 34H74M96 44 74 40M92 54 74 46" />
    </>
  );

  return (
    <svg
      viewBox="0 0 100 86"
      width={size}
      height={size * 0.86}
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The halo: the same lines, blurred, sitting under the sharp ones. */}
      <g opacity="0.75" style={{ filter: "blur(3.5px)" }}>
        {path}
      </g>
      {path}
    </svg>
  );
}

/** A backlit glass. The pour glows through from behind the bar. */
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
  const shape =
    "M24 22h72l-7 128a13 13 0 0 1-13 12H44a13 13 0 0 1-13-12Z";

  return (
    <svg viewBox="0 0 120 180" aria-hidden className={className}>
      <defs>
        <clipPath id={`nb-${uid}`}>
          <path d={shape} />
        </clipPath>
        <linearGradient id={`nbg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="48%" stopColor={top} />
          <stop offset="64%" stopColor={bottom} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      </defs>

      {/* Light spilling out from under the glass onto the bar. */}
      <ellipse
        cx="60"
        cy="166"
        rx="46"
        ry="12"
        fill={bottom}
        opacity="0.5"
        style={{ filter: "blur(14px)" }}
      />
      <path
        d={shape}
        fill={`url(#nbg-${uid})`}
        opacity="0.55"
        style={{ filter: "blur(13px)" }}
      />

      <g clipPath={`url(#nb-${uid})`}>
        <rect x="20" y="18" width="80" height="158" fill={`url(#nbg-${uid})`} />
        {ice && (
          <g fill="#fff" opacity="0.28">
            <rect x="34" y="30" width="22" height="20" rx="5" />
            <rect x="62" y="38" width="20" height="18" rx="5" />
            <rect x="46" y="56" width="24" height="18" rx="5" />
          </g>
        )}
        <rect x="28" y="18" width="7" height="158" fill="#fff" opacity="0.3" />
        <rect x="88" y="18" width="3" height="158" fill="#fff" opacity="0.18" />
      </g>

      <path
        d={shape}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.4"
      />
      <ellipse
        cx="60"
        cy="22"
        rx="36"
        ry="6.5"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.4"
      />
    </svg>
  );
}
