/** Brand marks. Heavier strokes than the logo, to hold their own next to
 *  poster-weight type. */

export function Star({
  className = "",
  size = 20,
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

export function CatMark({
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
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 30 18 6l20 14M78 30 82 6 62 20" />
      <path d="M20 34c0-12 13-20 30-20s30 8 30 20c0 22-12 38-30 38S20 56 20 34Z" />
      <path d="M38 38h.5M62 38h.5" strokeWidth={10} />
      <path d="M50 48v4M50 52c-3 5-9 3-9-1M50 52c3 5 9 3 9-1" />
      <path d="M6 34h20M4 44l22-4M8 54l18-8M94 34H74M96 44 74 40M92 54 74 46" />
    </svg>
  );
}

/** Iced drink rendered flat and graphic, like a screen print. */
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
  return (
    <svg viewBox="0 0 120 170" aria-hidden className={className}>
      <defs>
        <clipPath id={`ed-${uid}`}>
          <path d="M23 20h74l-8 130a14 14 0 0 1-14 12H45a14 14 0 0 1-14-12Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#ed-${uid})`}>
        <rect x="18" y="16" width="84" height="86" fill={top} />
        <rect x="18" y="102" width="84" height="70" fill={bottom} />
        {ice && (
          <g fill="#fff" opacity="0.35">
            <rect x="34" y="28" width="22" height="20" />
            <rect x="62" y="36" width="20" height="18" />
            <rect x="46" y="56" width="24" height="18" />
          </g>
        )}
        <rect x="26" y="16" width="8" height="156" fill="#fff" opacity="0.3" />
      </g>
      <path
        d="M23 20h74l-8 130a14 14 0 0 1-14 12H45a14 14 0 0 1-14-12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
      <ellipse
        cx="60"
        cy="20"
        rx="37"
        ry="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
      />
    </svg>
  );
}

/** Edge-to-edge scrolling band. The children are rendered twice so the loop
 *  has no visible seam. */
export function Marquee({
  items,
  className = "",
}: {
  items: string[];
  className?: string;
}) {
  const run = [...items, ...items];
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="marquee-track">
        {run.map((item, i) => (
          <span
            key={i}
            className="poster flex shrink-0 items-center gap-6 px-6 text-2xl sm:text-3xl"
          >
            {item}
            <Star size={16} />
          </span>
        ))}
      </div>
    </div>
  );
}
