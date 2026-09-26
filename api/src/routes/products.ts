import express, { Router } from "express";
import { z } from "zod";
import {
  createProduct,
  getProductById,
  listActiveProducts,
  listAllProducts,
  setProductActive,
  setProductImageUrl,
  setProductSoldOutOn,
} from "../lib/repositories/products";
import { slugify } from "../lib/slug";
import { deleteProductImage, uploadProductImage } from "../lib/storage";
import { bakeryToday } from "../lib/cart";
import { requireAdmin } from "../middleware/requireAdmin";

export const productsRouter = Router();

// GET /products — public. web/'s /menu Server Component calls this.
productsRouter.get("/", async (_req, res) => {
  const products = await listActiveProducts();
  res.json({ products });
});

// GET /products/all — admin. Every product, hidden ones included, so the
// admin menu can manage photos for items not on the menu yet.
productsRouter.get("/all", requireAdmin, async (_req, res) => {
  const products = await listAllProducts();
  res.json({ products });
});

const text = (field: string, max: number) =>
  z
    .string({ error: `${field} is required.` })
    .trim()
    .min(1, `${field} is required.`)
    .max(max, `${field} must be at most ${max} characters.`);

// Everything a California cottage food label needs is required here
// (ingredients, allergens, net weight), so a product can't go on the menu
// without its label content. Allergens can be "none".
const CreateProductSchema = z.object({
  name: text("Name", 80),
  description: text("Description", 500),
  priceCents: z
    .number({ error: "Price is required." })
    .int("Price must be in whole cents.")
    .min(1, "Price must be more than $0.")
    .max(100000, "Price must be $1,000 or less."),
  category: text("Category", 40),
  allergens: text("Allergens", 200),
  ingredients: text("Ingredients", 2000),
  netWeight: text("Net weight", 60),
  isActive: z.boolean().default(false),
});

// POST /products — admin. Creates a product. It starts hidden unless
// isActive is true, so the owner can add a photo before it shows.
productsRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.issues.map((i) => i.message) });
    return;
  }
  const slug = slugify(parsed.data.name);
  if (!slug) {
    res.status(400).json({ errors: ["Name needs at least one letter or number."] });
    return;
  }

  const product = await createProduct({ ...parsed.data, slug, imageUrl: null });
  res.status(201).json({ product });
});

const UpdateProductSchema = z.object({ isActive: z.boolean() });

// PATCH /products/:id — admin. Shows or hides a product on the menu.
productsRouter.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = UpdateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: ["isActive must be true or false."] });
    return;
  }
  const product = await setProductActive(String(req.params.id), parsed.data.isActive);
  if (!product) {
    res.status(404).json({ errors: ["Product not found."] });
    return;
  }
  res.json({ product });
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

// The admin page shrinks photos in the browser before upload (see
// web/src/lib/resizeImage.ts), so real uploads are a few hundred KB. The
// cap stays under Vercel's 4.5 MB request limit either way.
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// PUT /products/:id/image — admin. Body is the image itself
// (Content-Type image/jpeg, image/png or image/webp). Replaces any
// existing photo.
productsRouter.put(
  "/:id/image",
  requireAdmin,
  express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const contentType = String(req.headers["content-type"] ?? "").split(";")[0].trim();
    const ext = IMAGE_TYPES[contentType];
    if (!ext || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(415).json({ errors: ["Send a JPEG, PNG or WebP image."] });
      return;
    }

    const product = await getProductById(String(req.params.id));
    if (!product) {
      res.status(404).json({ errors: ["Product not found."] });
      return;
    }

    const imageUrl = await uploadProductImage(req.body, `${product.slug}.${ext}`, contentType);
    const updated = await setProductImageUrl(product.id, imageUrl);
    if (product.imageUrl) {
      // The new photo is already live; a leftover old file is harmless.
      await deleteProductImage(product.imageUrl).catch((err) => console.error(err));
    }
    res.json({ product: updated });
  }
);

// DELETE /products/:id/image — admin. Removes the photo.
productsRouter.delete("/:id/image", requireAdmin, async (req, res) => {
  const product = await getProductById(String(req.params.id));
  if (!product) {
    res.status(404).json({ errors: ["Product not found."] });
    return;
  }
  const updated = await setProductImageUrl(product.id, null);
  if (product.imageUrl) {
    await deleteProductImage(product.imageUrl).catch((err) => console.error(err));
  }
  res.json({ product: updated });
});
