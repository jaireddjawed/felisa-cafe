import { Head, Link, usePage } from '@inertiajs/react';
import {
    CatFace,
    GirlDoodle,
    Sparkle,
    SquiggleRule,
} from '@/components/doodles';
import { menu } from '@/routes';
import type { SharedProps } from '@/types';

const NOTES = [
    {
        title: 'Named after a lola',
        body: 'Felisa is the grandmother who kept a pot of something sweet on the stove at all times. Every syrup on our bar started in her kitchen.',
    },
    {
        title: 'Housemade or not at all',
        body: 'Ube, chocolate, caramelized banana, coconut — we cook all four in small batches. Nothing on the menu comes out of a pump bottle we did not fill.',
    },
    {
        title: 'Drawn, not designed',
        body: 'Every label, sticker, and menu board is hand-lettered with a marker. The cat has been redrawn 40-odd times and still is not consistent.',
    },
];

export default function About() {
    const { shop } = usePage<SharedProps>().props;

    return (
        <div className="mx-auto max-w-4xl px-5 py-14">
            <Head title="Our Story" />

            <header className="relative text-center">
                <Sparkle
                    size={30}
                    className="twinkle text-lav-400 absolute top-0 left-4"
                />
                <Sparkle
                    size={20}
                    className="twinkle text-lav-500 absolute top-10 right-8"
                />
                <GirlDoodle size={96} className="text-lav-700 mx-auto" />
                <h1 className="font-marker text-lav-800 mt-4 text-4xl leading-tight sm:text-5xl">
                    Hi, we are Felisa Cafe
                </h1>
                <p className="font-hand text-lav-700 mx-auto mt-4 max-w-xl text-2xl leading-snug">
                    A Filipino-American coffee bar living inside {shop.host} in
                    Fullerton. Purple drinks, housemade syrups, one cat.
                </p>
            </header>

            <SquiggleRule className="text-lav-400 my-10 h-5 w-full" />

            <div className="grid gap-6">
                {NOTES.map((note, index) => (
                    <article
                        key={note.title}
                        className={`sticker bg-lav-100 rounded-3xl p-7 ${
                            index % 2 === 0 ? '-rotate-1' : 'rotate-1'
                        }`}
                    >
                        <h2 className="font-marker text-lav-800 text-2xl">
                            {note.title}
                        </h2>
                        <p className="font-hand text-lav-700 mt-3 text-2xl leading-snug">
                            {note.body}
                        </p>
                    </article>
                ))}
            </div>

            <div className="sticker bg-lav-600 mt-12 rounded-[2.5rem] p-8 text-center text-white">
                <CatFace size={56} className="text-lav-200 mx-auto" />
                <p className="font-marker mt-4 text-2xl">
                    {shop.opening_label} · {shop.opening_date}
                </p>
                <p className="font-hand text-lav-100 mt-2 text-2xl">
                    {shop.street}, {shop.city} · {shop.opening_hours}
                </p>
                <Link
                    href={menu()}
                    className="font-hand hover:text-lav-700 mt-6 inline-block rounded-full border-3 border-white px-7 py-3 text-xl transition hover:bg-white"
                >
                    Order ahead →
                </Link>
            </div>
        </div>
    );
}
