"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/CartContext";
import {
  bakeryCalendarDate,
  cartSubtotalCents,
  earliestReadyDate,
  formatCents,
  formatCutoff,
  sameDayCutoffMinutes,
  toDateInputValue,
} from "@/lib/cart";
import { bakeryConfig, type FulfillmentOptionId } from "@/lib/config";
import { FREE_DELIVERY_MIN_SUBTOTAL_CENTS, deliveryFeeCents } from "@/lib/fees";
import { formatPhoneInput } from "@/lib/phone";
import { PayPalCheckoutButton } from "@/components/PayPalCheckoutButton";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

type PaymentMethod = "MANUAL" | "PAYPAL";

type FormState = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentOptionId;
  fulfillmentAddress: string;
  requestedDate: string;
  notes: string;
  paymentMethod: PaymentMethod;
};

export default function OrderPage() {
  const router = useRouter();
  const { cart, remove, setQuantity, clear } = useCart();
  const initialMinDate = useMemo(() => toDateInputValue(earliestReadyDate("PICKUP")), []);

  const [form, setForm] = useState<FormState>({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    fulfillmentMethod: "PICKUP",
    fulfillmentAddress: "",
    requestedDate: initialMinDate,
    notes: "",
    paymentMethod: "MANUAL",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Once a PAYPAL order has been created (PENDING, UNPAID), the form is
  // replaced by the PayPal buttons — the order already exists at this
  // point; only payment is still pending. The cart is deliberately kept
  // until payment actually succeeds (onCaptured, below), so a buyer who
  // backs out mid-payment hasn't lost their cart.
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  // The server's total for the created order (subtotal + its own
  // delivery fee), shown on the PayPal step instead of re-deriving it.
  const [pendingTotalCents, setPendingTotalCents] = useState<number | null>(null);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);

  // Items the bakery marked sold out for today (admin switch). They can
  // still be ordered for tomorrow or later; api/ enforces the same rule.
  const [soldOutToday, setSoldOutToday] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/products/sold-out")
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setSoldOutToday(data.products ?? []))
      .catch(() => {});
  }, []);
  const soldOutInCart = soldOutToday.filter((p) => cart.some((line) => line.productId === p.id));

  // Depends on the fulfillment method: same-day delivery stays open
  // later than same-day pickup (see sameDayCutoffMinutes in lib/cart.ts).
  // A sold-out item in the cart pushes it to tomorrow at the earliest.
  function minDateFor(method: FulfillmentOptionId): string {
    const earliest = toDateInputValue(earliestReadyDate(method));
    if (soldOutInCart.length === 0) return earliest;
    const tomorrow = bakeryCalendarDate();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowValue = toDateInputValue(tomorrow);
    return earliest > tomorrowValue ? earliest : tomorrowValue;
  }
  const minDate = minDateFor(form.fulfillmentMethod);
  const sameDayCutoff = formatCutoff(sameDayCutoffMinutes(form.fulfillmentMethod));

  const subtotal = cartSubtotalCents(cart);
  const isDelivery = form.fulfillmentMethod === "LOCAL_DELIVERY";
  // Display only: api/ computes the fee that's actually charged (see
  // src/lib/fees.ts).
  const deliveryFee = deliveryFeeCents(form.fulfillmentMethod, subtotal);
  const total = subtotal + deliveryFee;
  const needsAddress =
    form.fulfillmentMethod === "LOCAL_DELIVERY" ||
    form.fulfillmentMethod === "IN_STATE_SHIPPING";

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: cart.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors(data.errors ?? ["Something went wrong. Please try again."]);
        setSubmitting(false);
        return;
      }

      if (form.paymentMethod === "MANUAL") {
        clear();
        router.push(`/order/confirmation/${data.order.id}`);
        return;
      }

      // PAYPAL: the order exists now; show the PayPal buttons next and
      // let PayPalCheckoutButton's onCaptured (below) take it from here.
      const configRes = await fetch("/api/config");
      const configData = await configRes.json();
      if (!configRes.ok || !configData.paypalClientId) {
        setErrors(["PayPal isn't configured right now. Please choose 'Pay at pickup' instead."]);
        setSubmitting(false);
        return;
      }
      setPaypalClientId(configData.paypalClientId);
      setPendingOrderId(data.order.id);
      setPendingTotalCents(data.order.totalCents);
      setSubmitting(false);
    } catch {
      setErrors(["Network error — please check your connection and try again."]);
      setSubmitting(false);
    }
  }

  if (pendingOrderId && paypalClientId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Pay with PayPal</h1>
        <p className="mt-4 text-black/70 dark:text-white/70">
          Your order has been created. Complete payment below to confirm it —{" "}
          {formatCents(pendingTotalCents ?? total)} total.
        </p>
        <div className="mt-8">
          <PayPalCheckoutButton
            paypalClientId={paypalClientId}
            orderId={pendingOrderId}
            onCaptured={() => {
              clear();
              router.push(`/order/confirmation/${pendingOrderId}`);
            }}
          />
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Your order is empty</h1>
        <p className="mt-4 text-black/70 dark:text-white/70">
          Add something from the{" "}
          <a href="/menu" className="underline">
            menu
          </a>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Your order</h1>

      <ul className="mt-6 divide-y divide-black/10 dark:divide-white/10">
        {cart.map((line) => (
          <li key={line.productId} className="flex items-center gap-4 py-4">
            <div className="flex-1">
              <p className="font-medium">{line.name}</p>
              <p className="text-sm text-black/60 dark:text-white/60">
                {formatCents(line.unitPriceCents)} each
              </p>
            </div>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(e) =>
                setQuantity(line.productId, Number(e.target.value))
              }
              className="w-16 rounded border border-black/15 px-2 py-1 text-center dark:border-white/20 dark:bg-transparent"
            />
            <span className="w-20 text-right font-medium">
              {formatCents(line.unitPriceCents * line.quantity)}
            </span>
            <button
              type="button"
              onClick={() => remove(line.productId)}
              className="text-sm text-black/50 hover:text-red-700 dark:text-white/50"
              aria-label={`Remove ${line.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2 border-t border-black/10 pt-4 dark:border-white/10">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCents(subtotal)}</span>
        </div>
        {isDelivery && (
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{deliveryFee === 0 ? "Free" : formatCents(deliveryFee)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCents(total)}</span>
        </div>
        {isDelivery && deliveryFee > 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">
            Add {formatCents(FREE_DELIVERY_MIN_SUBTOTAL_CENTS - subtotal)} more for free delivery.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        <h2 className="text-lg font-semibold">Your details</h2>

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            <ul className="list-disc pl-5">
              {errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Name">
          <input
            required
            type="text"
            value={form.customerName}
            onChange={(e) => updateField("customerName", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={form.customerEmail}
            onChange={(e) => updateField("customerEmail", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Phone">
          <input
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(858) 555-0123"
            pattern="\(\d{3}\) \d{3}-\d{4}"
            title="10-digit phone number, like (858) 373-9363"
            value={form.customerPhone}
            onChange={(e) => updateField("customerPhone", formatPhoneInput(e.target.value))}
            className="input"
          />
        </Field>

        <Field label="Fulfillment">
          <select
            value={form.fulfillmentMethod}
            onChange={(e) => {
              const method = e.target.value as FulfillmentOptionId;
              const newMin = minDateFor(method);
              // Switching to a method whose same-day window has already
              // closed moves a now-too-early date up, instead of letting
              // the server reject it on submit. Date-only strings compare
              // correctly as plain strings.
              setForm((prev) => ({
                ...prev,
                fulfillmentMethod: method,
                requestedDate:
                  prev.requestedDate < newMin ? newMin : prev.requestedDate,
              }));
            }}
            className="input"
          >
            {bakeryConfig.fulfillmentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            {
              bakeryConfig.fulfillmentOptions.find(
                (o) => o.id === form.fulfillmentMethod
              )?.description
            }
          </p>
        </Field>

        {needsAddress && (
          <Field
            label={
              form.fulfillmentMethod === "LOCAL_DELIVERY"
                ? "Delivery address"
                : "Shipping address (must be in California)"
            }
          >
            <AddressAutocomplete
              value={form.fulfillmentAddress}
              onChange={(value) => updateField("fulfillmentAddress", value)}
              area={form.fulfillmentMethod === "LOCAL_DELIVERY" ? "LOCAL_DELIVERY" : "IN_STATE_SHIPPING"}
            />
          </Field>
        )}

        <Field label="Requested ready date">
          <input
            required
            type="date"
            min={minDate}
            value={form.requestedDate}
            onChange={(e) => updateField("requestedDate", e.target.value)}
            className="input"
          />
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            Earliest available: {minDate}. Same-day orders close at {sameDayCutoff}.
          </p>
          {soldOutInCart.length > 0 && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-400">
              {soldOutInCart.map((p) => p.name).join(", ")}{" "}
              {soldOutInCart.length === 1 ? "is" : "are"} sold out for today, so the
              earliest date is tomorrow.
            </p>
          )}
        </Field>

        <Field label="Notes (optional)">
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            className="input"
            rows={3}
            placeholder="Allergies, cake message, delivery instructions, etc."
          />
        </Field>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium">Payment</legend>
          <label className="flex items-start gap-2 py-1">
            <input
              type="radio"
              name="paymentMethod"
              checked={form.paymentMethod === "MANUAL"}
              onChange={() => updateField("paymentMethod", "MANUAL")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">
                Pay at pickup/delivery
              </span>
              <span className="block text-xs text-black/50 dark:text-white/50">
                Cash, Venmo, or Zelle, arranged directly with {bakeryConfig.ownerName} — nothing
                is charged now.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 py-1">
            <input
              type="radio"
              name="paymentMethod"
              checked={form.paymentMethod === "PAYPAL"}
              onChange={() => updateField("paymentMethod", "PAYPAL")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Pay now with card (PayPal)</span>
              <span className="block text-xs text-black/50 dark:text-white/50">
                Pay online by credit/debit card or PayPal — no PayPal account required.
              </span>
            </span>
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-amber-700 px-6 py-3 font-medium text-white transition hover:bg-amber-800 disabled:opacity-50"
        >
          {submitting
            ? "Submitting…"
            : form.paymentMethod === "PAYPAL"
              ? "Continue to payment"
              : "Submit order request"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
