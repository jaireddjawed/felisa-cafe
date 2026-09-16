import type { Metadata } from "next";
import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatSticker, Heart, Star } from "../components/marks";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Felisa Cafe is a Filipino-American coffee bar in Fullerton, named after a grandmother and drawn entirely by hand.",
};

const NOTES = [
  {
    title: "named after a lola",
    body: "felisa is the grandmother who kept a pot of something sweet on the stove at all times. every syrup on our bar started in her kitchen.",
    mat: "bg-butter",
  },
  {
    title: "housemade or not at all",
    body: "ube, chocolate, caramelized banana, coconut — we cook all four in small batches. nothing comes out of a pump bottle we did not fill.",
    mat: "bg-mint",
  },
  {
    title: "drawn, not designed",
    body: "every label and menu board is hand-lettered. the cat has been redrawn 40-odd times and still is not consistent, which we decided to keep.",
    mat: "bg-lilac-300",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <header className="relative text-center">
        <Star size={30} className="wiggle absolute top-0 left-6 text-butter" />
        <Heart size={24} className="absolute top-10 right-10 text-bubblegum" />
        <CatSticker size={96} className="wiggle mx-auto text-grape-600" />
        <h1 className="mt-4 font-bubble text-5xl leading-none text-grape-900 sm:text-6xl">
          hi, we are felisa cafe
        </h1>
        <p className="font-note mx-auto mt-4 max-w-xl text-2xl leading-snug text-grape-600">
          a filipino-american coffee bar living inside {SHOP.host} in fullerton.
          purple drinks, housemade syrups, one cat.
        </p>
      </header>

      <div className="mt-14 grid gap-8">
        {NOTES.map((note, i) => (
          <article
            key={note.title}
            className={`pop tape p-7 ${note.mat} ${
              i % 2 === 0 ? "-rotate-1" : "rotate-1"
            }`}
          >
            <h2 className="font-bubble text-3xl text-grape-900">
              {note.title}
            </h2>
            <p className="font-note mt-3 text-2xl leading-snug text-grape-900">
              {note.body}
            </p>
          </article>
        ))}
      </div>

      <div className="pop mt-14 bg-grape-900 px-8 py-10 text-center">
        <Star size={30} className="wiggle mx-auto text-butter" />
        <p className="mt-4 font-bubble text-3xl text-butter">
          {SHOP.openingLabel} · {SHOP.openingDate}
        </p>
        <p className="font-note mt-2 text-2xl text-lilac-200">
          {SHOP.street}, {SHOP.city} · {SHOP.openingHours}
        </p>
        <Link
          href="/menu"
          className="pop pop-press mt-7 inline-block bg-bubblegum px-8 py-4 font-bubble text-2xl text-white"
        >
          order ahead
        </Link>
      </div>
    </div>
  );
}
