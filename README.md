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

Register an account at `/register` with a photo of any document as proof of
residency. New residents wait for review before they can use their community
(see [Building admins](#building-admins)). Locally, make yourself an admin
(below) and approve your own test accounts at `/verifications`.

## Tests

Every suite runs in CI on each push to `main` and every pull request (see
[CI](#ci)).

```bash
cd backend
npm test                  # unit + HTTP route tests, database mocked (no Postgres needed)
npm run test:integration  # every API area against a real Postgres
npm run test:all          # both
npm run test:coverage     # both, with a coverage report in coverage/
npm run typecheck         # also type-checks the tests

cd frontend
npm test                  # lib + component tests (jsdom, React Testing Library)
npm run test:coverage     # same, with a coverage report in coverage/

cd e2e
npm test                  # the whole app in a real browser (see below)
```

Integration tests need the compose Postgres running. They create and migrate
a separate `vizo_test` database on it and truncate its tables before every
test, so your dev data is never touched. Point them elsewhere with
`TEST_DATABASE_URL`; the database name must end in `_test`.

**What each layer covers**

- **Backend integration** (`backend/test/integration`): accounts, listings
  and the feed, bidding (including simultaneous bids), Q&A, checkout, escrow,
  meetups, handoffs, cancellations, credits, withdrawals, order chat,
  notifications, stores, admins, condominiums, building admins and residency
  review, plus who may see or change
  what.
- **Backend unit** (`backend/test/unit`): route validation and error handling
  with the database mocked, and helpers such as the listing access rule.
- **Frontend** (`frontend/test`): formatting and the API client, plus the
  components with the most logic: the condominium picker, the address fields
  and ZIP code lookup, the listing wizard, the bid modal and the order handoff.
- **E2E** (`e2e/tests`): sign-up and sign-in, listing, searching and filtering,
  buying, bidding, the whole order lifecycle through payout, rating, wallet
  withdrawal and cancellation, paying with credits, Q&A, notifications,
  profile edits, switching language, the TV store flow from QR code to
  delivery, and the admin screens.

**Coverage.** `test:coverage` fails when coverage drops below the thresholds
in `backend/vitest.config.ts` and `frontend/vitest.config.mts`. Raise them as
coverage grows. The frontend's numbers are lower because its pages are
covered by the E2E suite, which coverage doesn't measure. CI shows both
reports in each run's summary and keeps the HTML report as an artifact.

### End-to-end tests

`e2e/` drives the real app in Chromium with [Playwright](https://playwright.dev).

```bash
cd e2e
npm install
npx playwright install chromium   # once
npm test                          # or: npm run test:ui
```

It builds the frontend and starts it on :3100 plus the backend on :4100, so it
runs alongside your dev servers. It needs the compose Postgres, and it wipes
and re-creates a `vizo_e2e_test` database on every run (override with
`E2E_DATABASE_URL`; the name must end in `_test`). Each test makes its own
condominium and users, so tests run in parallel without seeing each other's
data. ZIP code lookups are answered inside the tests, so nothing calls the
real ViaCEP service. Failures keep a trace, screenshot and video. Open them
with `npm run report`.

### CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull
request. It runs the backend typecheck, unit and integration tests with
coverage, and build; the frontend lint, typecheck, tests with coverage, and
build; the mobile typecheck and lint; and the E2E suite. To block merging
when any of these fails, mark these jobs as required status checks under the
`main` branch protection rule.

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

## Building admins

Residents prove they live in their condominium with a photo of a utility bill,
lease or ID at sign-up, and again when they move to another building in their
profile. Until it's approved they can't see, list, bid on or buy their
community's listings.

Platform admins nominate **building admins** per condominium in the
"Building admins" section of `/admins` (the person needs an account; they
don't have to live there, e.g. a property manager). Building admins get a
notification for each new request and review them at `/verifications`:
approve, or reject with a reason the resident sees before sending a new
photo. Platform admins can review every building's requests, which covers
condominiums with no building admin yet (such as one added at sign-up); those
requests notify the platform admins instead. The photo is deleted once a
request is reviewed.

Set `NEXT_PUBLIC_APP_URL` in the frontend (e.g. `https://vizo.app`) so QR
codes always point at the public site, even when generated from another host.

## Deploying

See `backend/docs/aws-rds-setup.md` for setting up the Postgres database on
Amazon RDS, plus notes on hosting the backend and frontend.
