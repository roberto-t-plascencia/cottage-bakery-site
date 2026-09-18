import { productSeed } from "../src/data/products.seed";
import { upsertProductBySlug } from "../src/lib/repositories/products";

for (const product of productSeed) {
  upsertProductBySlug({ ...product, imageUrl: null });
}

console.log(`Seeded ${productSeed.length} products.`);
