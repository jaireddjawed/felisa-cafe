"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { CatMark } from "./marks";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "Story" },
];

export function SiteHeader() {
  const { count, open } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-4 border-void bg-paper">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
        <Link href="/" className="flex items-center gap-3" aria-label="Felisa Cafe home">
          <CatMark size={30} className="text-violet" />
          <span className="poster text-2xl text-void">Felisa</span>
        </Link>

        <nav className="ml-auto flex items-center gap-5">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`kicker transition-colors ${
                  active ? "text-violet" : "text-void hover:text-violet"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={open}
            className="kicker bg-void px-5 py-2.5 text-paper transition-colors hover:bg-violet"
          >
            Cart [{count}]
          </button>
        </nav>
      </div>
    </header>
  );
}
