using System.Text.Json.Serialization;
using Dapper;
using Vizo.Api.Db;
using Vizo.Api.Lib;
using Vizo.Api.Middleware;
using Vizo.Api.Routes;

var dotEnvPath = DotEnv.Find(Directory.GetCurrentDirectory());
if (dotEnvPath is not null) DotEnv.Load(dotEnvPath);
if (Environment.GetEnvironmentVariable("DATABASE_URL") is null)
{
    // The fallback URL has no credentials, so Postgres would reject it with a
    // confusing SCRAM "no password" error; say what's actually missing.
    Console.Error.WriteLine(dotEnvPath is null
        ? $"warning: DATABASE_URL is not set and no .env was found in {Directory.GetCurrentDirectory()} or its parents. Copy backend-dotnet/.env.example to backend-dotnet/.env."
        : $"warning: DATABASE_URL is not set in {dotEnvPath}.");
}
var env = AppEnv.FromEnvironment();

// Rows come back snake_case (password_hash); map them onto PascalCase properties.
DefaultTypeMap.MatchNamesWithUnderscores = true;

// CLI commands, the counterparts of `npm run db:migrate` and `npm run user:make-admin`.
switch (args.FirstOrDefault())
{
    case "migrate":
        return await Migrate.Run(env);
    case "make-admin":
        return await MakeAdmin.Run(env, args[1..]);
}

// appsettings.json sits next to the binary, while .env is read from the
// working directory, as with the Node backend.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory,
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(env.Port);
    // Listing photos are carried as base64 data URLs until real object storage
    // (S3) is wired up — see db/schema.sql — so allow a handful of images.
    options.Limits.MaxRequestBodySize = 15 * 1024 * 1024;
});

builder.Services.AddSingleton(env);
builder.Services.AddSingleton(Database.CreateDataSource(env));
builder.Services.AddHttpClient(CepRoutes.HttpClientName, client => client.Timeout = TimeSpan.FromSeconds(5));
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(env.CorsOrigins).AllowCredentials().AllowAnyHeader().AllowAnyMethod()));
// Matches JSON.stringify: undefined (null here) fields are left out.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull);

var app = builder.Build();

app.UseMiddleware<ErrorHandlerMiddleware>();
app.UseCors();
app.UseMiddleware<AttachUserMiddleware>();

app.MapGet("/health", () => Results.Json(new { ok = true }));

app.MapGroup("/api/auth").MapAuthRoutes();
app.MapGroup("/api/listings").MapListingsRoutes();
app.MapGroup("/api/orders").MapOrdersRoutes();
app.MapGroup("/api/notifications").MapNotificationsRoutes();
app.MapGroup("/api/stores").MapStoresRoutes();
app.MapGroup("/api/admins").MapAdminsRoutes();
app.MapGroup("/api/condominiums").MapCondominiumsRoutes();
app.MapGroup("/api/cep").MapCepRoutes();

app.MapFallback((HttpContext ctx) =>
    Results.Json(new { message = $"Route not found: {ctx.Request.Method} {ctx.Request.Path}" }, statusCode: 404));

app.Lifetime.ApplicationStarted.Register(() =>
    Console.WriteLine($"VIZO API listening on http://localhost:{env.Port} ({env.NodeEnv})"));

await app.RunAsync();
return 0;
