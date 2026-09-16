import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatMark } from "./marks";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-mist-200 bg-mist-100">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <CatMark size={36} className="text-plum-500" />
          <p className="mt-5 text-2xl leading-snug font-light text-plum-900">
            Purple drinks, housemade syrups,
            <br />
            and one very opinionated cat.
          </p>
          <p className="font-script mt-4 text-2xl text-plum-500">
            see you at the bar
          </p>
        </div>

        <div>
          <p className="eyebrow">Find us</p>
          <address className="mt-4 text-sm leading-relaxed text-muted not-italic">
            {SHOP.host}
            <br />
            {SHOP.street}
            <br />
            {SHOP.city}
          </address>
        </div>

        <div>
          <p className="eyebrow">Hours</p>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {SHOP.openingDate}
            <br />
            {SHOP.openingHours}
          </p>
          <nav className="mt-6 flex flex-col gap-2 text-sm">
            <Link href="/menu" className="text-plum-700 hover:text-plum-900">
              Full menu
            </Link>
            <Link href="/about" className="text-plum-700 hover:text-plum-900">
              Our story
            </Link>
            <a
              href="https://instagram.com/felisacafe"
              className="text-plum-700 hover:text-plum-900"
            >
              {SHOP.instagram}
            </a>
          </nav>
        </div>
      </div>

      <p className="border-t border-mist-200 px-6 py-6 text-center text-xs tracking-[0.14em] text-muted uppercase">
        © {new Date().getFullYear()} Felisa Cafe · Fullerton, California
      </p>
    </footer>
  );
}
