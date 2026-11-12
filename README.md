# VIZO

A marketplace for residential buildings — verified neighbors buy and sell
directly with each other, fixed-price or by auction, with in-person pickup.

- `frontend/` — Next.js (App Router, TypeScript, Tailwind)
- `backend/` — Express + PostgreSQL REST API, JWT auth via httpOnly cookie
- `mobile/` — iOS/Android app (Expo) wrapping the frontend in a WebView, with
  over-the-air updates. See `mobile/README.md`
- `sketches/` — original wireframes this was built from

## Running locally

**Database** (Postgres via Docker):

```bash
cd backend
docker compose up -d
npm install
cp .env.example .env   # DATABASE_URL already points at the compose Postgres on :5433
npm run db:migrate
npm run dev             # http://localhost:4000
```

**Frontend**, in a second terminal:

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
npm run dev              # http://localhost:3000
```

Register an account at `/register` (address verification is a mocked file
picker — any image "uploads" instantly) and you're in.

## Tests

Both apps use [Vitest](https://vitest.dev).

```bash
cd backend
npm test                  # unit + HTTP route tests, database mocked (no Postgres needed)
npm run test:integration  # orders, escrow, credits and chat against a real Postgres
npm run test:all          # both
npm run typecheck         # also type-checks the tests

cd frontend
npm test                  # lib + component tests (jsdom, React Testing Library)
```

Integration tests need the compose Postgres running. They create and migrate
a separate `vizo_test` database on it and truncate its tables before every
test, so your dev data is never touched. Point them elsewhere with
`TEST_DATABASE_URL`; the database name must end in `_test`.

## TV show stores

Admins create a store per TV show at `/stores`. Each store page shows a QR
code (downloadable as a PNG for broadcast) that links to `/tv/<storeId>`.
Scanning it locks that browser tab to the store, and no account is needed to
browse. Signing in or creating an account is only required at checkout.
Everyone else sees only their own building's listings.

Admins add and remove other admins at `/admins`. To create the first admin
(or recover access), promote an existing account from the command line:

```bash
cd backend
npm run user:make-admin -- someone@example.com   # add --revoke to undo
```

Set `NEXT_PUBLIC_APP_URL` in the frontend (e.g. `https://vizo.app`) so QR
codes always point at the public site, even when generated from another host.

## Deploying

See `backend/docs/aws-rds-setup.md` for setting up the Postgres database on
Amazon RDS, plus notes on hosting the backend and frontend.
