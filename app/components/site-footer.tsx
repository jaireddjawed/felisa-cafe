import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatMark, Marquee } from "./marks";

export function SiteFooter() {
  return (
    <footer className="mt-32 bg-void text-paper">
      <Marquee
        items={["Ube", "Matcha", "Turon", "Lubi", "Mabuhay"]}
        className="border-y-4 border-neon bg-violet py-3 text-paper"
      />

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="poster text-6xl leading-[0.82] sm:text-7xl">
            Felisa
            <br />
            Cafe
          </p>
          <p className="font-serif mt-6 max-w-sm text-2xl italic text-neon">
            Housemade everything
          </p>
          <CatMark size={48} className="mt-8 text-grape" />
        </div>

        <div>
          <p className="kicker text-neon">Location</p>
          <address className="hairline mt-4 pt-4 text-lg leading-relaxed not-italic">
            {SHOP.host}
            <br />
            {SHOP.street}
            <br />
            {SHOP.city}
          </address>
        </div>

        <div>
          <p className="kicker text-neon">Index</p>
          <nav className="hairline mt-4 flex flex-col gap-2 pt-4 text-lg">
            <Link href="/menu" className="hover:text-neon">
              Menu
            </Link>
            <Link href="/about" className="hover:text-neon">
              Story
            </Link>
            <a href="https://instagram.com/felisacafe" className="hover:text-neon">
              {SHOP.instagram}
            </a>
          </nav>
        </div>
      </div>

      <p className="kicker border-t-2 border-grape px-5 py-6 text-center text-neon">
        © {new Date().getFullYear()} Felisa Cafe · Fullerton CA
      </p>
    </footer>
  );
}
