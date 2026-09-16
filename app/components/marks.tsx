/** Scrapbook stickers. Thick outlines so they survive next to bubble type. */

export function Star({
  className = "",
  size = 22,
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
        stroke="#3b1e63"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Heart({
  className = "",
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 22"
      width={size}
      height={size}
      aria-hidden
      className={className}
    >
      <path
        d="M12 21C6 16.5 1 12.8 1 7.8 1 4.3 3.8 2 6.8 2 9 2 10.9 3.2 12 5c1.1-1.8 3-3 5.2-3C20.2 2 23 4.3 23 7.8c0 5-5 8.7-11 13.2Z"
        fill="currentColor"
        stroke="#3b1e63"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CatSticker({
  className = "",
  size = 48,
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
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 30 18 6l20 14M78 30 82 6 62 20" />
      <path d="M20 34c0-12 13-20 30-20s30 8 30 20c0 22-12 38-30 38S20 56 20 34Z" />
      <path d="M38 38h.5M62 38h.5" strokeWidth={11} />
      <path d="M50 48v4M50 52c-3 5-9 3-9-1M50 52c3 5 9 3 9-1" />
      <path d="M6 34h20M4 44l22-4M8 54l18-8M94 34H74M96 44 74 40M92 54 74 46" />
    </svg>
  );
}

/** Chunky outlined drink, drawn like a vinyl sticker. */
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
    <svg viewBox="0 0 120 176" aria-hidden className={className}>
      <defs>
        <clipPath id={`y2k-${uid}`}>
          <path d="M24 22h72l-8 128a15 15 0 0 1-15 13H47a15 15 0 0 1-15-13Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#y2k-${uid})`}>
        <rect x="18" y="18" width="84" height="88" fill={top} />
        <rect x="18" y="106" width="84" height="72" fill={bottom} />
        {ice && (
          <g fill="#fff" opacity="0.45">
            <rect x="34" y="30" width="22" height="20" rx="6" />
            <rect x="62" y="38" width="20" height="18" rx="6" />
            <rect x="46" y="56" width="24" height="18" rx="6" />
          </g>
        )}
        <rect x="27" y="18" width="9" height="160" rx="4" fill="#fff" opacity="0.4" />
      </g>
      <path
        d="M24 22h72l-8 128a15 15 0 0 1-15 13H47a15 15 0 0 1-15-13Z"
        fill="none"
        stroke="#3b1e63"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <ellipse
        cx="60"
        cy="22"
        rx="36"
        ry="7.5"
        fill="none"
        stroke="#3b1e63"
        strokeWidth="5"
      />
    </svg>
  );
}
