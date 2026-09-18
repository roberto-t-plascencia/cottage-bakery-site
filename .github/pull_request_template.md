## What changed and why

<!-- The "why" matters more than the "what" — the diff already shows what
changed. If this is a non-obvious decision, consider whether it deserves
an ADR (docs/adr/) instead of just this description. -->

## How was this tested?

<!-- New/updated unit tests? Manually verified locally? Both? If a change
to src/lib/ has no test changes, say why (see docs/TESTING_STRATEGY.md
for what's expected to be covered vs. not). -->

## Checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`
      all pass locally
- [ ] Any new business/legal rule is enforced server-side, not only in
      the UI (see `src/lib/orders.ts` for the existing pattern)
- [ ] Docs updated if this changes how the app is set up, deployed, or
      architected (`README.md`, `docs/ARCHITECTURE.md`, or a new ADR)
