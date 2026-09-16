"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { CatLine } from "./marks";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "Story" },
];

export function SiteHeader() {
  const { count, open } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-paper-200 bg-paper-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Felisa Cafe home"
        >
          <CatLine size={28} className="text-plum-600" />
          <span className="font-display text-xl tracking-tight text-plum-800">
            Felisa <span className="italic text-sage">Cafe</span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-7">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition-colors ${
                  active
                    ? "text-plum-600"
                    : "text-quiet hover:text-plum-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={open}
            className="rounded-sm border border-plum-500 px-5 py-2 text-sm text-plum-600 transition-colors hover:bg-plum-600 hover:text-paper-50"
          >
            Cart{count > 0 && <span className="ml-1.5">({count})</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
