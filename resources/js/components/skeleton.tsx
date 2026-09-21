import type { HTMLAttributes } from 'react';

/**
 * A pulsing placeholder block for content that is still loading. Purely
 * decorative, so it is hidden from assistive tech; whatever owns the loading
 * state is responsible for announcing it.
 */
export default function Skeleton({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            aria-hidden="true"
            className={`bg-lav-200 animate-pulse rounded-lg ${className}`}
            {...props}
        />
    );
}
