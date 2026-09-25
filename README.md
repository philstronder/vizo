# VIZO

A marketplace for residential buildings — verified neighbors buy and sell
directly with each other, fixed-price or by auction, with in-person pickup.

- `frontend/` — Next.js (App Router, TypeScript, Tailwind)
- `backend/` — Express + PostgreSQL REST API, JWT auth via httpOnly cookie
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

## Deploying

See `backend/docs/aws-rds-setup.md` for setting up the Postgres database on
Amazon RDS, plus notes on hosting the backend and frontend.
