import type { Metadata } from "next";
import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatSign, Star } from "../components/marks";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Felisa Cafe is a Filipino-American coffee bar in Fullerton, open five til midnight and named after a grandmother.",
};

const NOTES = [
  {
    title: "Named after a lola",
    body: "Felisa is the grandmother who kept a pot of something sweet on the stove at all times. Every syrup on our bar started in her kitchen.",
  },
  {
    title: "We open when they close",
    body: "Five in the evening until midnight. It is the shift nobody else wants and the one our regulars keep showing up for — students, closers, people who are not ready to go home.",
  },
  {
    title: "Housemade or not at all",
    body: "Ube, chocolate, caramelized banana, coconut — we cook all four in small batches. Nothing on the menu comes out of a pump bottle we did not fill.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-24">
      <header>
        <p className="overline flex items-center gap-2.5">
          <Star size={10} className="pulse-glow" /> Our story
        </p>
        <h1 className="mt-6 font-display text-5xl leading-[1.02] font-extrabold tracking-tight uppercase">
          <span className="neon flicker">Open late</span>
          <br />
          on purpose
        </h1>
        <p className="mt-7 max-w-xl leading-relaxed text-haze">
          Felisa Cafe lives inside {SHOP.host} in Fullerton and runs from five
          until midnight. Four signature drinks, four syrups, one cat.
        </p>
      </header>

      <div className="mt-20 flex flex-col gap-14">
        {NOTES.map((note, i) => (
          <article
            key={note.title}
            className="grid gap-4 sm:grid-cols-[3.5rem_1fr]"
          >
            <span className="overline pt-1.5">0{i + 1}</span>
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {note.title}
              </h2>
              <p className="mt-3 leading-relaxed text-haze">{note.body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="panel mt-20 grid place-items-center gap-4 px-8 py-14 text-center">
        <CatSign size={52} className="flicker text-glow-400" />
        <p className="overline">{SHOP.openingLabel}</p>
        <p className="font-display text-2xl font-bold tracking-tight">
          {SHOP.openingDate}
        </p>
        <p className="neon-warm font-display text-3xl font-extrabold">
          {SHOP.openingHours}
        </p>
        <p className="text-sm text-haze">
          {SHOP.street}, {SHOP.city}
        </p>
        <Link
          href="/menu"
          className="mt-4 rounded-full border border-glow-400 bg-glow-600/40 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-glow-600/70 hover:shadow-[0_0_34px_-6px_rgba(168,108,245,0.95)]"
        >
          Order ahead
        </Link>
      </div>
    </div>
  );
}
