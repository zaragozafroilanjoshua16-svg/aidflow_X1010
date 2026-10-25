# AidFlow

Fictional disaster relief with traceable **Stellar Testnet native-XLM** donations.
Built on the official Paiflow Next.js starter, preserving SDK **0.2.0**, Freighter
signing, original-transaction recovery and rate/body limits. Original attribution
and integration guide: [starter README](docs/STARTER_README.md), [llms.md](llms.md).

## What runs

- Public campaign home/detail pages with fictional/demo labels and verified-XLM progress.
- Google-only Auth.js database sessions; new users are `USER`, never public `ADMIN`.
- Campaign submission, manual admin review and a separate activation check.
- One verified seeded Testnet campaign; other applications cannot accept payments.
- PostgreSQL orders with fixed 1 XLM, original preparation, exact signed envelope,
  original hash, immutable recipient/deployment/platform snapshot and audit trail.
- Successful receipts require finality plus actual native token transfers of
  **0.9 XLM relief / 0.1 XLM logistics**, not just a generic successful lookup.
- Interrupted submission recovery: check original, then an explicit retry of the
  exact stored envelope after a one-minute guard. No automatic resubmit/replacement.
- Private donor history/receipts. Private file uploads are intentionally deferred.

**Not fully rehearsed:** Google login and the authenticated AidFlow payment still
need developer OAuth setup and wallet approval. ngrok, separate hosted-payment
evidence and second-device testing remain manual exit gates.
Do not describe this as a production charity platform or completed deployment.

## Windows Git Bash setup

Node **22.22.2** / pnpm **10.4.1** are required by the starter. PostgreSQL 18 is
installed on this developer machine. No Docker, Supabase or ORM is required.

```bash
cd /d/0001/mini-hackathon/aidflow
node --version
pnpm --version
pnpm install --frozen-lockfile
# Fresh checkout only: cp .env.example .env.local
```

Never overwrite an existing `.env.local`. Set server-only Paiflow deployment UUID
and a Read and operate token scoped to it. Never paste tokens, wallet seeds or
signed envelopes into chat, source, public receipts or support logs.

For a **new isolated local database**, or to reuse one created by this script:

```bash
# Keep all database files outside Git. D: was tested on this machine.
export AIDFLOW_DATA_DIR='D:/AidFlowData'
# Optional if PostgreSQL lives elsewhere:
# export AIDFLOW_PG_BIN='D:/Program Files/PostgreSQL/18/bin'
pnpm db:local
pnpm db:migrate
pnpm db:seed
```

`db:local` never changes an existing DATABASE_URL. It creates a separate cluster
on **127.0.0.1:55432**, a non-superuser `aidflow_app` database owner, random local
passwords and AUTH_SECRET. Passwords are saved locally and never printed. The
cluster's bootstrap credential is private in `AIDFLOW_DATA_DIR/local-db.json`.
The app role can manage its own schema for migrations, but has no cluster-level
superuser, create-role or create-database privileges. Restrict that directory
to your Windows account; Windows ACL hardening has not been independently audited.
On this host, initdb under the C: profile failed with `Improper link`; D: succeeded.

Alternatively, create a localhost-only database and scoped role yourself and set
DATABASE_URL in `.env.local`, then run the migration/seed commands. pgAdmin is a GUI,
not the backend. Seed rechecks the documented original chain proof before activation;
it fails closed if the proof is unavailable or the configured UUID differs.
**It seeds zero users and zero donation orders.**

## Google sign-in

Configure these **only in `.env.local`**:

```dotenv
AIDFLOW_PUBLIC_ORIGIN=http://127.0.0.1:3000
AUTH_URL=http://127.0.0.1:3000
AUTH_SECRET=YOUR_LONG_RANDOM_LOCAL_SECRET
AUTH_GOOGLE_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
AUTH_GOOGLE_SECRET=YOUR_GOOGLE_OAUTH_CLIENT_SECRET
```

Register the exact callback in Google Cloud:
`http://127.0.0.1:3000/api/auth/callback/google`. Add authorized test users when
the Google External app is in Testing. The app accepts verified Google email
profiles only, uses the inspected `@auth/pg-adapter@1.11.3` schema and database
session cookies, and never reads roles from public input. If credentials are
missing, the public app works and `/signin` explains setup; mutation APIs return 401.
The schema uses adapter-compatible quoted names such as `"userId"` and
`"sessionToken"`, with UUID primary keys.

