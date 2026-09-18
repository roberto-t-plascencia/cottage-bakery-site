import { bakeryConfig } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-black/60 dark:text-white/60">
        <p>
          {bakeryConfig.businessName} · {bakeryConfig.city}, CA {bakeryConfig.zip}
        </p>
        <p className="mt-1">
          Made in a home kitchen under California&rsquo;s Cottage Food Program.
          CFO Registration #{bakeryConfig.registrationNumber}, {bakeryConfig.county}{" "}
          County.
        </p>
        <p className="mt-1">
          <a href={`mailto:${bakeryConfig.contactEmail}`} className="hover:underline">
            {bakeryConfig.contactEmail}
          </a>{" "}
          · {bakeryConfig.contactPhone}
        </p>
      </div>
    </footer>
  );
}
