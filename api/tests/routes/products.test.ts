import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

const products = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "cookies",
    name: "Cookies",
    description: "desc",
    priceCents: 2200,
    category: "Cookies",
    imageUrl: null,
    allergens: "",
    ingredients: "",
    netWeight: "",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

const setProductSoldOutOn = vi.fn(async (id: string, date: string | null) =>
  id === products[0].id ? { ...products[0], soldOutOn: date, soldOutToday: date !== null } : null
);

const setProductImageUrl = vi.fn(async (id: string, imageUrl: string | null) =>
  id === products[0].id ? { ...products[0], imageUrl } : null
);
const getProductById = vi.fn(async (id: string) =>
  id === products[0].id ? { ...products[0], imageUrl: "https://x.supabase.co/storage/v1/object/public/product-images/old.jpg" } : null
);

vi.mock("../../src/lib/repositories/products", () => ({
  listActiveProducts: vi.fn(async () => products),
  listAllProducts: vi.fn(async () => [...products, { ...products[0], id: "hidden", isActive: false }]),
  findProductsByIds: vi.fn(async () => []),
  getProductById: (...args: [string]) => getProductById(...args),
  setProductImageUrl: (...args: [string, string | null]) => setProductImageUrl(...args),
  setProductSoldOutOn: (...args: [string, string | null]) => setProductSoldOutOn(...args),
}));

const uploadProductImage = vi.fn(
  async (_file: unknown, filename: string, _contentType?: string) =>
    `https://x.supabase.co/storage/v1/object/public/product-images/new-${filename}`
);
const deleteProductImage = vi.fn(async (_url: string) => {});

vi.mock("../../src/lib/storage", () => ({
  uploadProductImage: (...args: [unknown, string, string?]) => uploadProductImage(...args),
  deleteProductImage: (...args: [string]) => deleteProductImage(...args),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";
});

const { createApp } = await import("../../src/app");
const { issueAdminToken } = await import("../../src/lib/auth");
const { bakeryToday } = await import("../../src/lib/cart");

describe("GET /products", () => {
  it("returns active products", async () => {
    const app = createApp();
    const res = await request(app).get("/products");
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].slug).toBe("cookies");
  });
});

describe("PATCH /products/:id/sold-out", () => {
  const url = `/products/${products[0].id}/sold-out`;

  it("requires an admin token", async () => {
    const res = await request(createApp()).patch(url).send({ soldOutToday: true });
    expect(res.status).toBe(401);
  });

  it("marks the product sold out for today's bakery date", async () => {
    const res = await request(createApp())
      .patch(url)
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .send({ soldOutToday: true });
    expect(res.status).toBe(200);
    expect(setProductSoldOutOn).toHaveBeenLastCalledWith(products[0].id, bakeryToday());
    expect(res.body.product.soldOutToday).toBe(true);
  });

  it("clears it", async () => {
    const res = await request(createApp())
      .patch(url)
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .send({ soldOutToday: false });
    expect(res.status).toBe(200);
    expect(setProductSoldOutOn).toHaveBeenLastCalledWith(products[0].id, null);
  });

  it("rejects a body without a boolean", async () => {
    const res = await request(createApp())
      .patch(url)
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .send({ soldOutToday: "yes" });
    expect(res.status).toBe(400);
  });

  it("404s for an unknown product", async () => {
    const res = await request(createApp())
      .patch("/products/99999999-9999-9999-9999-999999999999/sold-out")
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .send({ soldOutToday: true });
    expect(res.status).toBe(404);
  });
});

describe("GET /products/all", () => {
  it("requires an admin token", async () => {
    expect((await request(createApp()).get("/products/all")).status).toBe(401);
  });

  it("includes hidden products", async () => {
    const res = await request(createApp())
      .get("/products/all")
      .set("Authorization", `Bearer ${issueAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(2);
  });
});

describe("PUT /products/:id/image", () => {
  const url = `/products/${products[0].id}/image`;
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

  it("requires an admin token", async () => {
    const res = await request(createApp()).put(url).set("Content-Type", "image/jpeg").send(jpeg);
    expect(res.status).toBe(401);
  });

  it("rejects anything that isn't a JPEG, PNG or WebP", async () => {
    const res = await request(createApp())
      .put(url)
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .set("Content-Type", "text/plain")
      .send("not an image");
    expect(res.status).toBe(415);
    expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it("uploads the photo, saves its URL and removes the old one", async () => {
    const res = await request(createApp())
      .put(url)
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .set("Content-Type", "image/jpeg")
      .send(jpeg);
    expect(res.status).toBe(200);
    expect(uploadProductImage).toHaveBeenCalledWith(expect.any(Buffer), "cookies.jpg", "image/jpeg");
    expect(res.body.product.imageUrl).toContain("new-cookies.jpg");
    expect(deleteProductImage).toHaveBeenCalledWith(expect.stringContaining("old.jpg"));
  });

  it("404s for an unknown product", async () => {
    const res = await request(createApp())
      .put("/products/99999999-9999-9999-9999-999999999999/image")
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .set("Content-Type", "image/png")
      .send(jpeg);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /products/:id/image", () => {
  it("clears the photo", async () => {
    const res = await request(createApp())
      .delete(`/products/${products[0].id}/image`)
      .set("Authorization", `Bearer ${issueAdminToken()}`);
    expect(res.status).toBe(200);
    expect(setProductImageUrl).toHaveBeenLastCalledWith(products[0].id, null);
    expect(res.body.product.imageUrl).toBeNull();
  });
});

describe("unknown routes", () => {
  it("404s with the standard error envelope", async () => {
    const app = createApp();
    const res = await request(app).get("/not-a-real-route");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errors: expect.any(Array) });
  });
});
