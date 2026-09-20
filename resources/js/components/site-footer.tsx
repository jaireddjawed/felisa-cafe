import { Link } from '@inertiajs/react';
import { CatFace, Sparkle, SquiggleRule } from '@/components/doodles';
import { about, menu } from '@/routes';
import type { Shop } from '@/types';

type Props = {
    shop: Shop;
};

export default function SiteFooter({ shop }: Props) {
    return (
        <footer className="bg-lav-800 text-lav-100 relative mt-24 overflow-hidden">
            <SquiggleRule className="text-lav-200 h-6 w-full" />

            <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                    <p className="font-marker text-3xl leading-tight text-white">
                        Felisa Cafe
                    </p>
                    <p className="font-hand text-lav-200 mt-3 max-w-sm text-xl">
                        Purple drinks, housemade syrups, and one very
                        opinionated cat. Pop-up residency inside {shop.host}.
                    </p>
                    <div className="text-lav-300 mt-6 flex items-center gap-3">
                        <CatFace size={46} />
                        <Sparkle size={18} className="twinkle" />
                        <Sparkle size={12} className="twinkle" />
                    </div>
                </div>

                <div>
                    <h2 className="font-marker text-lg text-white">Find us</h2>
                    <address className="font-hand text-lav-200 mt-3 text-xl not-italic">
                        {shop.host}
                        <br />
                        {shop.street}
                        <br />
                        {shop.city}
                    </address>
                </div>

                <div>
                    <h2 className="font-marker text-lg text-white">Hours</h2>
                    <p className="font-hand text-lav-200 mt-3 text-xl">
                        {shop.opening_hours}
                    </p>
                    <nav className="font-hand mt-5 flex flex-col gap-1 text-xl">
                        <Link href={menu()} className="hover:text-white">
                            Full menu
                        </Link>
                        <Link href={about()} className="hover:text-white">
                            Our story
                        </Link>
                        <a
                            href="https://www.instagram.com/felisacafe_/"
                            className="hover:text-white"
                        >
                            {shop.instagram}
                        </a>
                    </nav>
                </div>
            </div>

            <p className="border-lav-600 font-hand text-lav-300 border-t-2 border-dashed px-5 py-5 text-center text-lg">
                Drawn by hand in Fullerton, CA · © {new Date().getFullYear()}{' '}
                Felisa Cafe
            </p>
        </footer>
    );
}
