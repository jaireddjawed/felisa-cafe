"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { CatSign } from "./marks";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "Story" },
];

export function SiteHeader() {
  const { count, open } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-night-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Felisa Cafe home"
        >
          <CatSign size={30} className="flicker text-glow-400" />
          <span className="neon font-display text-xl font-extrabold tracking-tight uppercase">
            Felisa
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-6">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition-colors ${
                  active ? "text-glow-300" : "text-haze hover:text-glow-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={open}
            className="rounded-full border border-glow-500/60 bg-glow-600/25 px-5 py-2 text-sm font-medium text-glow-300 transition-all hover:border-glow-400 hover:bg-glow-600/45 hover:shadow-[0_0_24px_-4px_rgba(168,108,245,0.8)]"
          >
            Cart{count > 0 && <span className="ml-1.5">· {count}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}
