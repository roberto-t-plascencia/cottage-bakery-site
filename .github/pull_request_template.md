## What changed and why

<!-- The "why" matters more than the "what" — the diff already shows what
changed. If this is a non-obvious decision, consider whether it deserves
an ADR (docs/adr/) instead of just this description. -->

## Which service(s)?

<!-- web/, api/, both, or neither (docs/specs/CI only). A change to both
in one PR is expected when it's a contract change (specs/openapi.yaml)
— see specs/ENGINEERING_RULES.md. -->

## How was this tested?

<!-- New/updated unit or route tests? Manually verified locally (both
services running via docker compose, or `npm run dev` in each)? If a
change to api/src/lib/ has no test changes, say why (see
specs/ENGINEERING_RULES.md "Testing bar" for what's expected to be
covered vs. not). -->

## Checklist

- [ ] In each service this PR touches: `npm run lint`, `npm run
      typecheck`, `npm test`, and `npm run build` all pass locally
- [ ] If this changes a request/response shape, `specs/openapi.yaml` was
      updated and `npm run gen:types` was re-run in **both** services
      (CI's `spec-drift` job checks this, but catching it locally is
      faster)
- [ ] Any new business/legal rule is enforced in `api/`, not only in the
      `web/` UI (see `api/src/lib/orders.ts` for the existing pattern)
- [ ] Docs updated if this changes how the app is set up, deployed, or
      architected (`README.md`, `docs/ARCHITECTURE.md`,
      `specs/ENGINEERING_RULES.md`, or a new ADR)
