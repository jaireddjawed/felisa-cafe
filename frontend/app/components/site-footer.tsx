import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatFace, Sparkle, SquiggleRule } from "./doodles";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-lav-800 text-lav-100">
      <SquiggleRule className="h-6 w-full text-lav-200" />

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="font-marker text-3xl leading-tight text-white">
            Felisa Cafe
          </p>
          <p className="mt-3 max-w-sm font-hand text-xl text-lav-200">
            Purple drinks, housemade syrups, and one very opinionated cat. Pop-up
            residency inside {SHOP.host}.
          </p>
          <div className="mt-6 flex items-center gap-3 text-lav-300">
            <CatFace size={46} />
            <Sparkle size={18} className="twinkle" />
            <Sparkle size={12} className="twinkle" />
          </div>
        </div>

        <div>
          <h2 className="font-marker text-lg text-white">Find us</h2>
          <address className="mt-3 font-hand text-xl not-italic text-lav-200">
            {SHOP.host}
            <br />
            {SHOP.street}
            <br />
            {SHOP.city}
          </address>
        </div>

        <div>
          <h2 className="font-marker text-lg text-white">Hours</h2>
          <p className="mt-3 font-hand text-xl text-lav-200">
            {SHOP.openingHours}
          </p>
          <nav className="mt-5 flex flex-col gap-1 font-hand text-xl">
            <Link href="/menu" className="hover:text-white">
              Full menu
            </Link>
            <Link href="/about" className="hover:text-white">
              Our story
            </Link>
            <a
              href="https://instagram.com/felisacafe"
              className="hover:text-white"
            >
              {SHOP.instagram}
            </a>
          </nav>
        </div>
      </div>

      <p className="border-t-2 border-dashed border-lav-600 px-5 py-5 text-center font-hand text-lg text-lav-300">
        Drawn by hand in Fullerton, CA · © {new Date().getFullYear()} Felisa Cafe
      </p>
    </footer>
  );
}
