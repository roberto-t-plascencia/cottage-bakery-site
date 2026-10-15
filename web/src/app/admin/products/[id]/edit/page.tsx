import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";
import { AdminProductForm } from "@/components/AdminProductForm";

export const metadata = { title: "Admin · Edit product" };
export const dynamic = "force-dynamic";

// Same auth pattern as ../../new/page.tsx.
export default async function EditProductPage(props: PageProps<"/admin/products/[id]/edit">) {
  const { id } = await props.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) redirect("/admin/login");

  let products;
  try {
    products = await apiClient.listAllProducts(token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/admin/login");
    throw err;
  }
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  const categories = [...new Set(products.map((p) => p.category))].sort();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin" className="text-sm text-black/60 hover:underline dark:text-white/60">
        ← Back to admin
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Edit {product.name}</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Changes show on the menu right away. If you change the ingredients,
        allergens or net weight, update the printed label to match. Orders
        already placed keep the price they were placed at.
      </p>
      <AdminProductForm
        categories={categories}
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          priceCents: product.priceCents,
          category: product.category,
          allergens: product.allergens,
          ingredients: product.ingredients,
          netWeight: product.netWeight,
          isActive: product.isActive,
        }}
      />
    </div>
  );
}
