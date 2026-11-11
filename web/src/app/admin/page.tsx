import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";
import { AdminOrderRow } from "@/components/AdminOrderRow";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { AdminSoldOutToggle } from "@/components/AdminSoldOutToggle";
import { AdminProductPhoto } from "@/components/AdminProductPhoto";
import { AdminVisibilityToggle } from "@/components/AdminVisibilityToggle";
import { AdminInventoryRow } from "@/components/AdminInventoryRow";
import { AdminDayPicker } from "@/components/AdminDayPicker";
import { bakeryToday, formatDateOnly } from "@/lib/cart";
import {
  ORDER_VIEWS,
  ORDER_VIEW_DESCRIPTIONS,
  ORDER_VIEW_LABELS,
  adminHref,
  groupByRequestedDate,
  itemTotals,
  orderViewCounts,
  ordersForView,
  parseAdminTab,
  parseDayParam,
  parseOrderView,
  type AdminTab,
  type OrderView,
} from "@/lib/adminOrders";
import type { DayInventoryWithProduct, OrderWithItems } from "@/lib/types";

export const metadata = { title: "Admin" };

// Same reasoning as /menu's `dynamic` export: without it, this would be
// prerendered once at build time and every admin visit would show that
// build's order snapshot forever — silently hiding every order placed
// since the last deploy. This page's entire purpose is showing live data,
// so opting out of static generation isn't optional here.
export const dynamic = "force-dynamic";

// A Promise in Next 16 — see node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/page.md.
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * src/proxy.ts already redirects here-bound requests with no token
 * cookie at all — but it can't verify the token (see proxy.ts's
 * comment), so this is where an expired or forged token actually gets
 * caught: api/'s admin routes 401, apiClient throws an ApiError, and we
 * redirect to login exactly as if proxy.ts had caught it in the first
 * place. This is the real authorization check, not a redundant second
 * one.
 */
async function loadOrRedirect<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/admin/login");
    }
    throw err;
  }
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/admin/login");

  const params = await searchParams;
  const tab = parseAdminTab(params.tab);
  const today = bakeryToday();
  const day = parseDayParam(params.date, today);
  const view = parseOrderView(params.orders);

  // Each tab fetches only what it renders. The catalog tab needs just
  // one call: the day-inventory response already embeds every product
  // (api/'s listDayInventory covers the whole catalog, hidden items
  // included), so asking for the product list separately would be a
  // second round trip for data already in hand.
  const orders = tab === "orders" ? await loadOrRedirect(apiClient.listOrders(token)) : [];
  const inventory =
    tab === "catalog" ? await loadOrRedirect(apiClient.listDayInventory(day, token)) : [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <AdminLogoutButton />
      </div>

      <nav
        aria-label="Admin sections"
        className="mt-8 flex gap-1 border-b border-black/10 dark:border-white/10"
      >
        <TabLink
          tab="orders"
          active={tab}
          href={adminHref({ tab: "orders", orders: view })}
          label="Orders"
        />
        <TabLink
          tab="catalog"
          active={tab}
          href={adminHref({ tab: "catalog", date: day === today ? undefined : day })}
          label="Catalog"
        />
      </nav>

      {tab === "orders" ? (
        <OrdersSection orders={orders} view={view} today={today} />
      ) : (
        <CatalogSection inventory={inventory} day={day} today={today} />
      )}
    </div>
  );
}

function TabLink({
  tab,
  active,
  href,
  label,
}: {
  tab: AdminTab;
  active: AdminTab;
  href: string;
  label: string;
}) {
  const isActive = tab === active;
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "-mb-px border-b-2 border-amber-700 px-4 py-2 font-medium dark:border-amber-500"
          : "-mb-px border-b-2 border-transparent px-4 py-2 text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
      }
    >
      {label}
    </Link>
  );
}

