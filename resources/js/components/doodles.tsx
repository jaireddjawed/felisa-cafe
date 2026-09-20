import type { CSSProperties } from 'react';

/**
 * The hand-drawn marks the whole storefront is built from. They are SVG
 * rather than images so they inherit `currentColor` and stay crisp, and so
 * the menu works before anyone runs a photo shoot.
 */

type DoodleProps = {
    size?: number;
    className?: string;
};

export function CatFace({ size = 32, className }: DoodleProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <path d="M14 26c0-9 8-15 18-15s18 6 18 15c0 12-8 20-18 20s-18-8-18-20Z" />
            <path d="M16 24 12 10l11 6M48 24l4-14-11 6" />
            <path d="M25 28h.02M39 28h.02" strokeWidth={5} />
            <path d="M32 34a3 3 0 0 1-3-3M32 34a3 3 0 0 0 3-3" />
            <path
                d="M8 30h10M8 36h10M46 30h10M46 36h10"
                strokeWidth={2}
                opacity={0.7}
            />
        </svg>
    );
}

export function GirlDoodle({ size = 48, className }: DoodleProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <circle cx="32" cy="24" r="13" />
            <path d="M19 22c2-10 10-14 18-11 5 2 8 6 8 11" />
            <path d="M27 24h.02M37 24h.02" strokeWidth={5} />
            <path d="M28 31c2 2 6 2 8 0" />
            <path d="M18 56c1-9 6-14 14-14s13 5 14 14" />
        </svg>
    );
}

export function Sparkle({
    size = 20,
    className,
    style,
}: DoodleProps & { style?: CSSProperties }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
            style={style}
            aria-hidden="true"
        >
            <path d="M12 0c.7 6.3 5 10.6 12 12-7 1.4-11.3 5.7-12 12-.7-6.3-5-10.6-12-12C7 10.6 11.3 6.3 12 0Z" />
        </svg>
    );
}

export function SquiggleRule({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 600 20"
            preserveAspectRatio="none"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            className={className}
            aria-hidden="true"
        >
            <path d="M0 10c25-12 50 12 75 0s50-12 75 0 50 12 75 0 50-12 75 0 50 12 75 0 50-12 75 0 50 12 75 0 50-12 75 0" />
        </svg>
    );
}

type DrinkGlassProps = DoodleProps & {
    /** Gradient stops, top layer to bottom layer, in the drink's real colors. */
    top: string;
    bottom: string;
    ice?: boolean;
    style?: CSSProperties;
};

/**
 * An illustrated glass in a drink's own colors. Each drink gets its pour
 * colors from the database, so the menu is visual without photography.
 */
export function DrinkGlass({
    top,
    bottom,
    ice = false,
    className,
    style,
}: DrinkGlassProps) {
    // Unique per instance so several glasses can render different gradients.
    const gradientId = `pour-${top.replace('#', '')}-${bottom.replace('#', '')}`;

    return (
        <svg
            viewBox="0 0 80 130"
            fill="none"
            className={className}
            style={style}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={top} />
                    <stop offset="100%" stopColor={bottom} />
                </linearGradient>
            </defs>

            {/* Cup */}
            <path
                d="M16 26h48l-5 88a8 8 0 0 1-8 7H29a8 8 0 0 1-8-7L16 26Z"
                fill={`url(#${gradientId})`}
                stroke="#4B2A7B"
                strokeWidth={3}
                strokeLinejoin="round"
            />
            {/* Lid */}
            <rect
                x="10"
                y="16"
                width="60"
                height="12"
                rx="5"
                fill="#fff"
                stroke="#4B2A7B"
                strokeWidth={3}
            />
            {/* Straw */}
            <path
                d="M46 16 54 2"
                stroke="#4B2A7B"
                strokeWidth={5}
                strokeLinecap="round"
            />

            {ice && (
                <g
                    stroke="#fff"
                    strokeWidth={2.5}
                    opacity={0.55}
                    strokeLinejoin="round"
                    fill="none"
                >
                    <rect
                        x="27"
                        y="44"
                        width="14"
                        height="14"
                        rx="3"
                        transform="rotate(-12 34 51)"
                    />
                    <rect
                        x="43"
                        y="62"
                        width="13"
                        height="13"
                        rx="3"
                        transform="rotate(16 49 68)"
                    />
                    <rect
                        x="25"
                        y="76"
                        width="12"
                        height="12"
                        rx="3"
                        transform="rotate(8 31 82)"
                    />
                </g>
            )}

            {/* Highlight, so the glass reads as glass */}
            <path
                d="M25 40c2 24 3 48 4 66"
                stroke="#fff"
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.35}
            />
        </svg>
    );
}
