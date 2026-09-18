import Link from "next/link";
import { bakeryConfig } from "@/lib/config";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {bakeryConfig.businessName}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-black/70 dark:text-white/70">
          {bakeryConfig.tagline}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/menu"
            className="rounded-full bg-amber-700 px-6 py-3 text-white transition hover:bg-amber-800"
          >
            View the menu
          </Link>
          <Link
            href="/about"
            className="rounded-full border border-black/15 px-6 py-3 transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            About the bakery
          </Link>
        </div>
      </section>

      <section className="mt-20 grid gap-8 sm:grid-cols-3">
        <InfoCard
          title="Order ahead"
          body={`Orders need at least a couple days' lead time for baking — pick a ready date at checkout.`}
        />
        <InfoCard
          title="Pickup, delivery, or shipping"
          body={`Choose free pickup, local delivery, or shipping anywhere in California.`}
        />
        <InfoCard
          title="Pay when you get it"
          body="Payment is settled directly with the baker — cash, Venmo, or Zelle — at pickup, delivery, or before shipping."
        />
      </section>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 p-6 dark:border-white/10">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-black/70 dark:text-white/70">{body}</p>
    </div>
  );
}