function OrdersSection({
  orders,
  view,
  today,
}: {
  orders: OrderWithItems[];
  view: OrderView;
  today: string;
}) {
  const counts = orderViewCounts(orders, today);
  const visible = ordersForView(orders, view, today);
  const groups = groupByRequestedDate(visible);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap gap-2">
        {ORDER_VIEWS.map((candidate) => {
          const isActive = candidate === view;
          // Past due is the one view worth drawing attention to: it
          // means a date came and went with an order still open.
          const needsAttention = candidate === "pastDue" && counts.pastDue > 0;
          return (
            <Link
              key={candidate}
              href={adminHref({ tab: "orders", orders: candidate })}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "rounded-full bg-amber-700 px-4 py-1.5 text-sm font-medium text-white"
                  : needsAttention
                    ? "rounded-full border border-red-700/40 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-700/10 dark:border-red-400/40 dark:text-red-400"
                    : "rounded-full border border-black/20 px-4 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              }
            >
              {ORDER_VIEW_LABELS[candidate]}{" "}
              <span className={isActive ? "opacity-80" : "opacity-60"}>{counts[candidate]}</span>
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-black/60 dark:text-white/60">
        {ORDER_VIEW_DESCRIPTIONS[view]}
      </p>

      {visible.length === 0 ? (
        <p className="mt-8 text-black/60 dark:text-white/60">
          {view === "pastDue"
            ? "Nothing overdue — every past date is finished or cancelled."
            : "No orders here."}
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {groups.map((group) => (
            <DateGroup key={group.date} date={group.date} orders={group.orders} today={today} />
          ))}
        </div>
      )}
    </section>
  );
}

function DateGroup({
  date,
  orders,
  today,
}: {
  date: string;
  orders: OrderWithItems[];
  today: string;
}) {
  // The one question the baker has in the morning: what goes in the
  // oven. Cancelled orders are left out of it — see itemTotals.
  const totals = itemTotals(
    orders.map((order) => ({
      status: order.status,
      items: order.items.map((item) => ({ name: item.product.name, quantity: item.quantity })),
    }))
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">
          {date === today ? "Today" : formatDateOnly(date)}
          <span className="ml-2 text-sm font-normal text-black/50 dark:text-white/50">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </span>
        </h2>
        {totals.length > 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">
            To bake: {totals.map((t) => `${t.quantity}× ${t.name}`).join(", ")}
          </p>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <th className="pb-2 pr-4 font-medium">Customer</th>
              <th className="pb-2 pr-4 font-medium">Items</th>
              <th className="pb-2 pr-4 font-medium">Fulfillment</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <AdminOrderRow
                key={order.id}
                order={{
                  ...order,
                  items: order.items.map((item) => ({
                    name: item.product.name,
                    quantity: item.quantity,
                  })),
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalogSection({
  inventory,
  day,
  today,
}: {
  inventory: DayInventoryWithProduct[];
  day: string;
  today: string;
}) {
  const capped = inventory.filter((entry) => entry.startQuantity !== null).length;

  return (
    <>
      <section className="mt-8 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">How much are we making?</h2>
          <AdminDayPicker date={day} today={today} />
        </div>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Set how many of each item you&apos;re starting{" "}
          {day === today ? "today" : formatDateOnly(day)} with. The count drops as orders come in,
          and the item sells out for that day when it reaches zero. Leave a box blank for no limit
          — that&apos;s how every day works until you give it a number. Type{" "}
          <span className="font-medium">0</span> to take nothing at all for that day.
        </p>
        {capped === 0 && (
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Nothing is capped {day === today ? "today" : "that day"} yet, so every item can be
            ordered freely.
          </p>
        )}
        <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
          {inventory.map((entry) => (
            <AdminInventoryRow
              key={entry.productId}
              item={{
                productId: entry.productId,
                name: entry.product.name,
                date: entry.date,
                startQuantity: entry.startQuantity,
                ordered: entry.ordered,
                remaining: entry.remaining,
              }}
            />
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Menu items</h2>
          <Link
            href="/admin/products/new"
            className="rounded-full bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
          >
            Add product
          </Link>
        </div>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Mark an item sold out when today&apos;s batch is gone — that&apos;s today only, whatever
          the counts above say, and it comes back on its own at midnight. &ldquo;Hide from
          menu&rdquo; takes an item off the menu until you show it again. Tap a photo button to add
          or change an item&apos;s picture.
        </p>
        <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
          {inventory.map(({ product }) => (
            <li key={product.id} className="flex items-center gap-4 py-3">
              <AdminProductPhoto
                productId={product.id}
                productName={product.name}
                imageUrl={product.imageUrl}
              />
              {product.isActive ? (
                <AdminSoldOutToggle
                  item={{ id: product.id, name: product.name, soldOutToday: product.soldOutToday }}
                />
              ) : (
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-black/50 dark:text-white/50">Hidden from the menu</p>
                </div>
              )}
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link
                  href={`/admin/products/${product.id}/edit`}
                  aria-label={`Edit ${product.name}`}
                  className="text-xs font-medium text-amber-800 hover:underline dark:text-amber-400"
                >
                  Edit
                </Link>
                <AdminVisibilityToggle
                  productId={product.id}
                  productName={product.name}
                  isActive={product.isActive}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
