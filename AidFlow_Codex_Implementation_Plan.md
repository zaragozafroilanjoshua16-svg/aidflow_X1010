# AidFlow — Codex Implementation Plan

**Project:** AidFlow — international disaster-relief fundraising (hackathon prototype)  
**Plan status:** Approved for implementation; application not yet built by this document  
**Date:** 2026-10-25 (Philippines)  
**Developer:** One developer using Codex  
**Time budget:** Maximum 24 hours  
**Execution strategy:** **Payment first** — prove Paiflow's hosted-page payment, then prove the *unchanged* starter's SDK payment, and only then customize it into AidFlow.

> **Codex — start here:** This is an execution document, not a brainstorming prompt. Read the existing repository's `README.md`, `AGENTS.md`, `llms.md`, and payment source files **before modifying code**. Execute milestones sequentially; demonstrate a runnable app at every checkpoint. Do not invent external credentials, confirmed blockchain receipts, or success states. Report blockers precisely. **Do not add PayMongo, credit-card payments, fiat payments, fake checkouts, or multi-currency donation totals.** The hackathon MVP is **XLM on Stellar Testnet only**.

---

## 0. Definition of the MVP (scope freeze)

AidFlow is a **mobile-first Next.js web app** where users sign in with Google, view disaster relief campaigns, submit campaigns for manual approval, and donate **native testnet XLM** to an approved campaign. Paiflow automatically distributes each donation to two verified, distinct recipient wallets:

- **90%** → approved beneficiary / relief organization wallet.
- **10%** → approved logistics / operations recipient wallet.
- For the **first live demonstration**, use a **fixed 1 XLM donation** to exactly match the supplied Paiflow guide and starter: **0.9 XLM** and **0.1 XLM**, plus network fees. Arbitrary donation amounts are a future enhancement.
- **No custody:** AidFlow itself does not hold donor private keys and does not redirect donations through an app-controlled wallet. The two receiving wallets are managed by the respective demo recipients.
- **No real donations:** both donor funds and payouts use valueless **Stellar Testnet** XLM. Any illustrative relief organization, identity, disaster claim, verification evidence, and fundraising goal must be clearly marked **DEMO / FICTIONAL**.
- **No fiat provider in this MVP:** remove conventional checkout tabs, PayMongo configuration, webhook endpoints, tables, API keys, sandbox progress bars, and any promises of a working fiat gateway. You may mention other methods on a future-roadmap page, but do **not** show a payment button for them.

### P0 — hard requirements (prioritize above visual polish)

1. The official Paiflow hosted page successfully sends **1 testnet XLM** and the two **correct payouts** are independently checked.
2. The original official Next.js starter successfully runs and sends an SDK-driven **1 testnet XLM** payment with Freighter signing; independently confirm the two payouts.
3. AidFlow extends the starter with **PostgreSQL-backed donation orders**, a saved original preparation, signed envelope, transaction hash, explicit order/deployment bindings, and safe reconciliation/recovery.
4. A responsive **demo campaign page** lets an authenticated donor start an authorized XLM donation.
5. An order is **SUCCESS only after** final transaction success and full matching recipient payout verification.
6. No private wallet keys, Paiflow tokens, database credentials, or sensitive documents reach the browser, public repo, or logs.

### P1 — lean AidFlow functionality

- Google OAuth using Auth.js; all donors and campaign submitters must sign in.
- One pre-approved, **blockchain-active** fictional disaster campaign with a verified deployment config; other users may submit draft campaigns, but those cannot receive payments until properly verified/configured.
- Basic campaign submission, manual admin **approve / reject / request changes**, separate approval and payment-activation status.
- Minimal donor donation history and receipt; minimal admin review view.
- Public campaign progress **only in verified testnet XLM**, clearly marked as simulated activity. Separately show an informational humanitarian budget, if desired; never convert testnet XLM into fiat or imply it raised real money.
- Local Next.js + PostgreSQL on Windows, exposed as needed via **ngrok assigned HTTPS domain**.

### P2 — first features to cut when blocked

