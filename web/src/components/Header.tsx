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

/**
 * The cart button. Rendered twice — once for the phone layout's first
 * row, once inline with the links on wider screens — because it belongs
 * in a different place in each. Only one is ever in the DOM's
 * accessibility tree: `hidden` is `display: none`, so the other is
 * genuinely absent rather than merely invisible, and a screen reader
 * never announces two "Order" buttons.
 */
function OrderLink({ className = "" }: { className?: string }) {
  const { itemCount } = useCart();

  return (
    <Link
      href="/order"
      className={`flex shrink-0 items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm text-white transition hover:bg-brand-800 ${className}`}
    >
      Order
      {itemCount > 0 && (
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
          {itemCount}
        </span>
      )}
    </Link>
  );
}

/**
 * Two rows on a phone, one row from `sm:` (640px) up.
 *
 * Before this, the header was a single flex row at every width. At 375px
 * that squeezed the business name into a 72px-wide box, wrapping
 * "Violeta's Baked Goods" onto several lines and making the header
 * 145px tall — 18% of the screen, on every page, before any content.
 *
 * The phone layout keeps the name legible (it wraps to two deliberate
 * lines at most) and keeps the cart button on the first row, where it
 * stays visible: it's the one control that turns a visitor into an
 * order, so it should never be the thing that gets hidden. That's also
 * why this isn't a hamburger menu — with three links, collapsing them
 * costs discoverability and buys back only a few pixels, and doing it
 * accessibly (aria-expanded, Escape to close, focus management) is a lot
 * of machinery for that trade.
 *
 * The links carry `py-2` so they're ~40px tall rather than the 20px they
 * were, which is what WCAG 2.5.8's 24x24 minimum (and Apple's and
 * Android's ~44px guidance) is about: a fingertip is not a mouse
 * pointer.
 */
export function Header() {
  return (
    <header className="border-t-4 border-b border-t-leaf-700 border-b-black/10 dark:border-t-leaf-600 dark:border-b-white/10">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-3 text-base font-semibold leading-tight tracking-tight sm:text-lg"
          >
            {/* Decorative: the business name right beside it is the link's accessible name. */}
            <Image src="/logo-mark.svg" alt="" width={36} height={36} priority unoptimized className="shrink-0" />
            {bakeryConfig.businessName}
          </Link>
          <OrderLink className="sm:hidden" />
        </div>

        <nav className="flex items-center justify-between gap-1 text-sm sm:justify-end sm:gap-6">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="px-1 py-2 hover:underline">
              {link.label}
            </Link>
          ))}
          <OrderLink className="hidden sm:flex" />
        </nav>
      </div>
    </header>
  );
}
