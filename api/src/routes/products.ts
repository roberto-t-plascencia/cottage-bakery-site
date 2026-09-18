import { Router } from "express";
import { listActiveProducts } from "../lib/repositories/products";

export const productsRouter = Router();

// GET /products — public. web/'s /menu Server Component calls this.
productsRouter.get("/", async (_req, res) => {
  const products = await listActiveProducts();
  res.json({ products });
});
