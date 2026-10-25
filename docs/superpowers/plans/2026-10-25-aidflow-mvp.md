# AidFlow MVP implementation plan

> **For agentic workers:** Use superpowers:executing-plans task by task.

**Goal:** Deliver the approved AidFlow Testnet donation vertical slice.
**Architecture:** Extend the existing Next.js App Router app. PostgreSQL/pg stores
Auth.js sessions, reviewed campaigns, immutable payment configurations and locked
orders. Server-only Paiflow prepares/submits, Freighter signs the original body,
and receipt verification checks native token transfers before counting success.
**Tech stack:** Existing Next.js/React/SDK 0.2.0, PostgreSQL raw SQL, Auth.js Google.
**Spec:** ../../../AidFlow_Codex_Implementation_Plan.md

## Global constraints

- Fixed 1 XLM = 10000000 stroops, Testnet only, integer string/bigint arithmetic.
- Exact 9000000/1000000 stroop payouts to distinct trusted wallets.
- No token, private key, signed envelope or private file in browser logs/public data.
- Session ownership on all financial requests. Server-only SDK in lib/paiflow.ts.
- Preserve original preparation/hash/envelope and correlation IDs. No replacements.
- Only the configured seeded fictional campaign may activate payments.
- User directed proceeding to app implementation with separate hosted proof deferred.

## Review focus

Concurrent requests/crashes; forged sessions/origins/financial fields; changed signed
bodies; payout events with percentages but no transfer proof; old orders after pause.

## Task 1: durable database and trusted campaign seed

Files: migrations/001_aidflow.sql; lib/db.ts; scripts/db.mjs; scripts/local-db.ps1;
tests/database.test.ts. Interfaces: database(), withTransaction(fn), migration SQL.
- [x] Write constraints/integration tests; run failing before schema exists.
- [x] Implement UUID Auth.js adapter schema, campaign reviews/configs, original
      preparations, signed envelopes, immutable order snapshots, evidence and audit.
- [x] Add idempotent migrate/seed scripts; seed no confirmed donations.
- [x] Apply migrations locally and verify uniqueness/amount/config constraints.

## Task 2: Google authentication and campaign governance

Files: auth.ts; lib/identity.ts; lib/campaigns.ts; app/api/auth/[...nextauth]/route.ts;
app/api/campaigns/route.ts; app/api/admin/campaigns/[id]/route.ts; tests/governance.test.ts.
Interfaces: currentUser(), requireUser(), requireAdmin(), submitCampaign(), reviewCampaign().
- [x] Test unauthenticated/USER/admin access and invalid review/activation.
- [x] Use inspected @auth/pg-adapter schema, database sessions and safe redirects.
- [x] Require verified Google email; no automatic public ADMIN assignment.
- [x] Parameterized campaign queries; review audit; only verified seed activation.

## Task 3: durable original payment lifecycle and receipt verifier

Files: lib/orders.ts; lib/receipt.ts; lib/chain-proof.ts; lib/paiflow.ts;
app/api/donations/route.ts; app/api/donations/[id]/route.ts; tests/orders.test.ts;
tests/receipt.test.ts. Interfaces: createOrder(), prepareOrder(), submitOrder(), reconcileOrder().
- [x] Test owner/campaign/fixed pricing, duplicate prepare/submit, tampered envelopes,
      delayed/missing/mismatched payout proof and pause-safe reconciliation.
- [x] Commit PREPARING/SUBMITTING evidence before external calls. Lock rows and
      never retry uncertain preparations or replace signed envelopes.
- [x] Save exact SDK preparation before returning XDR; check source/body/network.
- [x] Reconcile original hash with SDK transaction/events pagination and actual
      native transfer proof. SUCCESS requires every binding and exact two payouts.
- [x] Public progress sums only verified durable SUCCESS orders.

## Task 4: responsive campaign, donor and admin experience

Files: app/page.tsx; app/campaigns/[slug]/page.tsx; app/campaigns/[slug]/donate/page.tsx;
app/donations/[id]/page.tsx; app/dashboard/page.tsx; app/admin/page.tsx;
components/donation-checkout.tsx; app/globals.css.
- [x] Mission + fictional campaign + XLM-only totals; honest configuration states.
- [x] Server-protected donor/admin pages, one submission form and review controls.
- [x] Wallet connection, explicit authorization, Web Locks/local recovery plus durable
      server evidence, manual original payment checks. No automatic submission.
- [x] Private receipt with exact wallet payouts and safe Testnet explorer link.
- [x] Preserve starter recovery in an isolated legacy route, auth-gate old APIs.

## Task 5: verification and operational handoff

- [x] Run typecheck, full tests, production build and browser bundle scan.
- [x] Review full change for finance/auth/data invariants; fix important findings.
- [x] Render in Chrome and verify anonymous controls; responsive CSS implemented, narrow mobile viewport test remains below.
- [x] Document migrate/seed/start/admin bootstrap/ngrok/backup commands and all
      untested external actions. Keep uploads deferred and local private storage.

## External acceptance gates (not completed)

- [ ] Live Google OAuth and browser session/callback testing.
- [ ] Authenticated AidFlow Testnet payment and private receipt rehearsal.
- [ ] Assigned ngrok HTTPS hostname, Google callback, second device/network.
- [ ] Separate hosted-page transaction evidence (deferred by user).
- [ ] Mobile viewport visual check; no mobile wallet compatibility claimed.
