"use client";

import Image from "next/image";
import Link from "next/link";
import { bakeryConfig } from "@/lib/config";
import { useCart } from "@/lib/CartContext";

const NAV_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const { itemCount } = useCart();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          {/* Decorative: the business name right beside it is the link's accessible name. */}
          <Image src="/logo-mark.svg" alt="" width={36} height={36} priority unoptimized />
          {bakeryConfig.businessName}
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
          <Link
            href="/order"
            className="flex items-center gap-2 rounded-full bg-amber-700 px-4 py-1.5 text-white transition hover:bg-amber-800"
          >
            Order
            {itemCount > 0 && (
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
                {itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
