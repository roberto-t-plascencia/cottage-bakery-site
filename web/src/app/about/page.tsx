import { bakeryConfig } from "@/lib/config";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">About</h1>
      <div className="prose prose-neutral mt-6 dark:prose-invert">
        <p>
          <strong>
            {bakeryConfig.businessName} is named for the heart of our kitchen:
            Violeta.
          </strong>
        </p>
        <p>
          Long before there was a menu or a website, Violeta was baking. For
          decades she and her husband, Roberto Sr., worked side by side in
          their kitchen, trying recipes, adjusting them, and trying them again
          until they were just right. Some became family favorites; every one
          of them taught her something.
        </p>
        <p>
          Violeta&rsquo;s way of baking is simple: be patient, use good
          ingredients, and never rush the dough. You can taste it in our
          naturally leavened masa madre breads, which take a full day to
          ferment, and in every batch that comes out of her oven.
        </p>
        <p>
          As friends and family kept asking for &ldquo;Violeta&rsquo;s
          bread,&rdquo; our skills and passion grew, and so did our dream. We
          realized that baking was more than a hobby; it was a way to bring
          people together and create something meaningful. Eventually, we
          decided to turn our passion into a way of life and establish a
          baking business built on tradition, hard work, and homemade flavor.
        </p>
        <p>
          That dream became {bakeryConfig.businessName}&mdash;a
          family-inspired business built on her recipes and dedicated to
          sharing carefully crafted baked goods with our community. Every item
          we make carries a piece of our journey: the years of practice, the
          lessons learned, and the love that first brought Violeta into the
          kitchen. And the violet in our logo? That one is for her.
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
            ready date. Same-day orders are open until 8 PM for pickup and
            9:30 PM for local delivery.
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
          Made in a Home Kitchen. {bakeryConfig.businessName} is a Class A
          Cottage Food Operation (CFO) registered with {bakeryConfig.county}{" "}
          County Environmental Health, registration #
          {bakeryConfig.registrationNumber}. A CFO is a business run from the
          private home where the operator lives, and it may only make foods
          California classifies as &ldquo;non-potentially hazardous&rdquo;:
          foods that don&rsquo;t need refrigeration to stay safe. The
          California Department of Public Health keeps the list of approved
          foods.
        </p>
        <p>
          As a Class A CFO, we sell only directly to customers within
          California. We don&rsquo;t sell through stores, restaurants, or
          other resellers, and we can&rsquo;t ship outside the state.
        </p>
      </div>
    </div>
  );
}