- Multi-step campaign wizard → one validated form.
- Detailed impact report moderation → one simple approved update or defer.
- Uploading evidence UI → defer or use synthetic sample evidence metadata until the core payment flow works. When implemented, use **private local filesystem + PostgreSQL metadata**.
- Advanced filtering, charts, automated KYC, messaging, email notifications, multi-campaign contract deployment, mobile WalletConnect, arbitrary donation amounts, escrow, fiat conversion and all production payments → **out of scope**.

### Stop rules

- **Never** replace a working secure payment flow with a mock checkout to appear complete.
- If a payment has an uncertain outcome, preserve and reconcile the **original** preparation/hash/envelope. Never auto-prepare or auto-submit a replacement.
- At **hour 20**, stop adding features and freeze for tests, backups, and live demo rehearsal.
- If the external OAuth or Paiflow setup is blocked, report what actually works; don't bypass authentication or manufacture verified receipts.

---

## 1. Sources and priority of truth

Use these documents and live code in this order:

1. **Attached `paiflow-guide(1).pdf`**, updated Oct 17, 2026: Part 1 (pages 2–5) testnet wallets, Google access, On Receive → Split, hosted payment; Part 2 (pages 6–14) developer token, SDK v0.2.0, preparation, signing, submission, verification and recovery.
2. **Attached `setup-guide(2).pdf`**, updated Oct 23, 2026: Windows Git Bash, Node **22.22.2**, pnpm **10.4.1**, cloning/running starter. The guide's optional Engr/Kimi setup is **not required** to use Codex.
3. Official starter repository: <https://github.com/artisam-paiflow/paiflow-hackathon-starter>. At plan-writing time the starter uses root-level `app/`, `components/`, `lib/`, SDK **`@paiflow/sdk@0.2.0`**, and Next.js 15. Preserve its installed version and lockfile unless a real compatibility problem requires a reviewed change.
4. Read the starter's **`README.md`, `AGENTS.md`, `llms.md`, current source and tests**. If any implementation detail here conflicts with the live starter's working safe approach, preserve the documented security invariant and explain the adjustment.
5. Organizer-specific judging and submission rules were **not provided** in the two PDFs. Do not fabricate a scoring rubric, deadlines, or delivery requirements.

**Existing starter modules to inspect before changing:**

- `lib/paiflow.ts` — SDK and backend configuration.
- `app/api/pay/route.ts` — payment operations.
- `app/api/integration/route.ts` — non-secret integration status.
- `lib/wallet.ts` — Freighter signing and connection.
- `lib/recovery.ts` — original transaction and browser recovery.
- `lib/transaction.ts` — transaction hashing / unchanged-envelope validation.
- `components/starter-app.tsx` — runnable browser UI.

**Do not delete or overwrite the starter's `AGENTS.md`.** Extend it with AidFlow-specific rules after reading it.

---

## 2. Phase 0 — Paiflow hosted-page payment FIRST

**Target time: first 1–3 hours. This phase is done manually in Paiflow/Freighter; Codex may document but must not pretend to execute wallet approvals.**

The user has confirmed that **Paiflow account access and funded Stellar Testnet wallets already exist**. The starter has **not** yet been cloned or run.

### 2.1 Confirm wallet assignments

Prepare/label these funded public `G...` addresses (never paste secret seeds into code or chats):

| Wallet | Role | Signing / receipt |
| --- | --- | --- |
| Customer / Donor | Pays 1 XLM + network fee | Signs transaction with Freighter |
| Relief recipient | Receives 0.9 XLM | No payout signature required |
| Logistics recipient | Receives 0.1 XLM | No payout signature required |
| Deployer | Signs flow deployment; may also be relief recipient | Pays deployment fee |

The relief and logistics addresses **must differ**. Confirm every wallet is on **Stellar Testnet**.

### 2.2 Build the payment flow

In Paiflow: **On Receive → Split**, **native XLM**, two percentage recipients **90%** and **10%** (total 100%). Remove unrelated blocks and demo addresses. Review the readable deployment preview, sign with the intended Testnet deployer, and wait for **CONFIRMED**.

### 2.3 Hosted-page verification

Use the deployed hosted payment page (`/trigger/YOUR_DEPLOYMENT_UUID` on the Paiflow site). Connect the donor wallet, pay **1 XLM**, authorize in Freighter, and verify **0.9 XLM** and **0.1 XLM** transfer evidence in Paiflow and/or Stellar Testnet explorer.

