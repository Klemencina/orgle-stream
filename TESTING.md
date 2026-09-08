# Testing

Unit tests require no service credentials:

```bash
pnpm test
```

Integration tests use real PostgreSQL transactions and a Stripe stub. They do not call Stripe, charge a card, or access the source database. They refuse any database URL that is not local and named `orgle_test`.

Start a disposable PostgreSQL instance and wait until it is ready:

```bash
docker run -d --rm --name orgle-tests \
  -e POSTGRES_PASSWORD=orgle_local_test \
  -e POSTGRES_DB=orgle_test \
  -p 127.0.0.1:55439:5432 postgres:14-alpine
```

Create the schema only in that disposable database:

```bash
DATABASE_URL=postgresql://postgres:orgle_local_test@127.0.0.1:55439/orgle_test \
  pnpm exec prisma db push --skip-generate
TEST_DATABASE_URL=postgresql://postgres:orgle_local_test@127.0.0.1:55439/orgle_test \
  pnpm test:integration
docker stop orgle-tests
```

Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` for the remaining checks. The production build needs the app's local environment configuration.

The payment tests cover concurrent fulfillment, unpaid checkout completion, fully discounted purchases, retries after refunds, delayed-payment failure and expiry, duplicate checkout requests, session reuse, ownership checks, and a webhook arriving during checkout creation. Concert tests cover rollback after an invalid edit, successful editing with a purchased ticket, and archiving without deleting associated records.

Before deployment, check that the Stripe endpoint subscribes to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. The SDK now sends API version `2025-10-29.clover`. Rehearse real Stripe test-mode checkout and webhook delivery separately; the stub cannot establish that the deployed endpoint or account is configured correctly.

Dependency overrides update Next.js's pinned PostCSS to 8.5.28 and Prisma configuration's deepmerge-ts to 8.0.0. The latter changes Map merging; this project has no custom Prisma configuration using Maps. Prisma configuration loading, client generation, and the application build are the compatibility checks for these overrides. Revisit them when upgrading Next.js or Prisma.

## Festival pass

A paid festival pass covers every visible concert dated within its year in `Europe/Ljubljana`, including concerts added after purchase. Individual tickets remain separate. Stream time limits still apply; passes do not include recordings. This version charges the full pass price without crediting earlier individual ticket purchases. Refunded or revoked pass records do not grant access, but automatic refund synchronization is not part of this change.

Set `FESTIVAL_PASS_YEAR` and `FESTIVAL_PASS_STRIPE_PRICE_ID` to enable the offer. The Stripe price must be active, one-time, and have a fixed amount. With either setting missing, pass sales are unavailable. Removing sales configuration does not revoke purchased passes. Keep an in-flight order's price unchanged; if its configured price changes, resolve the existing attempt before retrying. Use a new year when opening the next festival.

The pass table must exist before deploying this code, even if sales are disabled. The migration `20260908190000_add_festival_passes` only creates a table and its unique index. It does not modify existing tables or purchases. Test that exact SQL against a restored backup before applying it to the target database. Take a fresh backup first.

The older migration history cannot currently build an empty database and is missing some schema changes. Do not use a reset or blanket `db push` to repair an existing database. For an existing database matching the pre-pass schema, apply only the reviewed pass migration with `prisma db execute --file prisma/migrations/20260908190000_add_festival_passes/migration.sql`, then record it with `prisma migrate resolve --applied 20260908190000_add_festival_passes`. Both commands act on `DATABASE_URL`; verify the target first. Repairing the older migration history is a separate task.

Pass integration tests cover concurrent checkout and fulfillment, delayed payment, duplicate purchases, ownership, revoked access, year boundaries, later concert additions, dashboard deduplication, and individual-ticket preservation. Before enabling sales, rehearse a Stripe test-mode pass purchase through the deployed webhook, then check access to two included concerts and denial for another year.
