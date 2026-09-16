import type { Metadata } from "next";
import { Archivo_Black, Instrument_Serif, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import { CartDrawer } from "./components/cart-drawer";

const display = Archivo_Black({
  variable: "--font-felisa-display",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const serif = Instrument_Serif({
  variable: "--font-felisa-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const body = Space_Grotesk({
  variable: "--font-felisa-body",
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
      className={`${display.variable} ${serif.variable} ${body.variable} h-full antialiased`}
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
