# VIZO API — .NET

An ASP.NET Core (.NET 10) port of [`../backend`](../backend). It works as a drop-in replacement:

- **Same environment variables:** `DATABASE_URL`, `PORT`, `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE`, `NODE_ENV`, `PGSSL`, `PGSSL_CA_PATH`. A `.env` file in the working directory is loaded the same way `dotenv` does it.
- **Same database and schema.** `backend/db/schema.sql` is linked into the build, so it stays the only copy.
- **Same auth.** It uses the `vizo_token` cookie and HS256 JWTs (`{ userId, iat, exp }`) with the same secret, and verifies the bcrypt hashes bcryptjs wrote. Sessions and passwords work on either backend.
- **Same API.** Routes, JSON shapes and errors (`{ message }` / `{ message: "Invalid request", issues }`) match, so the frontend needs no changes.

Stack: Minimal APIs, Npgsql + Dapper (raw SQL, like `pg`), and BCrypt.Net-Next. Request validation is a small hand-written stand-in for zod (`Lib/Validation.cs`).

## Layout

Every router in `backend/src/routes` has a counterpart, and so do the `db:migrate` and `user:make-admin` scripts.

- `Routes/XxxRoutes.cs`: one per Express router, each with a `MapXxxRoutes` extension that `Program.cs` mounts.
- `Db/Xxx.cs`: the queries, as `NpgsqlDataSource` extension methods, with row classes and the `ApiXxx` response records (`toApiXxx` in Node).
- `Lib/`: env, JWT, passwords, validation, `ListingAccess` (`lib/listing-access.ts`).
- `Middleware/`: the auth cookie, `RequireAuth()`/`RequireAdmin()` endpoint filters, and the error handler.

A few porting notes:

- **Enum columns:** Npgsql sends strings typed as `text`, so SQL casts them, e.g. `@status::listing_status`. An unknown value still fails with 22P02, which is a 404, as in Node.
- **Malformed UUIDs:** `Ids.Parse` turns a malformed UUID in a path or query string into the same 404 `{ message: "Not found" }` that Postgres' 22P02 produced.
- **Amounts:** `NUMERIC` columns are read as `decimal` and returned as `double`, so JSON gets `12.5`, like `Number()` produced.

Changes to the API should be made in both backends until the Node one is retired.

## Run locally

Requires the [.NET 10 SDK](https://dotnet.microsoft.com/download). It uses the same Postgres as the Node backend (`docker compose up -d` in `../backend`).

The app loads the nearest `.env`, starting in the working directory and moving up through parent folders. `dotnet run --project` starts in `src/Vizo.Api`, so it finds `backend-dotnet/.env` (`cp .env.example .env`). Running from `../backend` uses that folder's `.env` instead:

```sh
cd ../backend                       # so ../backend/.env is picked up
dotnet run --project ../backend-dotnet/src/Vizo.Api                 # API on $PORT (4000)
PORT=4001 dotnet run --project ../backend-dotnet/src/Vizo.Api       # alongside the Node API
dotnet run --project ../backend-dotnet/src/Vizo.Api -- migrate
dotnet run --project ../backend-dotnet/src/Vizo.Api -- make-admin someone@example.com [--revoke]
```

## Deploy to EC2

The instance needs no .NET install. A self-contained build ships the runtime with it. Amazon Linux 2023 or Ubuntu 24.04 both work, and a `t4g.small` (Graviton/arm64) is plenty. Use `linux-x64` for `t3`-class instances.

```sh
# on your machine
dotnet publish src/Vizo.Api -c Release -r linux-arm64 --self-contained -o publish
rsync -a --delete publish/ ec2-user@<host>:/tmp/vizo-api/

# on the instance (first time)
sudo useradd --system --no-create-home vizo
sudo install -m 600 -o root /dev/null /etc/vizo-api.env    # then fill in the env vars
sudo cp deploy/vizo-api.service /etc/systemd/system/ && sudo systemctl daemon-reload

# on the instance (every deploy)
sudo rsync -a --delete /tmp/vizo-api/ /opt/vizo-api/
sudo systemd-run --uid=vizo -p EnvironmentFile=/etc/vizo-api.env --wait --pipe /opt/vizo-api/Vizo.Api migrate
sudo systemctl enable --now vizo-api && sudo systemctl restart vizo-api
journalctl -u vizo-api -f
```

Put nginx (or an ALB) in front for TLS. Set `CORS_ORIGIN` to the frontend's exact origin, and leave `COOKIE_SECURE` on once you're serving HTTPS:

```nginx
location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 15m;
}
```

### Or with Docker

Build from the repo root, because the image also needs `backend/db/schema.sql`:

```sh
docker build -f backend-dotnet/Dockerfile -t vizo-api-dotnet .
docker run -d -p 4000:4000 --env-file /etc/vizo-api.env vizo-api-dotnet
docker run --rm --env-file /etc/vizo-api.env vizo-api-dotnet migrate
```
