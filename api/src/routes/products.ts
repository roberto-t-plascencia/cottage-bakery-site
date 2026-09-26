import { Router } from "express";
import { z } from "zod";
import { listActiveProducts, setProductSoldOutOn } from "../lib/repositories/products";
import { bakeryToday } from "../lib/cart";
import { requireAdmin } from "../middleware/requireAdmin";

export const productsRouter = Router();

// GET /products — public. web/'s /menu Server Component calls this.
productsRouter.get("/", async (_req, res) => {
  const products = await listActiveProducts();
  res.json({ products });
});

const SoldOutSchema = z.object({ soldOutToday: z.boolean() });

// PATCH /products/:id/sold-out — admin. true marks the product sold out
// for today's bakery date (it resets itself at midnight); false clears
// it. See docs/adr/0009-sold-out-today.md.
productsRouter.patch("/:id/sold-out", requireAdmin, async (req, res) => {
  const parsed = SoldOutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: ["soldOutToday must be true or false."] });
    return;
  }

  const product = await setProductSoldOutOn(
    String(req.params.id),
    parsed.data.soldOutToday ? bakeryToday() : null
  );
  if (!product) {
    res.status(404).json({ errors: ["Product not found."] });
    return;
  }
  res.json({ product });
});
