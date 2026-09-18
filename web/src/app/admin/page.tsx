import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";
import { AdminOrderRow } from "@/components/AdminOrderRow";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";

export const metadata = { title: "Admin · Orders" };

// Same reasoning as /menu's `dynamic` export: without it, this would be
// prerendered once at build time and every admin visit would show that
// build's order snapshot forever — silently hiding every order placed
// since the last deploy. This page's entire purpose is showing live data,
// so opting out of static generation isn't optional here.
export const dynamic = "force-dynamic";

// src/proxy.ts already redirects here-bound requests with no token
// cookie at all — but it can't verify the token (see proxy.ts's
// comment), so this is where an expired or forged token actually gets
// caught: api/'s GET /orders (behind requireAdmin) 401s, apiClient
// throws an ApiError, and we redirect to login exactly as if proxy.ts
// had caught it in the first place. This is the real authorization
// check, not a redundant second one.
export default async function AdminOrdersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/admin/login");

  let orders;
  try {
    orders = await apiClient.listOrders(token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect("/admin/login");
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <AdminLogoutButton />
      </div>

      {orders.length === 0 ? (
        <p className="mt-8 text-black/60 dark:text-white/60">
          No orders yet.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
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
      )}
    </div>
  );
}
