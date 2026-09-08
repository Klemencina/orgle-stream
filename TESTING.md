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
