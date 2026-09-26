import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiClient, ApiError } from "@/lib/apiClient";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/auth";
import { AdminNewProductForm } from "@/components/AdminNewProductForm";

export const metadata = { title: "Admin · Add product" };
export const dynamic = "force-dynamic";

// Same auth pattern as ../../page.tsx: proxy.ts only checks the cookie
// exists; api/ rejecting the token is what sends an expired session back
// to the login page.
export default async function NewProductPage() {
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
  const categories = [...new Set(products.map((p) => p.category))].sort();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin" className="text-sm text-black/60 hover:underline dark:text-white/60">
        ← Back to admin
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Add product</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        The ingredients, allergens and net weight appear on the menu and must
        match the product&apos;s printed cottage food label.
      </p>
      <AdminNewProductForm categories={categories} />
    </div>
  );
}
