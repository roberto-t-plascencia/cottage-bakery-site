import { listActiveProducts } from "@/lib/repositories/products";
import { ProductCard } from "@/components/ProductCard";

export const metadata = { title: "Menu" };

// Without this, Next would prerender the menu once at build time (it has
// no dynamic params or request-time APIs to force dynamic rendering on its
// own) and serve that same static snapshot to every visitor until the next
// deploy — so adding a seasonal item or marking something sold out
// wouldn't show up until a rebuild. The menu changes independently of
// deploys, so it needs to be read fresh on every request.
export const dynamic = "force-dynamic";

// Server Component: the menu is read directly from the database at request
// time rather than through a fetch('/api/products') round trip — no need
// to hop through an API layer just to read data the server already has.
// The API route (/api/orders) exists where it earns its keep: a client
// mutation from the checkout form.
export default async function MenuPage() {
  const products = listActiveProducts();

  const byCategory = products.reduce<Record<string, typeof products>>(
    (acc, product) => {
      (acc[product.category] ??= []).push(product);
      return acc;
    },
    {}
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Menu</h1>
      <p className="mt-2 text-black/70 dark:text-white/70">
        Everything is baked to order. Add items to your order, then choose
        pickup, delivery, or shipping at checkout.
      </p>

      {products.length === 0 && (
        <p className="mt-10 text-black/60 dark:text-white/60">
          No items are available right now — check back soon.
        </p>
      )}

      {Object.entries(byCategory).map(([category, items]) => (
        <section key={category} className="mt-12">
          <h2 className="text-xl font-semibold">{category}</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
