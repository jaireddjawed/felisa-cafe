"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CatFace, Sparkle } from "./doodles";

type UserProps = {
  name?: string;
  email: string;
};

export function AccountDropdown({
  user,
  logoutAction,
}: {
  user: UserProps;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = user.name || user.email.split("@")[0] || "Friend";

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-hand text-lg text-lav-800 transition hover:bg-lav-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lav-500"
      >
        <span className="hidden sm:inline">Hi, {displayName}</span>
        <span className="sm:hidden">Account</span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 text-lav-600 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border-2 border-lav-400 bg-lav-50 p-2 shadow-xl ring-1 ring-black/5 focus:outline-none"
        >
          <div className="px-3 py-2">
            <div className="flex items-center gap-2">
              <CatFace size={22} className="text-lav-600" />
              <p className="truncate font-marker text-base text-lav-900">
                {user.name || displayName}
              </p>
            </div>
            <p className="mt-0.5 truncate font-hand text-sm text-lav-600">
              {user.email}
            </p>
          </div>

          <div className="my-1 border-t-2 border-dashed border-lav-300" />

          <Link
            href="/orders"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-hand text-lg text-lav-800 transition hover:bg-lav-200/80 hover:text-lav-950"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5 text-lav-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Order history
          </Link>

          <div className="my-1 border-t-2 border-dashed border-lav-300" />

          <form
            action={async () => {
              setOpen(false);
              await logoutAction();
            }}
          >
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-hand text-lg text-lav-700 transition hover:bg-lav-200/80 hover:text-lav-950"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-lav-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
