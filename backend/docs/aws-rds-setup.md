# Setting up PostgreSQL on Amazon RDS for VIZO

This walks through creating the production database on Amazon RDS and
pointing the backend at it. It assumes no prior AWS experience.

## 1. What you're creating

RDS is AWS's managed relational database service — it runs PostgreSQL for
you (backups, patching, failover) so you don't manage a database server
yourself. You'll create one **DB instance**, get a **connection endpoint**
(a hostname), and point `DATABASE_URL` at it.

## 2. Decide where it lives: VPC and subnets

Every RDS instance lives inside a VPC (Virtual Private Cloud — your private
network in AWS). If you haven't created a custom VPC, that's fine — use the
**default VPC** AWS gives every account; it already has public subnets in
each Availability Zone, which is enough to get started.

For a real production setup, the pattern is:
- RDS goes in **private subnets** (no direct internet route).
- Your backend (ECS/App Runner/EC2) goes in the **same VPC**, either in
  public subnets (simplest) or private subnets with a NAT gateway (more
  locked-down, costs more).
- Nothing on the public internet can reach the database directly — only
  your backend can, via the VPC's internal networking.

For initial development, it's fine to make the instance **publicly
accessible** so you can run the schema migration from your laptop, then
lock down the security group afterward (see step 4). Don't leave it
publicly open long-term.

## 3. Create the instance (AWS Console)

1. Go to **RDS → Databases → Create database**.
2. **Engine type**: PostgreSQL. Use the latest stable version (17.x as of
   this writing, matching the local Postgres version this project uses).
3. **Templates**: pick **Free tier** while developing, or **Dev/Test** once
   you're past the free-tier instance class. This mainly affects the
   defaults it suggests (single-AZ, no Multi-AZ standby).
4. **Settings**:
   - DB instance identifier: `vizo-db` (just a name for the resource).
   - Master username: pick something other than `postgres` if you want
     (e.g. `vizo_admin`).
   - Master password: let AWS auto-generate it and store it in **Secrets
     Manager** (there's a checkbox for this) rather than typing your own —
     one less secret for you to handle directly.
5. **Instance configuration**: `db.t4g.micro` is the free-tier-eligible
   burstable instance class — plenty for this app's traffic.
6. **Storage**: 20 GB gp3, no need for autoscaling yet.
7. **Connectivity**:
   - VPC: default (or your custom one).
   - Public access: **Yes**, temporarily, if you're setting this up for the
     first time and want to run the migration from your laptop. Set it to
     **No** later.
   - VPC security group: create a new one, name it `vizo-db-sg`.
   - Availability Zone: no preference.
8. **Database authentication**: password authentication (the default) is
   fine. IAM database authentication is a nice hardening step later, not
   needed to start.
9. **Additional configuration**:
   - Initial database name: `vizo` — this saves you a manual `CREATE
     DATABASE` step.
   - Backup retention: 7 days is a reasonable default.
   - Enable "Enable automated backups" (on by default).
10. Click **Create database**. It takes 5-10 minutes to become available.

## 4. Security group: control who can connect

RDS instances are gated by a **security group** — essentially a firewall
attached to the instance. Find `vizo-db-sg` under **EC2 → Security Groups**
and edit its **inbound rules**:

- While setting up from your laptop: add a rule for **PostgreSQL (port
  5432)**, source = **My IP** (the console can fill this in for you). This
  only allows connections from your current IP address.
- Once the backend is deployed inside the VPC: replace that rule with one
  scoped to the backend's own security group (source = the ECS/App Runner
  security group, not an IP). Remove the "My IP" rule at that point — the
  database should not be reachable from the open internet in production.

## 5. Get the connection details

On the RDS instance's detail page:
- **Endpoint**: something like
  `vizo-db.c9akciq32.us-east-1.rds.amazonaws.com`
- **Port**: `5432`
- If you let AWS manage the password, find it under **Secrets Manager** →
  the secret named after your DB instance → **Retrieve secret value**.

Build the connection string:

```
DATABASE_URL=postgres://<username>:<password>@<endpoint>:5432/vizo
```

RDS Postgres requires SSL by default. Set `PGSSL=true` in the backend's
environment (see `src/db/pool.ts` — it already branches on this).

## 6. Run the schema migration

From your laptop (while the security group still allows your IP):

```bash
cd backend
DATABASE_URL="postgres://<username>:<password>@<endpoint>:5432/vizo" \
  PGSSL=true \
  npm run db:migrate
```

That applies `db/schema.sql` to RDS using the app's own `pg` driver (see
`src/db/migrate.ts`), the same file used for local development — no separate
"prod schema" to maintain, and no `psql` client to install. The schema is
idempotent, so re-running it is safe.

Once RDS is locked down to a private subnet, run migrations from wherever the
backend runs instead of your laptop: after `npm run build`, use
`npm run db:migrate:prod` (plain `node`, no dev dependencies needed).

## 7. Deploying the backend itself

RDS is just the database — you still need somewhere to run the Express
app. Reasonable options, roughly in order of "simplest to get started":

- **AWS App Runner**: point it at a container image (or a GitHub repo — it
  can build the Dockerfile for you), it handles the load balancer, TLS, and
  scaling. Put it in the same VPC as RDS via App Runner's VPC connector.
- **ECS on Fargate**: more control, still no servers to patch. A bit more
  setup (task definition, service, ALB) than App Runner.
- **Elastic Beanstalk**: older but still supported, handles most of the
  same plumbing as App Runner with a more "PaaS" feel.

Whichever you choose, set the backend's environment variables
(`DATABASE_URL`, `PGSSL=true`, `JWT_SECRET`, `CORS_ORIGIN`) through the
platform's secrets/env configuration — never commit them. `JWT_SECRET`
especially should be a long random value (`openssl rand -base64 48`),
different from the local dev one.

## 8. Deploying the frontend

The Next.js frontend doesn't need to be on AWS at all — **Vercel** is the
path of least resistance for Next.js specifically and has a generous free
tier. If you want everything under one cloud provider, **AWS Amplify
Hosting** builds and serves the Next.js app directly.

Either way, set `NEXT_PUBLIC_API_URL` to the backend's public URL, and set
the backend's `CORS_ORIGIN` to the frontend's exact origin (no trailing
slash) — the httpOnly auth cookie won't be accepted cross-origin otherwise.

## 9. A note on cost

`db.t4g.micro` + 20 GB gp3 storage is free-tier eligible for the first 12
months on a new AWS account, and cheap (a few dollars a month) after that.
The bigger cost driver as this grows is usually the compute running the
backend, not the database — RDS is comfortably the least expensive part of
this stack at small scale.
