import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    CatFace,
    GirlDoodle,
    Sparkle,
    SquiggleRule,
} from '@/components/doodles';
import { home } from '@/routes';

/**
 * Accounts are optional at Felisa — they exist to give customers their order
 * history — so these screens stay small and keep the storefront's voice.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden px-5 py-12">
            <Sparkle
                size={40}
                className="twinkle text-lav-400 absolute top-16 left-[12%]"
            />
            <Sparkle
                size={24}
                className="twinkle text-lav-500 absolute right-[15%] bottom-24"
            />

            <div className="w-full max-w-md">
                <Link
                    href={home()}
                    className="flex items-center justify-center gap-2"
                >
                    <GirlDoodle size={36} className="text-lav-700" />
                    <span className="font-marker text-lav-800 text-2xl leading-none">
                        Felisa
                        <span className="ml-1 inline-flex items-center gap-1">
                            c
                            <CatFace
                                size={22}
                                className="text-lav-600 -mx-0.5"
                            />
                            fe
                        </span>
                    </span>
                </Link>

                <SquiggleRule className="text-lav-400 mx-auto mt-4 h-4 w-40" />

                <div className="sticker bg-lav-100 mt-6 rounded-[2rem] p-7">
                    {children}
                </div>
            </div>
        </main>
    );
}
