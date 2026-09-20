import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import AccountMenu from '@/components/account-menu';
import { CatFace, GirlDoodle, Sparkle } from '@/components/doodles';
import { about, home, login, logout, menu, orders } from '@/routes';
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileMenu = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mobileMenuOpen) {
            return;
        }

        const onPointerDown = (event: MouseEvent) => {
            if (
                mobileMenu.current &&
                !mobileMenu.current.contains(event.target as Node)
            ) {
                setMobileMenuOpen(false);
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMobileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [mobileMenuOpen]);

    const closeMobileMenu = () => setMobileMenuOpen(false);
    const displayName = user?.name || user?.email.split('@')[0] || 'friend';

    return (
        <header className="border-lav-400 bg-lav-100/95 sticky top-0 z-40 overflow-x-clip border-b-4 border-dashed backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-5">
                <Link
                    href={home()}
                    className="group flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none sm:gap-2"
                    aria-label="Felisa Cafe home"
                >
                    <GirlDoodle
                        size={30}
                        className="text-lav-700 shrink-0 transition-transform group-hover:-rotate-6 sm:size-[34px]"
                    />
                    <span className="font-marker text-lav-800 truncate text-lg leading-none whitespace-nowrap min-[430px]:text-xl sm:text-2xl">
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

                <nav className="ml-auto hidden items-center gap-3 sm:flex">
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
                </nav>

                <button
                    type="button"
                    onClick={onOpenCart}
                    className="sticker bg-lav-600 font-hand hover:bg-lav-700 relative ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-lg text-white transition hover:-rotate-2 sm:ml-1 sm:gap-2 sm:px-4"
                >
                    <Sparkle size={14} className="text-lav-200" />
                    <span className="hidden min-[430px]:inline sm:inline">
                        Cart
                    </span>
                    {itemCount > 0 && (
                        <span className="text-lav-700 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1 text-sm font-bold">
                            {itemCount}
                        </span>
                    )}
                </button>

                <div className="relative shrink-0 sm:hidden" ref={mobileMenu}>
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen((open) => !open)}
                        aria-label="Open navigation"
                        aria-expanded={mobileMenuOpen}
                        className="border-lav-400 text-lav-800 hover:bg-lav-200 grid size-10 place-items-center rounded-full border-2 bg-white transition"
                    >
                        <span aria-hidden="true" className="grid gap-1.5">
                            <span className="bg-lav-700 block h-0.5 w-5 rounded-full" />
                            <span className="bg-lav-700 block h-0.5 w-5 rounded-full" />
                            <span className="bg-lav-700 block h-0.5 w-5 rounded-full" />
                        </span>
                    </button>

                    {mobileMenuOpen && (
                        <div className="border-lav-400 bg-lav-50 absolute top-full right-0 z-50 mt-3 w-60 rounded-2xl border-2 p-2 shadow-xl">
                            {NAV.map((item) => (
                                <Link
                                    key={item.match}
                                    href={item.href}
                                    onClick={closeMobileMenu}
                                    className={`font-hand block rounded-xl px-3 py-2 text-lg transition ${
                                        url.startsWith(item.match)
                                            ? 'bg-lav-600 text-white'
                                            : 'text-lav-800 hover:bg-lav-200/80'
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            ))}

                            <div className="border-lav-300 my-1 border-t-2 border-dashed" />

                            {user ? (
                                <>
                                    <p className="font-marker text-lav-900 truncate px-3 py-2 text-base">
                                        Hi, {displayName}
                                    </p>
                                    <Link
                                        href={orders()}
                                        onClick={closeMobileMenu}
                                        className="font-hand text-lav-800 hover:bg-lav-200/80 block rounded-xl px-3 py-2 text-lg transition"
                                    >
                                        Order history
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeMobileMenu();
                                            router.post(logout().url);
                                        }}
                                        className="font-hand text-lav-700 hover:bg-lav-200/80 w-full rounded-xl px-3 py-2 text-left text-lg transition"
                                    >
                                        Log out
                                    </button>
                                </>
                            ) : (
                                <Link
                                    href={login()}
                                    onClick={closeMobileMenu}
                                    className="font-hand text-lav-800 hover:bg-lav-200/80 block rounded-xl px-3 py-2 text-lg transition"
                                >
                                    Log in
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
