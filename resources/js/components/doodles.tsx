import type { CSSProperties } from 'react';

/**
 * Hand-drawn marks used across the site. All stroke-based so they inherit
 * `currentColor` and can sit on any lavender.
 */

type DoodleProps = {
    className?: string;
    size?: number;
};

export function Sparkle({
    className = '',
    size = 24,
    style,
}: DoodleProps & { style?: CSSProperties }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            aria-hidden
            className={className}
            style={style}
        >
            <path
                d="M12 0c.8 6.4 4.8 10.4 12 12-7.2 1.6-11.2 5.6-12 12-.8-6.4-4.8-10.4-12-12C7.2 10.4 11.2 6.4 12 0Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function CatFace({ className = '', size = 64 }: DoodleProps) {
    return (
        <svg
            viewBox="0 0 100 86"
            width={size}
            height={size}
            aria-hidden
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 30 18 6l20 14M78 30 82 6 62 20" />
            <path d="M20 34c0-12 13-20 30-20s30 8 30 20c0 22-12 38-30 38S20 56 20 34Z" />
            <path d="M38 38h.5M62 38h.5" strokeWidth={9} />
            <path d="M50 48v4M50 52c-3 5-9 3-9-1M50 52c3 5 9 3 9-1" />
            <path d="M4 34h22M2 44l24-4M6 54l20-8M96 34H74M98 44 74 40M94 54 74 46" />
        </svg>
    );
}

/** The curly-haired girl from the logo, drawn in one weight of marker. */
export function GirlDoodle({ className = '', size = 72 }: DoodleProps) {
    return (
        <svg
            viewBox="0 0 100 110"
            width={size}
            height={size * 1.1}
            aria-hidden
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M26 24c-8-6-14 2-10 8-8 0-10 10-2 13-6 5-2 14 6 13M74 24c8-6 14 2 10 8 8 0 10 10 2 13 6 5 2 14-6 13" />
            <rect x="26" y="18" width="48" height="72" rx="10" />
            <circle cx="40" cy="44" r="9" />
            <circle cx="62" cy="44" r="9" />
            <path d="M49 44h4" />
            <path d="M40 41.5h.5M62 41.5h.5" strokeWidth={9} />
            <path d="M51 52v8M38 70c5 8 19 8 24 0" />
        </svg>
    );
}

/** A wobbly hand-drawn rule, the kind you get from a marker and no ruler. */
export function SquiggleRule({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 1200 24"
            preserveAspectRatio="none"
            aria-hidden
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth={5}
            strokeLinecap="round"
        >
            <path d="M4 14c50-12 100 10 150 0s100-16 150-4 100 14 150 4 100-16 150-4 100 14 150 4 100-16 150-4 96 12 142 2" />
        </svg>
    );
}

/** An illustrated iced drink: two poured layers behind a glass highlight. */
export function DrinkGlass({
    top,
    bottom,
    className = '',
    ice = true,
    style,
}: {
    /** Gradient stops, top layer to bottom layer, in the drink's real colors. */
    top: string;
    bottom: string;
    className?: string;
    ice?: boolean;
    style?: CSSProperties;
}) {
    const clipId = `glass-${top.slice(1)}${bottom.slice(1)}`;

    return (
        <svg
            viewBox="0 0 120 170"
            aria-hidden
            className={className}
            style={style}
        >
            <defs>
                <clipPath id={clipId}>
                    <path d="M22 20h76l-8 132a14 14 0 0 1-14 12H44a14 14 0 0 1-14-12Z" />
                </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
                <rect x="18" y="16" width="84" height="88" fill={top} />
                <rect x="18" y="96" width="84" height="76" fill={bottom} />
                {/* The blur between poured layers, where the syrup starts to lift. */}
                <rect
                    x="18"
                    y="86"
                    width="84"
                    height="24"
                    fill={top}
                    opacity="0.45"
                    style={{ filter: 'blur(7px)' }}
                />
                {ice && (
                    <g fill="#fff" opacity="0.4">
                        <rect x="32" y="26" width="24" height="22" rx="4" />
                        <rect x="62" y="34" width="22" height="20" rx="4" />
                        <rect x="44" y="52" width="26" height="20" rx="4" />
                    </g>
                )}
                <rect
                    x="24"
                    y="16"
                    width="10"
                    height="156"
                    fill="#fff"
                    opacity="0.35"
                />
            </g>
            <path
                d="M22 20h76l-8 132a14 14 0 0 1-14 12H44a14 14 0 0 1-14-12Z"
                fill="none"
                stroke="#fff"
                strokeWidth="5"
            />
            <ellipse
                cx="60"
                cy="20"
                rx="38"
                ry="8"
                fill="none"
                stroke="#fff"
                strokeWidth="5"
            />
        </svg>
    );
}