Save **non-secret proof** locally in a private developer note:

- Deployment **UUID** (not the flow ID and not the Stellar `C...` contract address).
- Network: **Testnet**; asset: **native XLM**.
- The two recipient **public** wallet addresses and their intended share.
- Hosted payment **transaction hash** and independently checked payout evidence.
- Whether the flow is confirmed and active.

**Phase 0 exit gate:** One authorized 1 XLM hosted payment is **confirmed with both exact payouts**. If blocked, fix flow/network/funding before custom app work.

---

## 3. Phase 1 — Run and prove the official starter unchanged

**Target: next 2–3 hours. Running the unchanged starter is the first runnable application deliverable.**

### 3.1 Windows Git Bash commands

```bash
# Recheck runtime
node --version    # expect v22.22.2 or compatible 22.x >=22.22.2 and <23
pnpm --version    # guide: 10.4.1
git --version

# Start from a NEW folder; never clone into an existing unrelated repo
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/artisam-paiflow/paiflow-hackathon-starter.git aidflow
cd aidflow

pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open **`http://localhost:3000`**. Payment controls being disabled before token/deployment configuration is expected. Stop with **Ctrl+C**.

Run baseline checks before edits:

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/check-browser-bundle.mjs
```

If any check fails on the original starter, note the error and fix the cause, not via disabling tests. `pnpm audit` is an optional additional security audit, as documented by the starter.

### 3.2 Configure Paiflow backend

Create a **Read and operate** developer token that is explicitly authorized for the **confirmed deployment**. Do not mistake the Paiflow signup access code for the SDK token. In `.env.local`:

```dotenv
PAIFLOW_BASE_URL=https://beta.app.paiflow.xyz
PAIFLOW_DEPLOYMENT_ID=YOUR_CONFIRMED_DEPLOYMENT_UUID
PAIFLOW_API_TOKEN=YOUR_PRIVATE_PFD_OR_PFK_TOKEN
```

Never prefix the token with `NEXT_PUBLIC_`. Restart the app. The SDK is server-only. The browser uses Freighter for signing, and never receives the developer token.

### 3.3 Starter SDK payment verification

Run the starter's fixed **1 XLM** payment, approve with the donor's Freighter wallet, inspect the signed and submitted transaction, then verify final SUCCESS **and the expected 0.9/0.1 payouts independently**. The starter's simple SUCCESS status **alone** is not sufficient proof of the split.

Keep the original transaction hash and request IDs. Resolve pending operations before switching from `localhost` to the ngrok origin: the original starter browser recovery is origin-scoped.

**Phase 1 exit gate:** Unmodified starter renders, required commands pass, SDK-driven transaction is confirmed, and both recipient payouts are independently verified. If credentials or transaction checks fail, do not skip this phase and start a new payment implementation.

### 3.4 Establish our repository baseline

After the starter has been verified, follow the Windows guide's fresh-clone workflow to make a new repository. **Run removal only inside this newly cloned `aidflow` directory after checking `pwd`.**

```bash
pwd
# In NEW ~/projects/aidflow only, when ready to detach the template history:
rm -rf -- .git
git init
git branch -M main
git add .
git commit -m "chore: initialize AidFlow from verified Paiflow starter"
```

Verify that `.env.local` and other secrets are ignored **before `git add`**. Add the user's own GitHub remote only after creating their repo. Keep starter attribution/license and integration notes; do not invent a remote URL.

---

## 4. Phase 2 — Backend foundation and PostgreSQL

**Target: 3–5 focused hours, adjusted based on actual Phase 0–1 progress.**

### 4.1 Constraints

- Stay in **Next.js App Router + TypeScript**. No separate NestJS service, Supabase, Prisma migration, or new custom smart contract.
- Use `pg` with parameterized SQL and **versioned raw SQL migrations**.
- Use PostgreSQL through **localhost**; pgAdmin 4 is an administrative GUI, not the app's backend.
- Create an application DB and appropriately scoped DB role, not the PostgreSQL superuser for the app.
- For Auth.js, use a compatible PostgreSQL adapter **after inspecting its actual schema**; do not guess adapter table layouts.
- UUIDs for app entity IDs; timestamps with time zone; `BIGINT`/exact numeric values for currency; SQL constraints and unique indexes on financial identifiers.

### 4.2 Minimal schema (implement only what the working MVP needs)

| Entity / table | Minimum fields / constraints |
| --- | --- |
| Auth.js account/session tables | Use the installed adapter's documented schema; add trusted user role or related role table. |
| `campaigns` | `id`, `creator_user_id`, `slug UNIQUE`, `title`, `description`, `disaster_type`, `country`, `region`, `beneficiary_type`, `is_demo`, `review_status`, `fundraising_status`, `requested_budget_currency`, `requested_budget_amount_minor`, `xlm_goal_stroops`, timestamps. |
| `campaign_reviews` | `id`, `campaign_id`, `admin_user_id`, `decision`, `reason`, timestamp; append history. |
| `campaign_payment_configs` | `id`, `campaign_id`, `version`, `network`, `asset`, `paiflow_deployment_uuid`, approved relief/logistics public addresses, shares `9000` / `1000` basis points, `ready`, activation timestamp. Approved versions must not be silently edited. |
| `donation_orders` | `id`, `donor_user_id`, `campaign_id`, `payment_config_id`, `status`, `amount_stroops`, `asset='XLM'`, `network='testnet'`, intended source wallet, idempotency key, immutable recipient/deployment snapshot, timestamps. |
| `blockchain_payments` | `order_id UNIQUE`, original SDK preparation metadata, unsigned XDR (access-restricted), network passphrase, signed XDR (access-restricted), original transaction hash UNIQUE where present, submission status and verified timestamp. |
| `payout_evidence` | `id`, `order_id`, `tx_hash`, recipient address, amount in stroops, asset, source evidence/event ID, unique evidence key. |
| `audit_logs` | Actor, action, affected entity, safe metadata, timestamp. No credentials or signed envelopes in logs. |
| `campaign_files` (P2) | File owner/campaign, randomized local storage key, type/size, access classification, timestamp. No raw bytes in PostgreSQL. |

If time is tight, use `campaigns`, `campaign_payment_configs`, `donation_orders`, `blockchain_payments`, `payout_evidence`, essential Auth.js tables, and one compact admin-review/audit table; defer the rest.

**Important integrity design:** A `campaign_payment_configs` row is a **versioned snapshot**. Each order permanently binds to its approved deployment UUID, network, asset, target recipients, 90/10 basis points, and 1 XLM amount. Campaign edits must never rewrite old orders. New active blockchain campaigns require separately confirmed/configured deployments; **do not reuse the one deployment for unrelated beneficiaries**.

### 4.3 Database migrations and connection

- Add `database/migrations/*.sql`, applied sequentially through a small script; maintain a `schema_migrations` tracking table.
- Parameterize all SQL. Use database transactions and row locks to serialize preparation/submission for one order.
- Add a single connection-pool module, reused by auth/campaign/payment code.
- Example local config (illustrative keys only):

```dotenv
DATABASE_URL=postgresql://YOUR_APP_USER:YOUR_PASSWORD@127.0.0.1:5432/aidflow
```

- Provide `pnpm db:migrate`, and optionally `pnpm db:seed` with fictional records; implement these scripts if referenced in the README.
- Seed **one demo campaign** as approved, with the actual verified deployment config from Phase 0; **do not seed fake blockchain transactions as confirmed**. Seed users/roles via trusted setup, not public role selection.

**Phase 2 exit gate:** Migrations apply to local PostgreSQL; app connects; one demo campaign can be fetched; database constraints reject duplicate transaction hashes and invalid orders; no secrets committed.

---

## 5. Phase 3 — Auth and lean campaign experience

### 5.1 Google OAuth only

- Auth.js + Google OAuth; **no username/password registration** and **no guest donations**.
- Public visitors can read active demo campaigns. Sign-in is required to submit campaigns, view personal donation history, and initiate all AidFlow payments.
- Only a **trusted** developer bootstrap/admin assignment process grants `ADMIN` (e.g., one explicit verified Google account assigned server-side). A public signup must always start as regular `USER`.
- Use secure cookie sessions, CSRF protections supplied by the selected auth library, server-side route authorization, and safe callback redirects.
- Setup must work on **one canonical public ngrok origin** in the final demo. Avoid starting a payment under localhost and attempting recovery under ngrok; cookies and browser storage are origin-specific.
- Do not activate a donation route until signed-in ownership checks are enforced on both prepare and submit/recovery.

Illustrative server-only credentials (follow current Auth.js docs for the installed version):

```dotenv
AUTH_SECRET=LONG_RANDOM_SECRET
AUTH_GOOGLE_ID=GOOGLE_OAUTH_CLIENT_ID
AUTH_GOOGLE_SECRET=GOOGLE_OAUTH_CLIENT_SECRET
AIDFLOW_PUBLIC_ORIGIN=https://YOUR_ASSIGNED_NGROK_DOMAIN
```

Authorized Google callback for standard Auth.js routing: `https://YOUR_ASSIGNED_NGROK_DOMAIN/api/auth/callback/google` — register the **exact real address** in Google Cloud. Don't put Google client secrets in `NEXT_PUBLIC_` variables. For a Google External Testing app, add authorized demo user accounts as necessary.

### 5.2 Lean app pages (no empty placeholders claiming functionality)

| Route (suggested) | Behavior |
| --- | --- |
| `/` | Short AidFlow mission + featured *fictional demo* disaster campaign, obvious XLM Testnet label. |
| `/campaigns/[slug]` | Campaign story, approved recipients (public wallet addresses/roles), verified XLM progress, 1 XLM Donate. |
| `/campaigns/[slug]/donate` | Auth-required, single XLM-only payment review; connected Freighter wallet, exact 90/10 payout details, network/fees, explicit authorization. |
| `/donations/[id]` | Auth-required private payment state, original hash, payout evidence and **Check original payment**. |
| `/dashboard` | Auth-required user's donations and submitted campaigns; a simple submission form/link. |
| `/admin` | Admin-only submission review, approve/reject/needs-changes, activate pre-verified payment config; cannot arbitrarily mark a payment SUCCESS. |

### 5.3 Campaign governance rules

- Anyone with a Google-authenticated AidFlow account can submit a campaign **for an individual/family or organization**.
- Approval requires an admin's manual review of fictional demo evidence, beneficiary consent, and recipient control. Do not claim automated or real-world KYC.
- `review_status`: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_CHANGES`, `APPROVED`, `REJECTED`.
- `fundraising_status`: `NOT_READY`, `ACTIVE`, `PAUSED`, `COMPLETED`.
- An **approved** campaign is not **active** until an authorized testnet payment deployment and correct recipients are verified. Do not activate the campaign merely because a public user supplied a `G...` address.
- During the first MVP, only the **one verified seeded campaign** may have `ACTIVE` blockchain checkout. Additional user-submitted campaigns can be reviewed, but enabling payments requires a separately approved/configured deployment.
- Campaign creator cannot edit approved recipient wallets or deployer UUID; admin changes require re-verification and a new configuration version.
- Suspension blocks **new preparations** but doesn't erase/reverse transactions already signed or broadcast; reconcile those original orders.

**Phase 3 exit gate:** Login works from the chosen origin; user can submit a campaign; admin can make an audited review decision; only the one correctly configured active campaign offers a live XLM checkout; unauthorized users receive 401/403.

---

## 6. Phase 4 — Integrate Paiflow with durable AidFlow orders (most critical code)

**Preserve existing starter modules and safeguards.** Do not substitute an ad hoc Stellar transfer or a different payment flow. SDK remains **server-only**.

### 6.1 Financial API boundaries

Implement or safely adapt the starter's API actions to operate against **trusted server orders**:

1. `create donation order`: authenticated donor + approved active campaign; server assigns **fixed 1 XLM** (`"10000000"` stroops), asset XLM, Stellar Testnet, exact approved deployment UUID, config version, approved recipients and split. Client cannot override amount, UUID, recipient addresses, or network.
2. `prepare`: require session ownership and the saved order. Verify deployment network, asset, capabilities and current readiness; call SDK `deployment.execute.prepare({ from: order.walletAddress, amount: order.amountStroops })`. Persist original preparation and correlation ID **before** returning unsigned XDR. Repeated prepare for the *same* order must not create a different payment.
3. `wallet sign`: Freighter signs **the original unsigned XDR** with the **server-prepared network passphrase**. Show network, source wallet, 1 XLM, expected recipient distribution and additional fees; require explicit user approval.
4. `submit`: verify logged-in order owner, deployment/network and that the signed transaction body's hash matches the original body under the stored network passphrase; reject changed operations/fee-bump wrapper. Save exact signed XDR and hash with restricted access **before** SDK submission; never replace with a different envelope for the same order. Use SDK submit with original preparation request metadata.
5. `reconcile`: query the original hash with `deployment.transactions.get(hash)` and `deployment.events.list({txHash: hash, ...})` and verify the receipt/transfer evidence: actual successful finality; expected deployment and trigger; network; source payer; exact 1 XLM asset and amount; **0.9 XLM to the approved relief address and 0.1 XLM to the approved logistics address**. Follow event pagination where required. If events are delayed, obtain supported chain-transfer evidence or leave order `PENDING_VERIFICATION`. Do not mark SUCCESS from HTTP 200 or a generic successful hash lookup alone.
6. `history`: user sees only their own orders and receipts; public campaign progress sums **verified success orders** only.

### 6.2 State machine and failure handling

Use explicit values, e.g.:

`CREATED → PREPARED → AWAITING_SIGNATURE → SUBMITTED → PENDING_VERIFICATION → SUCCESS`

Also support `CONFIRMED_FAILED` and `NEEDS_OPERATOR_REVIEW`. An expired preparation, `UNKNOWN`, `PENDING`, `NOT_FOUND`, HTTP timeout, lost signing response, or slow event feed remains **unresolved** unless finality can be established. Preserve original preparation, signed envelope (if obtained), hash, request IDs and audit trail. No automatic replacement transaction, no silent resubmit with a new signed envelope, no clearing browser recovery to bypass unresolved state.

Signed XDR is transaction evidence (not a wallet secret), but must still be access restricted and **never logged**, embedded in public receipts, or shared in support requests. Keep server rate limits and request size limits from the starter; add per-user/order-level checks. Use durable row locking/idempotency for preparation and submission.

### 6.3 Receipt UI and counts

Success receipt displays:

- Campaign and **DEMO / TESTNET** warnings.
- Paid **1 XLM**, plus fee note.
- Relief **0.9 XLM** and logistics **0.1 XLM** with approved public recipient addresses.
- Verified transaction hash and a safe link to a Stellar Testnet transaction explorer.
- Status `VERIFIED SUCCESS` only after all checks pass; otherwise pending with a **Check original payment** action.

Progress bar = `SUM(amount_stroops)` over fully verified SUCCESS orders divided by campaign's `xlm_goal_stroops`. No fiat total, no conversion, and no manufactured donation count. Suggested demo goal: 1,000 XLM, marked illustrative.

**Phase 4 exit gate:** An authenticated donor completes a real **testnet** SDK payment from the AidFlow campaign; it appears as SUCCESS only after exact payouts are verified; refreshing the page preserves the order; attempts to double-submit/re-prepare cannot create an unintentional second donation.

---

## 7. Phase 5 — Local storage, privacy and UI polish (only after P0 passes)

Use private local filesystem with PostgreSQL metadata as previously agreed:

```dotenv
AIDFLOW_PRIVATE_STORAGE_DIR=C:/AidFlowData/private
```

- Place private files **outside** repository and Next.js `public/`.
- Accept at most five files per application, max 5 MB each; JPG/PNG/PDF only; validate extension, MIME, file contents and size on the server; generate random storage keys. Do not trust user-supplied paths or filenames.
- Restrict downloads by session and owner/admin role; no direct static URL, directory traversal or public document listing.
- For the hackathon, use **synthetic evidence**, not actual government IDs or real beneficiaries' sensitive documents. If the upload UI is cut, keep the architecture decision and clearly label file upload deferred rather than exposing insecure storage.
- Add an admin-only review reason and an audit event for approve/reject/activation/wallet change requests.
- Mobile-first responsive campaign pages and dashboard; desktop-browser Freighter signing is the **tested Web3 checkout**. Do not claim mobile wallet compatibility without actually implementing/testing WalletConnect.
- Show a useful honest empty/error state when external credentials or wallets aren't available. Never show fake success.

---

## 8. Phase 6 — Local production demo through ngrok

- Use the **assigned ngrok development hostname** selected by the user, not an unstable random URL. Confirm free-tier visitor interstitial behavior and limits using actual browser testing.
- During final judge rehearsal, run a **production Next.js build** (`pnpm build`, then `pnpm start`), expose port **3000** through ngrok, and check that the real public HTTPS origin loads on a second device/network.
- Register the exact HTTPS Auth.js callback in Google Cloud; set compatible auth site/origin configuration. Test Google sign-in from the public URL.
- Keep PostgreSQL and pgAdmin bound to localhost/private interfaces. **Never tunnel Postgres (5432), pgAdmin or private storage.**
- Public server must reject forged `Host`/origin requests where applicable and apply same-origin mutation controls from starter.
- Complete or safely reconcile payments started on localhost **before** switching to ngrok; starter browser state is origin-scoped, whereas the new PostgreSQL persistence is the authoritative source for AidFlow orders.
- Save a local PostgreSQL backup and a matching backup of the private files (if any); test that a restoration would reproduce campaign/order records. Keep backups secret and outside Git.
- Keep the demo PC awake, have a reliable power/internet source, and prepare **real previously verified** non-secret transaction evidence if the network fails. Distinguish prerecorded evidence from a live payment.

---

## 9. Solo-developer 24-hour timeboxes and hard cutoffs

| Elapsed time | Main focus | Must exit with |
| --- | --- | --- |
| **0–3h** | Paiflow flow + hosted payment | Confirmed 90/10 split and saved deployment UUID/hash |
| **3–6h** | Unmodified starter + SDK payment | Runnable starter and verified SDK transfer |
| **6–10h** | PostgreSQL persistence + auth foundation | Migration scripts, login flow, durable order model |
| **10–15h** | AidFlow checkout and receipt | Authenticated 1 XLM order bound to a campaign; true payout verification |
| **15–18h** | Minimal campaign + admin pages | One active demo campaign, submission/review and correct activation |
| **18–20h** | ngrok + responsive polish + critical edge tests | Public demo path works; no fabricated success |
| **20–24h** | **Freeze**; run tests, backups, rehearse | Stable tag, verified transaction evidence, short pitch |

These are **budgets**, not promises. If the Paiflow flow is blocked, solve it before advanced UI. If at 15h the authenticated blockchain integration is not working, **cut upload UI, impact reports and extra campaign design**. If at 20h core checks are failing, stop developing features and fix/rehearse what exists.

### Solo Git workflow

1. Preserve a tested starter baseline on `main`.
2. Work in `feat/aidflow-mvp`; commit small tested milestones.
3. Do not parallelize multiple Codex agents that edit the same finance/auth/migration files. Parallelize **your manual service configuration** with Codex's bounded coding work instead.
4. Review `git diff` before each commit, especially `.env.local` and logs.
5. Merge passing work to `main` and tag **`demo-stable`** after final rehearsal.
6. Do not push API tokens, signed envelopes, private uploads, database dumps, or wallet seeds.

---

## 10. Automated and manual acceptance tests

Implement tests using the existing starter test framework where possible. Do not replace real testnet testing with fixtures alone.

| Test | Expected |
| --- | --- |
| Fresh clone + install + run | Page loads without requiring a token; missing payment config shows disabled/explained state |
| Base repo checks | `pnpm typecheck`, `pnpm test`, `pnpm build`, `node scripts/check-browser-bundle.mjs` pass |
| Public campaign | Anonymous visitor can browse but not donate |
| Google sign-in | New user receives USER role; no public self-assigned ADMIN |
| Campaign submission | Signed-in user creates SUBMITTED application; doesn't become ACTIVE automatically |
| Admin authorization | Nonadmin review/activation APIs reject 403; admin actions audited |
| Campaign readiness | Approved without verified payment deployment still cannot accept XLM |
| Wallet binding | Wrong connected donor address / unexpected network rejected |
| Recipient integrity | Client-supplied recipient/deployment/amount overrides rejected |
| Hosted 1 XLM test | 0.9 XLM + 0.1 XLM verified on Testnet |
| SDK 1 XLM test | Correct original tx and exact matching recipients verified |
| Pending tx | Payment not counted toward progress; can check original transaction |
| Duplicate prepare / submit | Same order cannot initiate different transaction/envelope |
| Suspended campaign | Blocks new payment preparations, still reconciles old attempts |
| Signed transaction tampering | Changed body, fee-bump, wrong passphrase rejected |
| Recovery after browser reload | Stored original order/hash accessible after sign-in; no automatic new transaction |
| Payout evidence missing | Remains pending/unresolved, not SUCCESS |
| Files (if built) | Unauthorized access denied; private bytes not reachable from `public/` |
| ngrok demo | Public HTTPS app, Google callback, payment and receipt function |

### Nonnegotiable final output from Codex

At the end of each milestone, report:

- What was changed (file list and business behavior).
- How to start/run it on Windows Git Bash.
- Any SQL migrations and seed actions performed.
- Exact check results (**passed / failed / not run**), including errors.
- Whether a real authorized Testnet payment was performed (if not, say **not performed**).
- Blocking credentials/manual actions needed from the developer.
- Git commit message suggestion and recommended next phase.

---

## 11. Start-now instructions for Codex (copy this into Codex)

> You are implementing **AidFlow**, a 24-hour, one-developer mini-hackathon MVP. Read `AidFlow_Codex_Implementation_Plan.md` thoroughly, then read the repository's `README.md`, `AGENTS.md`, `llms.md` and source/tests. **Do not ask me to redesign the product.**
>
> **Scope:** XLM-only donations on Stellar Testnet using Paiflow SDK v0.2.0, Next.js, PostgreSQL/`pg`, Google OAuth, one verified fictional disaster campaign, basic campaign submission/admin approval, persistent orders, exact 90/10 recipient verification, safe transaction recovery. **No PayMongo, no fiat gateway, no mocked successful payment, no unnecessary framework rewrite.**
>
> **Execution mode:** Implement in short checkpoints. **First** verify the starter can install/build/run unchanged and explain the manual Paiflow hosted-payment prerequisite; **then** verify/configure the starter SDK test; **only then** add database/auth/campaign features. Preserve all payment security invariants from existing `AGENTS.md`. Never paste or log real credentials. Don't claim completion without tests and actual blockchain evidence. Do not start the next milestone if a required exit gate fails; show the precise blocker and safest fix.
>
> **My immediate goal:** Have the existing starter **running now**, then a working AidFlow donation vertical slice as early as possible. Keep the public site honest about testnet/demo status. After each step give me exact Git Bash commands and verification checkpoints.

### If Codex does not see this file

Place this `.md` file into the freshly cloned project root as `AidFlow_Codex_Implementation_Plan.md` and reference it by that exact name. This file is a plan, **not** executable application code, and cannot by itself guarantee a working application.

---

## 12. Final demonstration script (~2–3 minutes)

1. **Problem:** International disaster relief donors need accessible, traceable distribution of donated funds.
2. **Campaign:** Show a clearly fictional Philippine typhoon/flood campaign; note beneficiary consent and manual admin approval.
3. **Donation:** Google-authenticated donor connects Freighter and authorizes **1 XLM on Stellar Testnet**.
4. **Proof:** Display original hash and independently verified **0.9 XLM relief + 0.1 XLM logistics** payouts to approved public wallets.
5. **Recovery/accountability:** Show donation history, pending-state checking, and the XLM-only verified progress figure.
6. **Boundary:** Explain that this is a noncustodial **testnet prototype**. Blockchain proves wallet transfers, not real-world delivery of relief supplies. Production donations and formal charity verification are future work.

### Final acceptance statement

The hackathon MVP is complete **only when** the hosted-page test and AidFlow SDK payment have both succeeded with independently verified split receipts, a saved PostgreSQL-backed order and safe recovery path, a working authenticated campaign flow, and a demonstrable local/ngrok application. Anything less must be stated as incomplete rather than represented as deployed or verified.

---

**End of implementation plan.**
