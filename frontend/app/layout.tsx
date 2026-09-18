import type { Metadata } from "next";
import { Gloria_Hallelujah, Patrick_Hand, Nunito } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import { CartDrawer } from "./components/cart-drawer";
import { AccountMenu } from "./components/account-menu";

const marker = Gloria_Hallelujah({
  variable: "--font-felisa-marker",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const hand = Patrick_Hand({
  variable: "--font-felisa-hand",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const body = Nunito({
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
      className={`${marker.variable} ${hand.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader accountSlot={<AccountMenu />} />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <CartDrawer />
      </body>
    </html>
  );
}
