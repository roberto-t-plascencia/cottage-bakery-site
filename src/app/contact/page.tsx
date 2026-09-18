import { bakeryConfig } from "@/lib/config";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Contact</h1>
      <p className="mt-4 text-black/70 dark:text-white/70">
        For custom orders, questions, or anything else, reach out directly:
      </p>
      <dl className="mt-6 space-y-2">
        <div className="flex gap-2">
          <dt className="font-medium">Email</dt>
          <dd>
            <a
              href={`mailto:${bakeryConfig.contactEmail}`}
              className="hover:underline"
            >
              {bakeryConfig.contactEmail}
            </a>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Phone</dt>
          <dd>{bakeryConfig.contactPhone}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Instagram</dt>
          <dd>{bakeryConfig.instagramHandle}</dd>
        </div>
      </dl>
    </div>
  );
}
