import type { Metadata } from "next";
import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatLine, Grass, Sprig, Succulent } from "../components/marks";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Felisa Cafe is a Filipino-American coffee bar in Fullerton, named after a grandmother and cooked in small batches.",
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
    title: "Photographed outside, always",
    body: "Every drink we post gets carried out to the succulent bed, the lawn, or the parking lot at golden hour. It started as better light and became the whole look.",
  },
];

export default function AboutPage() {
  return (
    <>
      <header className="relative overflow-hidden px-6 pt-24 pb-16 text-center">
        <Succulent size={64} className="absolute top-16 left-[8%] text-sage/40" />
        <Sprig size={26} className="sway absolute top-24 right-[12%] text-sage/50" />

        <p className="label-fine">Our story</p>
        <h1 className="font-display mx-auto mt-5 max-w-3xl text-5xl leading-[1.1] text-plum-800 sm:text-6xl">
          A coffee bar named after
          <br />
          <span className="italic text-sage">a grandmother.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-xl leading-relaxed text-quiet">
          Felisa Cafe lives inside {SHOP.host} in Fullerton. Four signature
          drinks, four syrups, and everything else made by hand.
        </p>
        <Grass className="mt-14 h-10 w-full text-sage/40" />
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-8">
        <div className="flex flex-col gap-14">
          {NOTES.map((note, i) => (
            <article
              key={note.title}
              className="rule-fine grid gap-4 pt-6 sm:grid-cols-[3.5rem_1fr]"
            >
              <span className="label-fine pt-2">0{i + 1}</span>
              <div>
                <h2 className="font-display text-2xl text-plum-800">
                  {note.title}
                </h2>
                <p className="mt-3 leading-relaxed text-quiet">{note.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="pressed mt-20 grid place-items-center gap-3 px-8 py-14 text-center">
          <CatLine size={44} className="text-plum-400" />
          <p className="label-fine mt-2">{SHOP.openingLabel}</p>
          <p className="font-display text-3xl text-plum-800">
            {SHOP.openingDate}
          </p>
          <p className="leading-relaxed text-quiet">
            {SHOP.openingHours}
            <br />
            {SHOP.street}, {SHOP.city}
          </p>
          <Link
            href="/menu"
            className="mt-5 rounded-sm bg-plum-600 px-8 py-3.5 text-sm text-paper-50 transition-colors hover:bg-plum-800"
          >
            Order ahead
          </Link>
        </div>
      </div>
    </>
  );
}
