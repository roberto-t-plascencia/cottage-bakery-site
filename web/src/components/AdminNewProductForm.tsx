"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dollarsToCents } from "@/lib/money";

type Form = {
  name: string;
  description: string;
  price: string;
  category: string;
  allergens: string;
  ingredients: string;
  netWeight: string;
  isActive: boolean;
};

const EMPTY: Form = {
  name: "",
  description: "",
  price: "",
  category: "",
  allergens: "",
  ingredients: "",
  netWeight: "",
  isActive: false,
};

export function AdminNewProductForm({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = dollarsToCents(form.price);
    if (priceCents === null) {
      setErrors(["Enter the price in dollars, like 5.99."]);
      return;
    }

    setSaving(true);
    setErrors([]);
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        priceCents,
        category: form.category,
        allergens: form.allergens,
        ingredients: form.ingredients,
        netWeight: form.netWeight,
        isActive: form.isActive,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrors(data.errors ?? ["Couldn't save — try again."]);
      setSaving(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {errors.length > 0 && (
        <ul className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <Field label="Name">
        <input required maxLength={80} value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
      </Field>

      <Field label="Description" hint="One or two sentences for the menu.">
        <textarea
          required
          maxLength={500}
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="input"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Price">
          <input
            required
            inputMode="decimal"
            placeholder="5.99"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Menu section" hint="Pick one or type a new one.">
          <input
            required
            maxLength={40}
            list="product-categories"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="input"
          />
          <datalist id="product-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field
        label="Ingredients"
        hint="As on the label: in order by weight, with sub-ingredients in parentheses."
      >
        <textarea
          required
          maxLength={2000}
          rows={4}
          value={form.ingredients}
          onChange={(e) => set("ingredients", e.target.value)}
          className="input"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Contains (allergens)"
          hint='e.g. "wheat, milk, eggs". Name the exact tree nut (walnuts). Write "none" if there are none.'
        >
          <input
            required
            maxLength={200}
            value={form.allergens}
            onChange={(e) => set("allergens", e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Net weight" hint='As on the label, e.g. "12 oz (340 g)".'>
          <input
            required
            maxLength={60}
            value={form.netWeight}
            onChange={(e) => set("netWeight", e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="mt-1"
        />
        <span>
          Show on the menu right away
          <span className="block text-black/50 dark:text-white/50">
            Leave unchecked to add a photo first, then use &ldquo;Show on menu&rdquo; in the admin list.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-amber-700 px-6 py-2 font-medium text-white hover:bg-amber-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Add product"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-black/50 dark:text-white/50">{hint}</span>}
    </label>
  );
}
