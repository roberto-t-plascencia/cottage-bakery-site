/**
 * Domain types for this app — but no longer hand-written here. They're
 * derived from the generated OpenAPI schema (src/lib/api-schema.generated.ts,
 * from ../../specs/openapi.yaml via `npm run gen:types`), which is in turn
 * a hand-kept mirror of api/'s actual response shapes (see
 * ../../specs/ENGINEERING_RULES.md). This file exists so the rest of the
 * app can `import type { Product, Order } from "@/lib/types"` instead of
 * reaching into `components["schemas"][...]` everywhere — a thin,
 * friendlier re-export, not a second source of truth.
 *
 * Never hand-edit api-schema.generated.ts — run `npm run gen:types`
 * after api/'s ../specs/openapi.yaml changes.
 */
import type { components } from "./api-schema.generated";

export type Product = components["schemas"]["Product"];
export type FulfillmentMethod = components["schemas"]["FulfillmentMethod"];
export type OrderStatus = components["schemas"]["OrderStatus"];
export type Order = components["schemas"]["Order"];
export type OrderItemWithProduct = components["schemas"]["OrderItemWithProduct"];
export type OrderWithItems = components["schemas"]["OrderWithItems"];
export type CreateOrderRequest = components["schemas"]["CreateOrderRequest"];
