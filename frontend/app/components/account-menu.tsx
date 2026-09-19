import Link from "next/link";
import { getAuthUser } from "@/lib/pocketbase-server";
import { logout } from "@/app/actions/auth";
import { AccountDropdown } from "./account-dropdown";

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
    <AccountDropdown
      user={{ name: user.name, email: user.email }}
      logoutAction={logout}
    />
  );
}
