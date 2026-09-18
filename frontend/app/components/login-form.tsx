"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="font-hand text-xl text-lav-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="sticker rounded-xl bg-white px-4 py-2 font-hand text-xl text-lav-800 outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="font-hand text-xl text-lav-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="sticker rounded-xl bg-white px-4 py-2 font-hand text-xl text-lav-800 outline-none"
        />
      </div>

      {state?.error && (
        <p className="font-hand text-lg text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="sticker mt-2 rounded-full bg-lav-600 py-3 font-marker text-lg text-white transition hover:bg-lav-700 disabled:opacity-40"
      >
        {pending ? "Signing in…" : "Log in"}
      </button>

      <p className="text-center font-hand text-lg text-lav-600">
        New here?{" "}
        <Link href="/signup" className="underline decoration-dashed">
          Make an account
        </Link>
      </p>
    </form>
  );
}
