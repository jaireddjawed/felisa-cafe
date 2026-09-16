import Link from "next/link";
import { SHOP } from "@/lib/menu";
import { CatSticker, Heart, Star } from "./marks";

export function SiteFooter() {
  return (
    <footer className="mt-28 border-t-4 border-grape-900 bg-grape-900 text-lilac-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <p className="font-bubble text-4xl text-butter">felisa cafe</p>
          <p className="font-note mt-4 max-w-sm text-2xl leading-snug text-lilac-200">
            purple drinks + housemade syrups + one cat who has opinions about
            everything
          </p>
          <div className="mt-6 flex items-center gap-3">
            <CatSticker size={46} className="text-bubblegum" />
            <Star size={22} className="wiggle text-butter" />
            <Heart size={20} className="text-bubblegum" />
          </div>
        </div>

        <div>
          <p className="font-bubble text-xl text-mint">find us</p>
          <address className="font-note mt-3 text-2xl leading-snug not-italic text-lilac-200">
            {SHOP.host}
            <br />
            {SHOP.street}
            <br />
            {SHOP.city}
          </address>
        </div>

        <div>
          <p className="font-bubble text-xl text-mint">hours</p>
          <p className="font-note mt-3 text-2xl leading-snug text-lilac-200">
            {SHOP.openingDate}
            <br />
            {SHOP.openingHours}
          </p>
          <nav className="font-note mt-4 flex flex-col gap-1 text-2xl">
            <Link href="/menu" className="hover:text-butter">
              menu
            </Link>
            <Link href="/about" className="hover:text-butter">
              our story
            </Link>
            <a href="https://instagram.com/felisacafe" className="hover:text-butter">
              {SHOP.instagram}
            </a>
          </nav>
        </div>
      </div>

      <p className="font-note border-t-2 border-grape-600 px-4 py-5 text-center text-xl text-lilac-300">
        made by hand in fullerton, ca · © {new Date().getFullYear()}
      </p>
    </footer>
  );
}
