import type { Metadata } from "next";
import { Chewy, Baloo_2, Schoolbell } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import { CartDrawer } from "./components/cart-drawer";

const bubble = Chewy({
  variable: "--font-felisa-bubble",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const round = Baloo_2({
  variable: "--font-felisa-round",
  subsets: ["latin"],
  display: "swap",
});

const note = Schoolbell({
  variable: "--font-felisa-note",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Felisa Cafe — ube, matcha, and housemade everything",
    template: "%s · Felisa Cafe",
  },
  description:
    "A Filipino-American coffee bar in Fullerton. Housemade ube syrup, caramelized banana, and a cat who signs every cup.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bubble.variable} ${round.variable} ${note.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <CartDrawer />
      </body>
    </html>
  );
}
