"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCart } from "@/lib/cart";
import { CatFace, GirlDoodle, Sparkle } from "./doodles";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "Our Story" },
];

export function SiteHeader({ accountSlot }: { accountSlot?: ReactNode }) {
  const { count, open } = useCart();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b-4 border-dashed border-lav-400 bg-lav-100/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link
          href="/"
          className="group flex items-center gap-2"
          aria-label="Felisa Cafe home"
        >
          <GirlDoodle
            size={34}
            className="text-lav-700 transition-transform group-hover:-rotate-6"
          />
          <span className="font-marker text-xl leading-none text-lav-800 sm:text-2xl">
            Felisa
            <span className="ml-1 inline-flex items-center gap-1">
              c
              <CatFace size={22} className="-mx-0.5 text-lav-600" />
              fe
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 font-hand text-lg transition ${
                  active
                    ? "bg-lav-600 text-white"
                    : "text-lav-800 hover:bg-lav-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={open}
            className="sticker relative ml-1 flex items-center gap-2 rounded-full bg-lav-600 px-4 py-1.5 font-hand text-lg text-white transition hover:-rotate-2 hover:bg-lav-700"
          >
            <Sparkle size={14} className="text-lav-200" />
            Cart
            {count > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-1 text-sm font-bold text-lav-700">
                {count}
              </span>
            )}
          </button>

          {accountSlot}
        </nav>
      </div>
    </header>
  );
}
