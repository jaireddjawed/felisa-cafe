import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatSign, Star } from "./marks";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-white/10 bg-night-900/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="neon font-display text-4xl font-extrabold uppercase">
            Felisa Cafe
          </p>
          <p className="mt-5 max-w-sm leading-relaxed text-haze">
            Open from five until midnight. Housemade syrups, espresso or matcha
            in anything, and a cat who has never once been on time.
          </p>
          <div className="mt-7 flex items-center gap-4">
            <CatSign size={44} className="text-glow-500" />
            <Star size={14} className="pulse-glow text-glow-400" />
          </div>
        </div>

        <div>
          <p className="overline">Find us</p>
          <address className="mt-4 leading-relaxed text-haze not-italic">
            {SHOP.host}
            <br />
            {SHOP.street}
            <br />
            {SHOP.city}
          </address>
        </div>

        <div>
          <p className="overline">Hours</p>
          <p className="neon-warm mt-4 font-display text-2xl font-bold">
            {SHOP.openingHours}
          </p>
          <p className="mt-1 text-sm text-haze">{SHOP.openingDate}</p>
          <nav className="mt-6 flex flex-col gap-2 text-sm">
            <Link href="/menu" className="text-glow-300 hover:text-white">
              Full menu
            </Link>
            <Link href="/about" className="text-glow-300 hover:text-white">
              Our story
            </Link>
            <a
              href="https://instagram.com/felisacafe"
              className="text-glow-300 hover:text-white"
            >
              {SHOP.instagram}
            </a>
          </nav>
        </div>
      </div>

      <p className="overline border-t border-white/10 px-5 py-6 text-center text-haze">
        © {new Date().getFullYear()} Felisa Cafe · Fullerton CA
      </p>
    </footer>
  );
}
