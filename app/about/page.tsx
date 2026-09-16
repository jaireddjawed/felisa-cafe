import type { Metadata } from "next";
import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatMark, Star } from "../components/marks";

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
    body: "Every label and menu board is hand-lettered. The cat has been redrawn 40-odd times and still is not consistent, which we have decided to keep.",
  },
];

export default function AboutPage() {
  return (
    <>
      <header className="border-b-8 border-void bg-void px-5 py-20 text-paper">
        <div className="mx-auto max-w-7xl">
          <p className="kicker flex items-center gap-3 text-neon">
            <Star size={12} /> Est. 2025 · Fullerton CA
          </p>
          <h1 className="poster mt-6 text-[15vw] leading-[0.82] lg:text-[8.5rem]">
            Named
            <br />
            After A
            <br />
            Lola
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-20">
        <p className="font-serif text-3xl leading-snug italic text-violet">
          Felisa Cafe lives inside {SHOP.host} in Fullerton. Four signature
          drinks, four syrups, and everything else drawn by hand.
        </p>

        <div className="rule-thick mt-14 text-void">
          {NOTES.map((note, i) => (
            <article
              key={note.title}
              className="hairline grid gap-4 py-10 sm:grid-cols-[4rem_1fr]"
            >
              <span className="kicker pt-2 text-violet">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="poster text-3xl sm:text-4xl">{note.title}</h2>
                <p className="mt-4 text-lg leading-relaxed text-grape">
                  {note.body}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 border-4 border-void bg-neon px-8 py-12 text-center text-void">
          <CatMark size={54} className="mx-auto text-void" />
          <p className="kicker mt-6">{SHOP.openingLabel}</p>
          <p className="poster mt-3 text-4xl sm:text-5xl">
            {SHOP.openingDate}
          </p>
          <p className="mt-3 text-lg">
            {SHOP.openingHours} · {SHOP.street}, {SHOP.city}
          </p>
          <Link
            href="/menu"
            className="poster mt-8 inline-block bg-void px-10 py-5 text-lg text-paper transition-colors hover:bg-violet"
          >
            Order ahead
          </Link>
        </div>
      </div>
    </>
  );
}
