import { productSeed } from "../src/data/products.seed";
import { upsertProductBySlug } from "../src/lib/repositories/products";

async function main() {
  for (const product of productSeed) {
    await upsertProductBySlug({ ...product, imageUrl: null });
  }
  console.log(`Seeded ${productSeed.length} products.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
