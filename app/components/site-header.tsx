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
    <header className="sticky top-0 z-40 border-b border-mist-200 bg-mist-50/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Felisa Cafe home">
          <CatMark size={28} className="text-plum-600" />
          <span className="text-[15px] font-medium tracking-[0.22em] text-plum-900 uppercase">
            Felisa
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
                    ? "text-plum-700"
                    : "text-muted hover:text-plum-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={open}
            className="rounded-full bg-plum-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-plum-700"
          >
            Cart{count > 0 && <span className="ml-1.5 opacity-80">{count}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
