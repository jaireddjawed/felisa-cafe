import Link from "next/link";
import { getAuthUser } from "@/lib/pocketbase-server";
import { logout } from "@/app/actions/auth";

export async function AccountMenu() {
  const user = await getAuthUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full px-3 py-1.5 font-hand text-lg text-lav-800 hover:bg-lav-300"
      >
        Log in
      </Link>
    );
  }

  return (
    <form action={logout} className="flex items-center gap-2">
      <span className="hidden font-hand text-lg text-lav-700 sm:inline">
        Hi, {user.name || user.email}
      </span>
      <button
        type="submit"
        className="rounded-full px-3 py-1.5 font-hand text-lg text-lav-800 hover:bg-lav-300"
      >
        Log out
      </button>
    </form>
  );
}
