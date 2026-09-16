"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { CatSticker, Star } from "./marks";

const NAV = [
  { href: "/menu", label: "menu" },
  { href: "/about", label: "story" },
];

export function SiteHeader() {
  const { count, open } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-4 border-grape-900 bg-lilac-100">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="Felisa Cafe home">
          <CatSticker size={34} className="wiggle text-grape-600" />
          <span className="font-bubble text-2xl text-grape-900">
            felisa cafe
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-2 sm:gap-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`pop-sm pop-press px-4 py-1.5 font-bubble text-lg ${
                  active
                    ? "bg-bubblegum text-white"
                    : "bg-white text-grape-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={open}
            className="pop-sm pop-press flex items-center gap-2 bg-mint px-4 py-1.5 font-bubble text-lg text-grape-900"
          >
            <Star size={13} className="text-butter" />
            cart
            {count > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-grape-900 bg-white px-1 text-sm">
                {count}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
