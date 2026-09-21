import type { ReactNode } from 'react';

type Props = {
    title: string;
    description?: string;
    children: ReactNode;
};

/** One titled card on the settings page. */
export default function SettingsSection({
    title,
    description,
    children,
}: Props) {
    return (
        <section className="sticker rounded-3xl bg-white/90 p-6">
            <div className="border-lav-200 border-b-2 border-dashed pb-4">
                <h2 className="font-marker text-lav-800 text-2xl">{title}</h2>
                {description && (
                    <p className="font-hand text-lav-600 mt-1 text-lg">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </section>
    );
}
