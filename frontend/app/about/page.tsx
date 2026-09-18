import type { Metadata } from "next";
import Link from "next/link";
import { SHOP } from "@/lib/menu";
import {
  CatFace,
  GirlDoodle,
  Sparkle,
  SquiggleRule,
} from "../components/doodles";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Felisa Cafe is a Filipino-American coffee bar in Fullerton, named after a grandmother and drawn entirely by hand.",
};

const NOTES = [
  {
    title: "Named after a lola",
    body: "Felisa is the grandmother who kept a pot of something sweet on the stove at all times. Every syrup on our bar started in her kitchen.",
  },
  {
    title: "Housemade or not at all",
    body: "Ube, chocolate, caramelized banana, coconut — we cook all four in small batches. Nothing on the menu comes out of a pump bottle we did not fill.",
  },
  {
    title: "Drawn, not designed",
    body: "Every label, sticker, and menu board is hand-lettered with a marker. The cat has been redrawn 40-odd times and still is not consistent.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <header className="relative text-center">
        <Sparkle
          size={30}
          className="twinkle absolute left-4 top-0 text-lav-400"
        />
        <Sparkle
          size={20}
          className="twinkle absolute right-8 top-10 text-lav-500"
        />
        <GirlDoodle size={96} className="mx-auto text-lav-700" />
        <h1 className="mt-4 font-marker text-4xl leading-tight text-lav-800 sm:text-5xl">
          Hi, we are Felisa Cafe
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-hand text-2xl leading-snug text-lav-700">
          A Filipino-American coffee bar living inside {SHOP.host} in Fullerton.
          Purple drinks, housemade syrups, one cat.
        </p>
      </header>

      <SquiggleRule className="my-10 h-5 w-full text-lav-400" />

      <div className="grid gap-6">
        {NOTES.map((note, i) => (
          <article
            key={note.title}
            className={`sticker rounded-3xl bg-lav-100 p-7 ${
              i % 2 === 0 ? "-rotate-1" : "rotate-1"
            }`}
          >
            <h2 className="font-marker text-2xl text-lav-800">{note.title}</h2>
            <p className="mt-3 font-hand text-2xl leading-snug text-lav-700">
              {note.body}
            </p>
          </article>
        ))}
      </div>

      <div className="sticker mt-12 rounded-[2.5rem] bg-lav-600 p-8 text-center text-white">
        <CatFace size={56} className="mx-auto text-lav-200" />
        <p className="mt-4 font-marker text-2xl">
          {SHOP.openingLabel} · {SHOP.openingDate}
        </p>
        <p className="mt-2 font-hand text-2xl text-lav-100">
          {SHOP.street}, {SHOP.city} · {SHOP.openingHours}
        </p>
        <Link
          href="/menu"
          className="mt-6 inline-block rounded-full border-3 border-white px-7 py-3 font-hand text-xl transition hover:bg-white hover:text-lav-700"
        >
          Order ahead →
        </Link>
      </div>
    </div>
  );
}
