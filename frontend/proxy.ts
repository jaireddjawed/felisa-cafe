import { NextResponse, type NextRequest } from "next/server";
import { isTokenExpired } from "pocketbase";

// Keep in sync with AUTH_COOKIE in lib/pocketbase-server.ts. Not imported
// directly since that module is marked "server-only", which some bundler
// targets treat as unavailable outside app/route code.
const AUTH_COOKIE = "pb_auth";

// Signed-in users don't need the login/signup forms — bounce them home.
// Optimistic only: reads the cookie's token, no request to PocketBase.
export function proxy(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;

  let token = "";
  try {
    token = cookie ? (JSON.parse(cookie).token ?? "") : "";
  } catch {
    token = "";
  }

  if (token && !isTokenExpired(token)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/signup"],
};
