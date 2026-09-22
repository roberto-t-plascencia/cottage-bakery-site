"use client";

import { useEffect, useRef, useState } from "react";

// PayPal's classic JS SDK attaches itself to `window.paypal` once its
// script tag loads — no npm package involved (see this component's
// comment below for why). This is just enough of its shape for what's
// called here; PayPal's SDK doesn't ship its own types.
declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError?: (err: unknown) => void;
      }) => { render: (container: HTMLElement) => void };
    };
  }
}

type Props = {
  paypalClientId: string;
  orderId: string;
  onCaptured: () => void;
};

const PAYPAL_SDK_SCRIPT_ID = "paypal-sdk";

/**
 * Renders PayPal's hosted Buttons via their classic JS SDK, loaded here
 * client-side with the public Client ID (not a secret — see
 * docs/adr/0006-online-payment-paypal.md). No @paypal/react-paypal-js
 * dependency: the SDK's own script-tag + `window.paypal.Buttons(...)`
 * API is a handful of lines, and this codebase already prefers a small
 * hand-written integration over a dependency for a small surface area
 * (see docs/adr/0001-tech-stack.md's no-ORM reasoning — same instinct).
 *
 * The two calls this makes — createOrder and onApprove's capture — both
 * hit web/'s own API routes, which proxy to api/; api/ does the actual
 * PayPal API calls and the payment capture, server-side, using the
 * secret Client Secret this component never sees. This component's only
 * job is: show the button, tell PayPal which order id to attach a
 * payment to, and report success/failure back to the order page.
 */
export function PayPalCheckoutButton({ paypalClientId, orderId, onCaptured }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    function renderButtons() {
      if (cancelled || !window.paypal || !containerRef.current) return;
      setLoading(false);
      window.paypal.Buttons({
        createOrder: async () => {
          const res = await fetch(`/api/orders/${orderId}/paypal-order`, { method: "POST" });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.errors?.[0] ?? "Could not start PayPal checkout.");
          }
          return data.paypalOrderId as string;
        },
        onApprove: async (data) => {
          const res = await fetch(`/api/orders/${orderId}/capture-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paypalOrderId: data.orderID }),
          });
          const body = await res.json();
          if (!res.ok) {
            setError(body.errors?.[0] ?? "Payment could not be completed. Please try again.");
            return;
          }
          onCaptured();
        },
        onError: () => {
          setError("Something went wrong with PayPal. Please try again.");
        },
      }).render(containerRef.current);
    }

    if (document.getElementById(PAYPAL_SDK_SCRIPT_ID)) {
      renderButtons();
    } else {
      const script = document.createElement("script");
      script.id = PAYPAL_SDK_SCRIPT_ID;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD&intent=capture`;
      script.onload = renderButtons;
      script.onerror = () => setError("Could not load PayPal. Please try again.");
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
    // orderId/paypalClientId are stable for the lifetime of this
    // component (it's mounted fresh per checkout attempt); onCaptured is
    // a plain callback from the parent, not something that should
    // re-trigger a script reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, paypalClientId]);

  return (
    <div>
      {loading && (
        <p className="text-sm text-black/50 dark:text-white/50">Loading PayPal…</p>
      )}
      <div ref={containerRef} />
      {error && (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
