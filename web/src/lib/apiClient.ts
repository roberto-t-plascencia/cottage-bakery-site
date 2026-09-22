import type {
  CreateOrderRequest,
  FulfillmentMethod,
  Order,
  OrderWithItems,
  Product,
} from "./types";

/**
 * The only place in web/ that knows api/'s base URL and calls it. Every
 * Server Component and API route that needs data goes through here — the
 * same "one seam" instinct as the old repository layer (see
 * docs/ARCHITECTURE.md and docs/adr/0001-tech-stack.md), just moved one
 * layer out now that the database itself is behind a network boundary.
 *
 * This is server-side-only code: it's imported from Server Components
 * and Route Handlers, never from a "use client" component — the browser
 * never talks to api/ directly (see docs/adr/0004-service-boundary.md).
 * There's no `server-only` package guard here the way api/'s old
 * Supabase client had one, because there's nothing secret in this file
 * to leak to a client bundle (no service_role key — just a base URL) —
 * the enforcement that matters is "the browser never receives an
 * Authorization header for api/", which happens in the route handlers
 * that call this, not here.
 */
function apiUrl(): string {
  const url = process.env.API_URL;
  if (!url) {
    throw new Error(
      "API_URL is not set. Copy .env.example to .env and point it at the api/ service (see README.md)."
    );
  }
  return url;
}

export type ApiErrorBody = { errors: string[] };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errors: string[]
  ) {
    super(errors.join(" ") || `api/ returned ${status}`);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  /** Bearer token to forward — see requireAdminToken() below. */
  token?: string;
};

async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${apiUrl()}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    // Server Components / Route Handlers read live order and menu data —
    // never let Next cache a response meant to reflect this request.
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as T & Partial<ApiErrorBody>;

  if (!res.ok) {
    throw new ApiError(res.status, data.errors ?? [`api/ returned ${res.status}`]);
  }

  return data as T;
}

export const apiClient = {
  listProducts: () => apiFetch<{ products: Product[] }>("/products").then((r) => r.products),

  createOrder: (body: CreateOrderRequest) =>
    apiFetch<{ order: OrderWithItems }>("/orders", { method: "POST", body }).then((r) => r.order),

  getOrder: (id: string) =>
    apiFetch<{ order: OrderWithItems }>(`/orders/${id}`).then((r) => r.order),

  listOrders: (token: string) =>
    apiFetch<{ orders: OrderWithItems[] }>("/orders", { token }).then((r) => r.orders),

  updateOrderStatus: (id: string, status: Order["status"], token: string) =>
    apiFetch<{ order: Order }>(`/orders/${id}/status`, {
      method: "PATCH",
      body: { status },
      token,
    }).then((r) => r.order),

  adminLogin: (password: string) =>
    apiFetch<{ token: string }>("/admin/login", { method: "POST", body: { password } }),

  getConfig: () => apiFetch<{ paypalClientId: string | null }>("/config"),

  // See docs/adr/0006-online-payment-paypal.md. Both of these are called
  // from web/'s own /api/orders/[id]/... route handlers (never directly
  // from the browser), which is what PayPalCheckoutButton.tsx talks to.
  createPayPalOrder: (orderId: string) =>
    apiFetch<{ paypalOrderId: string }>(`/orders/${orderId}/paypal-order`, { method: "POST" }),

  capturePayment: (orderId: string, paypalOrderId: string) =>
    apiFetch<{ order: Order }>(`/orders/${orderId}/capture-payment`, {
      method: "POST",
      body: { paypalOrderId },
    }).then((r) => r.order),
};

export type { FulfillmentMethod };
