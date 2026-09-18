import express, { type ErrorRequestHandler } from "express";
import { productsRouter } from "./routes/products";
import { ordersRouter } from "./routes/orders";
import { adminRouter } from "./routes/admin";

/**
 * Separated from index.ts so route tests (tests/routes/*.test.ts) can
 * import the app directly with supertest, without also binding a real
 * port — see specs/ENGINEERING_RULES.md "Testing bar" for why route
 * tests exist at all (they didn't, pre-split — see
 * web/docs/TESTING_STRATEGY.md's "what isn't covered, on purpose" for the
 * old reasoning, which stopped applying once this service became
 * reachable independently of Next.js's own routing).
 */
export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/products", productsRouter);
  app.use("/orders", ordersRouter);
  app.use("/admin", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ errors: ["Not found."] });
  });

  // Single place every thrown/rejected error in a route handler ends up
  // (Express 5 auto-forwards rejected async handlers to error middleware,
  // unlike Express 4 — no need for a try/catch-and-next wrapper on every
  // route). Never leaks the raw error message to the client — that's for
  // the server log — but always responds with the one error envelope
  // shape this service uses everywhere (see
  // specs/ENGINEERING_RULES.md "Error envelope").
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ errors: ["Internal server error."] });
  };
  app.use(errorHandler);

  return app;
}
