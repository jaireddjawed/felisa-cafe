import type { Metadata } from "next";
import { Outfit, Caveat } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import { CartDrawer } from "./components/cart-drawer";

const display = Outfit({
  variable: "--font-felisa-display",
  subsets: ["latin"],
  display: "swap",
});

const script = Caveat({
  variable: "--font-felisa-script",
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
      className={`${display.variable} ${script.variable} h-full antialiased`}
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
