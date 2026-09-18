import type { Metadata } from "next";
import "./globals.css";
import { bakeryConfig } from "@/lib/config";
import { CartProvider } from "@/lib/CartContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: `${bakeryConfig.businessName} | ${bakeryConfig.tagline}`,
  description: bakeryConfig.tagline,
};

// Deliberately no next/font/google here: it fetches font files from
// Google's CDN at build time, which means the build is only reproducible
// when that network call succeeds — a bad property for CI, offline dev, or
// any network-restricted environment (this one included; see
// docs/adr/0001-tech-stack.md for the same reasoning applied to Prisma).
// The system font stack in globals.css costs nothing to build and nothing
// to load.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
