import { bakeryConfig } from "@/lib/config";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">About</h1>
      <div className="prose prose-neutral mt-6 dark:prose-invert">
        <p>
          {bakeryConfig.businessName} is a licensed Class A Cottage Food
          Operation, registered with {bakeryConfig.county} County. Everything
          is baked to order in a home kitchen in {bakeryConfig.city}, CA —
          replace this paragraph with your own story.
        </p>
        <h2>How ordering works</h2>
        <ol>
          <li>Browse the menu and add items to your order.</li>
          <li>
            Choose pickup, local delivery, or in-state shipping, and pick a
            ready date (orders need lead time for baking).
          </li>
          <li>
            Submit the order request — you&rsquo;ll be contacted to confirm
            details and arrange payment (cash, Venmo, or Zelle).
          </li>
        </ol>
        <h2>Cottage food disclosure</h2>
        <p>
          This is a home-based food business operating under California&rsquo;s
          Cottage Food Program (AB 1616). It is registered, not permitted or
          inspected the way a commercial food facility is.{" "}
          <strong>
            Exact required disclosure language should be confirmed with{" "}
            {bakeryConfig.county} County Environmental Health before launch
          </strong>{" "}
          — replace this section with the wording your county provides.
        </p>
      </div>
    </div>
  );
}
