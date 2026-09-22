import { Router } from "express";

export const configRouter = Router();

// GET /config — public. The only server-held value web/ needs that
// isn't already known to it: PayPal's Client ID is designed to be
// exposed in the browser (the PayPal JS SDK is loaded with it in a
// script tag; it's not a credential PayPal accepts on its own), but
// keeping it here instead of also copying it into web/'s own env keeps
// it defined in exactly one place — see
// docs/adr/0006-online-payment-paypal.md. Never add PAYPAL_CLIENT_SECRET
// or any other actual secret to this response.
configRouter.get("/", (_req, res) => {
  res.json({ paypalClientId: process.env.PAYPAL_CLIENT_ID ?? null });
});
