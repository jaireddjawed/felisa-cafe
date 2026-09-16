import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatLine, Grass, Sprig } from "./marks";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-paper-200 bg-paper-100">
      <Grass className="h-10 w-full text-sage/45" />

      <div className="mx-auto grid max-w-6xl gap-12 px-6 pt-10 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="font-display text-4xl text-plum-800">
            Felisa <span className="italic text-sage">Cafe</span>
          </p>
          <p className="mt-5 max-w-sm leading-relaxed text-quiet">
            Four syrups cooked in small batches, four drinks named after the
            things they taste like, and a cat who supervises none of it.
          </p>
          <div className="mt-7 flex items-end gap-5 text-sage">
            <Sprig size={22} className="sway" />
            <CatLine size={38} className="text-plum-400" />
          </div>
        </div>

        <div>
          <p className="label-fine">Find us</p>
          <address className="rule-fine mt-3 pt-3 leading-relaxed text-quiet not-italic">
            {SHOP.host}
            <br />
            {SHOP.street}
            <br />
            {SHOP.city}
          </address>
        </div>

        <div>
          <p className="label-fine">Hours</p>
          <p className="rule-fine mt-3 pt-3 leading-relaxed text-quiet">
            {SHOP.openingDate}
            <br />
            {SHOP.openingHours}
          </p>
          <nav className="mt-6 flex flex-col gap-2 text-sm">
            <Link href="/menu" className="text-plum-600 hover:text-plum-800">
              Full menu
            </Link>
            <Link href="/about" className="text-plum-600 hover:text-plum-800">
              Our story
            </Link>
            <a
              href="https://instagram.com/felisacafe"
              className="text-plum-600 hover:text-plum-800"
            >
              {SHOP.instagram}
            </a>
          </nav>
        </div>
      </div>

      <p className="label-fine border-t border-paper-200 px-6 py-6 text-center text-quiet">
        © {new Date().getFullYear()} Felisa Cafe · Fullerton, California
      </p>
    </footer>
  );
}
