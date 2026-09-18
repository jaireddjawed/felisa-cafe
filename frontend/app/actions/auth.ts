"use server";

import { redirect } from "next/navigation";
import { ClientResponseError } from "pocketbase";

import { createServerClient, saveAuthCookie } from "@/lib/pocketbase-server";

export type AuthFormState = { error: string } | undefined;

function pbErrorMessage(err: unknown, fallback: string) {
  if (err instanceof ClientResponseError) {
    const fieldError = Object.values(err.response?.data ?? {})[0] as
      | { message?: string }
      | undefined;
    return fieldError?.message ?? err.response?.message ?? fallback;
  }
  return fallback;
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const pb = await createServerClient();

  try {
    await pb.collection("users").authWithPassword(email, password);
  } catch (err) {
    return { error: pbErrorMessage(err, "Couldn't sign you in.") };
  }

  await saveAuthCookie(pb);
  redirect("/");
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!name || !email || !password) {
    return { error: "Fill in your name, email, and password." };
  }
  if (password !== passwordConfirm) {
    return { error: "Passwords don't match." };
  }

  const pb = await createServerClient();

  try {
    await pb.collection("users").create({
      name,
      email,
      password,
      passwordConfirm,
    });
    await pb.collection("users").authWithPassword(email, password);
  } catch (err) {
    return { error: pbErrorMessage(err, "Couldn't create your account.") };
  }

  await saveAuthCookie(pb);
  redirect("/");
}

export async function logout() {
  const pb = await createServerClient();
  pb.authStore.clear();
  await saveAuthCookie(pb);
  redirect("/");
}
