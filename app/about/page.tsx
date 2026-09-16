import type { Metadata } from "next";
import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatMark, Sparkle } from "../components/marks";

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
    <div className="mx-auto max-w-3xl px-6 py-24">
      <header>
        <p className="eyebrow flex items-center gap-2">
          <Sparkle size={11} /> Our story
        </p>
        <h1 className="mt-6 text-5xl leading-[1.1] font-light tracking-tight text-plum-900">
          A coffee bar named
          <br />
          after a grandmother.
        </h1>
        <p className="mt-6 max-w-xl leading-relaxed text-muted">
          Felisa Cafe lives inside {SHOP.host} in Fullerton. We serve four
          signature drinks, cook four syrups, and draw everything else ourselves.
        </p>
      </header>

      <div className="mt-20 flex flex-col gap-14">
        {NOTES.map((note, i) => (
          <article key={note.title} className="grid gap-4 sm:grid-cols-[3rem_1fr]">
            <span className="eyebrow pt-1.5">0{i + 1}</span>
            <div>
              <h2 className="text-2xl font-light text-plum-900">{note.title}</h2>
              <p className="mt-3 leading-relaxed text-muted">{note.body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="card-soft mt-20 grid place-items-center gap-4 px-8 py-14 text-center">
        <CatMark size={44} className="text-plum-400" />
        <p className="eyebrow">{SHOP.openingLabel}</p>
        <p className="text-2xl font-light text-plum-900">
          {SHOP.openingDate} · {SHOP.openingHours}
        </p>
        <p className="text-sm text-muted">
          {SHOP.street}, {SHOP.city}
        </p>
        <Link
          href="/menu"
          className="mt-4 rounded-full bg-plum-600 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-plum-700"
        >
          Order ahead
        </Link>
      </div>
    </div>
  );
}
