import { Link, usePage } from '@inertiajs/react';
import AccountMenu from '@/components/account-menu';
import { CatFace, GirlDoodle, Sparkle } from '@/components/doodles';
import { about, home, menu } from '@/routes';
import type { AuthUser } from '@/types';

const NAV = [
    { href: menu(), label: 'Menu', match: '/menu' },
    { href: about(), label: 'Our Story', match: '/about' },
];

type Props = {
    user: AuthUser | null;
    itemCount: number;
    onOpenCart: () => void;
};

export default function SiteHeader({ user, itemCount, onOpenCart }: Props) {
    const { url } = usePage();

    return (
        <header className="border-lav-400 bg-lav-100/95 sticky top-0 z-40 border-b-4 border-dashed backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
                <Link
                    href={home()}
                    className="group flex items-center gap-2"
                    aria-label="Felisa Cafe home"
                >
                    <GirlDoodle
                        size={34}
                        className="text-lav-700 transition-transform group-hover:-rotate-6"
                    />
                    <span className="font-marker text-lav-800 text-xl leading-none sm:text-2xl">
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

                <nav className="ml-auto flex items-center gap-1 sm:gap-3">
                    {NAV.map((item) => (
                        <Link
                            key={item.match}
                            href={item.href}
                            className={`font-hand rounded-full px-3 py-1.5 text-lg transition ${
                                url.startsWith(item.match)
                                    ? 'bg-lav-600 text-white'
                                    : 'text-lav-800 hover:bg-lav-300'
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}

                    <AccountMenu user={user} />

                    <button
                        type="button"
                        onClick={onOpenCart}
                        className="sticker bg-lav-600 font-hand hover:bg-lav-700 relative ml-1 flex items-center gap-2 rounded-full px-4 py-1.5 text-lg text-white transition hover:-rotate-2"
                    >
                        <Sparkle size={14} className="text-lav-200" />
                        Cart
                        {itemCount > 0 && (
                            <span className="text-lav-700 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1 text-sm font-bold">
                                {itemCount}
                            </span>
                        )}
                    </button>
                </nav>
            </div>
        </header>
    );
}
