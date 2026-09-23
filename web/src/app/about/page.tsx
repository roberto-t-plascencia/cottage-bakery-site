import { bakeryConfig } from "@/lib/config";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">About</h1>
      <div className="prose prose-neutral mt-6 dark:prose-invert">
        <p>
          Mission Valley Home Bakers began decades before the first brick was
          laid or the first hole was dug. Long before opening our doors,
          Roberto Sr. and his wife, Violeta, were already building something
          special in their kitchen.
        </p>
        <p>
          What began as a shared passion for baking soon became a lifelong
          commitment to learning, experimenting, and perfecting an ancient
          craft. Through countless recipes, adjustments, and late nights spent
          baking, we developed our own approach—one rooted in patience,
          quality ingredients, and a genuine love for what we do.
        </p>
        <p>
          As our skills and passion grew, so did our dream. We realized that
          baking was more than a hobby; it was a way to bring people together
          and create something meaningful. Eventually, we decided to turn our
          passion into a way of life and establish a baking business built on
          tradition, hard work, and homemade flavor.
        </p>
        <p>
          That dream became Mission Valley Home Bakers—a family-inspired
          business dedicated to sharing carefully crafted baked goods with our
          community. Every item we make carries a piece of our journey: the
          years of practice, the lessons learned, and the love that first
          brought us into the kitchen.
        </p>
        <p>
          {bakeryConfig.businessName} is a licensed Class A Cottage Food
          Operation, registered with {bakeryConfig.county} County. Everything
          is baked to order in a home kitchen in {bakeryConfig.city}, CA.
        </p>
        <h2>How ordering works</h2>
        <ol>
          <li>Browse the menu and add items to your order.</li>
          <li>
            Choose pickup, local delivery, or in-state shipping, and pick a
            ready date (orders need lead time for baking).
          </li>
          <li>
            Choose how to pay: pay online now by credit/debit card or PayPal
            (no PayPal account needed), or pay with cash, Venmo, or Zelle at
            pickup, at delivery, or before shipping.
          </li>
          <li>
            Submit your order. You&rsquo;ll get a confirmation email, and
            we&rsquo;ll contact you to confirm the details.
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
