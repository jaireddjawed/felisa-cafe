import { Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { CatFace } from '@/components/doodles';
import { login, logout, orders } from '@/routes';
import type { AuthUser } from '@/types';

type Props = {
    user: AuthUser | null;
};

export default function AccountMenu({ user }: Props) {
    const [open, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onPointerDown = (event: MouseEvent) => {
            if (
                container.current &&
                !container.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    if (!user) {
        return (
            <Link
                href={login()}
                className="font-hand text-lav-800 hover:bg-lav-300 rounded-full px-3 py-1.5 text-lg"
            >
                Log in
            </Link>
        );
    }

    const displayName = user.name || user.email.split('@')[0] || 'friend';

    return (
        <div className="relative inline-block text-left" ref={container}>
            <button
                type="button"
                onClick={() => setOpen((previous) => !previous)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="font-hand text-lav-800 hover:bg-lav-300 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-lg transition"
            >
                <span className="hidden sm:inline">Hi, {displayName}</span>
                <span className="sm:hidden">Account</span>
                <span
                    aria-hidden="true"
                    className={`transition-transform ${open ? 'rotate-180' : ''}`}
                >
                    ▾
                </span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="border-lav-400 bg-lav-50 absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border-2 p-2 shadow-xl"
                >
                    <div className="px-3 py-2">
                        <div className="flex items-center gap-2">
                            <CatFace size={22} className="text-lav-600" />
                            <p className="font-marker text-lav-900 truncate text-base">
                                {displayName}
                            </p>
                        </div>
                        <p className="font-hand text-lav-600 mt-0.5 truncate text-sm">
                            {user.email}
                        </p>
                    </div>

                    <div className="border-lav-300 my-1 border-t-2 border-dashed" />

                    <Link
                        href={orders()}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="font-hand text-lav-800 hover:bg-lav-200/80 block rounded-xl px-3 py-2 text-lg transition"
                    >
                        Order history
                    </Link>

                    <div className="border-lav-300 my-1 border-t-2 border-dashed" />

                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            setOpen(false);
                            router.post(logout().url);
                        }}
                        className="font-hand text-lav-700 hover:bg-lav-200/80 w-full rounded-xl px-3 py-2 text-left text-lg transition"
                    >
                        Log out
                    </button>
                </div>
            )}
        </div>
    );
}