After the intended administrator first signs in with Google:

```bash
pnpm admin:grant your-verified-google-email@example.com
```

This trusted local operation requires an existing Google-linked account and appends
an audit record. No admin account, auth bypass or test session is installed by seed.

## Run

```bash
pnpm dev --hostname 127.0.0.1
# Or production rehearsal:
pnpm build
node scripts/check-browser-bundle.mjs
pnpm start --hostname 127.0.0.1
```

Open **http://127.0.0.1:3000**. Use one exact origin. Next.js normalizes IPv4 request
URLs to `localhost`; AIDFLOW_PUBLIC_ORIGIN pins the real browser Origin and Host
without trusting forwarding headers. Restart after changing credentials/origin.
Stop an existing server before reusing port 3000. Never clear recovery storage
or switch origins while an original payment is unresolved.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Fictional mission, demo campaign and XLM-only totals |
| `/campaigns/habagat-relief-demo` | Story, public wallets, exact split, verified progress |
| `/campaigns/[slug]/donate` | Signed-in wallet review, original preparation/sign/submit |
| `/donations/[id]` | Owner-only durable order and original-hash receipt/reconciliation |
| `/dashboard` | Personal orders, campaign applications and submission form |
| `/admin` | Manual application review with audited reason; no success override |
| `/starter/recover` | Signed-in read-only original starter hash check; retains evidence |

Raw starter prepare/submit is retired: `/api/pay` now requires a saved owned order.
Legacy hash status checks remain signed-in and read-only; they never affect totals.
All donation mutations also retain global per-process starter limits, streaming
210,000-byte request limits and durable per-account minute budgets. PostgreSQL
row locks, a unique unresolved-order index and durable preparation/submission claims
protect concurrent requests. Lost preparation responses may require operator review;
the app deliberately does not invent a replacement.

## Verify

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/check-browser-bundle.mjs
```

Integration tests need TEST_DATABASE_URL or local DATABASE_URL. They create random
isolated `test_*` schemas and drop only those schemas afterward. They do not alter
real campaign/order data. CI supplies a disposable PostgreSQL service. The testnet
receipt verifier was additionally exercised against the public original rehearsal
transaction by `db:seed`; tests alone do not substitute for wallet approval.

See [public rehearsal proof](docs/TESTNET_EVIDENCE.md) and
[implementation status](IMPLEMENTATION_STATUS.md). The 90% demo recipient also acted
as donor in that rehearsal; recipient wallets are distinct. No real-world relief
delivery is established. Stellar RPC may stop retaining old transaction metadata;
an unavailable chain proof leaves an order unresolved, not falsely successful.

## ngrok rehearsal and backups

Use the developer's assigned HTTPS hostname. Set AIDFLOW_PUBLIC_ORIGIN and AUTH_URL
to that exact HTTPS origin and register its `/api/auth/callback/google` callback.
Reconcile all original localhost orders first. Build and start on port 3000, then
tunnel **only port 3000**. Never tunnel PostgreSQL, pgAdmin or private storage.
Test the ngrok visitor interstitial, login cookies, payment, receipt and a second
device/network. These steps have not been performed by this implementation.

```bash
pnpm db:backup
export AIDFLOW_DATA_DIR='D:/AidFlowData'
pnpm db:restore-check
```

Backups go to `AIDFLOW_BACKUP_DIR` or the system local AidFlow backup folder outside
Git. The script uses pg_dump custom format, validates the archive listing and
records counts without printing database credentials. `db:restore-check` is for the
isolated localhost:55432 cluster: it restores the latest archive into a new disposable
database, verifies campaign/order/evidence counts, then drops only that disposable
database. This was run successfully on the local seed-only database. It does not
establish recovery of real authenticated donation records that do not yet exist.
Copy and rehearse restoring matching private files separately if uploads are added.
Keep backups secret and use the developer's local credentials.

## Scope and boundaries

Only native Testnet XLM, fixed 1 XLM, no fiat checkout, no conversions, no custody,
no real IDs, no automated KYC, no mobile wallet compatibility claim. The 1,000 XLM
goal is illustrative. Client-side signed evidence is private to its order owner;
server signed envelopes are never returned or logged. Future deployment versions
require manual review and fresh verification, not editing a ready config in place.
