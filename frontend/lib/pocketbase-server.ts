import "server-only";

import { cookies } from "next/headers";
import PocketBase, { getTokenPayload } from "pocketbase";

import type { TypedPocketBase } from "./pocketbase-types";

// In Docker, server-side requests use the private service name while browser
// requests keep using the public URL embedded in the client bundle.
const PB_URL =
  process.env.PB_URL ?? process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";

export const AUTH_COOKIE = "pb_auth";

/** Fresh PocketBase client for this request, hydrated from the session cookie. */
export async function createServerClient(): Promise<TypedPocketBase> {
  const pb = new PocketBase(PB_URL) as TypedPocketBase;
  const cookie = (await cookies()).get(AUTH_COOKIE)?.value;

  if (cookie) {
    pb.authStore.loadFromCookie(`${AUTH_COOKIE}=${cookie}`, AUTH_COOKIE);
  }

  return pb;
}

/**
 * Persists a client's current auth state as the session cookie, or clears it
 * when the client is signed out. Call after authWithPassword/create and on
 * logout.
 */
export async function saveAuthCookie(pb: TypedPocketBase) {
  const cookieStore = await cookies();

  if (!pb.authStore.isValid) {
    cookieStore.delete(AUTH_COOKIE);
    return;
  }

  const payload = getTokenPayload(pb.authStore.token);

  cookieStore.set(
    AUTH_COOKIE,
    JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: payload?.exp ? new Date(payload.exp * 1000) : undefined,
    },
  );
}

/** The signed-in user for this request, or null. Trusts the cookie only — no network call. */
export async function getAuthUser() {
  const pb = await createServerClient();
  return pb.authStore.isValid ? pb.authStore.record : null;
}
