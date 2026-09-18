import { NextResponse } from "next/server";
import { findProductsByIds } from "@/lib/repositories/products";
import { createOrder } from "@/lib/repositories/orders";
import { validateOrder, type FulfillmentMethod } from "@/lib/orders";

type OrderRequestBody = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  fulfillmentAddress?: string;
  requestedDate: string;
  notes?: string;
  items: { productId: string; quantity: number }[];
};

export async function POST(request: Request) {
  let body: OrderRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errors: ["Request body must be valid JSON."] },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ errors: ["Cart is empty."] }, { status: 400 });
  }

  // Prices are looked up server-side from the database — never trusted from
  // the request body. Without this, a modified client request could submit
  // arbitrary prices; this is the one line standing between "checkout form"
  // and "anyone can order a $0.01 wedding cake."
  const productIds = body.items.map((i) => i.productId);
  const products = findProductsByIds(productIds);
  const productById = new Map(products.map((p) => [p.id, p]));

  const missing = productIds.filter((id) => !productById.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { errors: ["One or more items are no longer available. Please refresh the menu."] },
      { status: 400 }
    );
  }

  const cartLines = body.items.map((item) => {
    const product = productById.get(item.productId)!;
    return {
      productId: product.id,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
    };
  });

  const requestedDate = new Date(body.requestedDate);
  if (Number.isNaN(requestedDate.getTime())) {
    return NextResponse.json(
      { errors: ["Requested date is invalid."] },
      { status: 400 }
    );
  }

  const validation = validateOrder({
    customerName: body.customerName ?? "",
    customerEmail: body.customerEmail ?? "",
    customerPhone: body.customerPhone ?? "",
    fulfillmentMethod: body.fulfillmentMethod,
    fulfillmentAddress: body.fulfillmentAddress,
    requestedDate,
    notes: body.notes,
    items: cartLines,
  });

  if (!validation.valid) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const subtotalCents = cartLines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0
  );

  const order = createOrder({
    customerName: body.customerName,
    customerEmail: body.customerEmail,
    customerPhone: body.customerPhone,
    fulfillmentMethod: body.fulfillmentMethod,
    fulfillmentAddress: body.fulfillmentAddress || null,
    requestedDate: requestedDate.toISOString(),
    notes: body.notes || null,
    subtotalCents,
    items: cartLines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
    })),
  });

  return NextResponse.json({ order }, { status: 201 });
}
