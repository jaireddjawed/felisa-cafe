import type { Metadata } from "next";
import { GirlDoodle } from "../components/doodles";
import { SignupForm } from "../components/signup-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <div className="sticker rounded-3xl bg-lav-100 p-8">
        <GirlDoodle size={48} className="mx-auto text-lav-700" />
        <h1 className="mt-3 text-center font-marker text-3xl text-lav-800">
          Make an account
        </h1>
        <div className="mt-6">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
