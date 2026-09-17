import type { Metadata } from "next";
import { CatFace } from "../components/doodles";
import { LoginForm } from "../components/login-form";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <div className="sticker rounded-3xl bg-lav-100 p-8">
        <CatFace size={48} className="mx-auto text-lav-600" />
        <h1 className="mt-3 text-center font-marker text-3xl text-lav-800">
          Welcome back
        </h1>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
