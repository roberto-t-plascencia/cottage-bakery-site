import { createApp } from "../src/app";

/**
 * Vercel serverless entrypoint. Vercel serves files in this directory as
 * functions, and `../vercel.json` rewrites every incoming path to this
 * one so the Express router — not Vercel's filesystem routing — decides
 * what handles a request. Express sees the original path, so the routes
 * registered in `src/app.ts` (`/products`, `/orders`, `/admin`) work
 * unchanged.
 *
 * `src/index.ts` is still the entrypoint for Docker Compose and local
 * `npm run dev`: it calls the same `createApp()` and binds a real port.
 * This file deliberately does not, because a serverless function is
 * handed a request rather than listening for one. Keeping both means the
 * app itself stays host-agnostic — see docs/adr/0004-service-boundary.md.
 */
export default createApp();
