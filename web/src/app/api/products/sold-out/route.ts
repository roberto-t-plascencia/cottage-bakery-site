import { NextResponse } from "next/server";
import { apiClient } from "@/lib/apiClient";

// The checkout form asks this which items are sold out today, so it can
// start the date picker at tomorrow instead of letting the order fail.
export const dynamic = "force-dynamic";

export async function GET() {
  const products = await apiClient.listProducts();
  return NextResponse.json({
    products: products
      .filter((p) => p.soldOutToday)
      .map((p) => ({ id: p.id, name: p.name })),
  });
}
