namespace Vizo.Api.Lib;

// Same environment variables as the Node backend, so one .env serves both.
public sealed record AppEnv(
    string NodeEnv,
    int Port,
    string DatabaseUrl,
    bool PgSsl,
    string? PgSslCaPath,
    string JwtSecret,
    string[] CorsOrigins,
    bool CookieSecure)
{
    public bool IsProduction => NodeEnv == "production";

    public static AppEnv FromEnvironment()
    {
        var nodeEnv = Get("NODE_ENV") ?? "development";
        var cookieSecure = Get("COOKIE_SECURE");
        return new AppEnv(
            NodeEnv: nodeEnv,
            Port: int.Parse(Get("PORT") ?? "4000"),
            DatabaseUrl: Get("DATABASE_URL") ?? "postgres://localhost:5433/vizo",
            PgSsl: Get("PGSSL") == "true",
            PgSslCaPath: Get("PGSSL_CA_PATH"),
            JwtSecret: Get("JWT_SECRET") ?? "dev-secret-change-me",
            CorsOrigins: (Get("CORS_ORIGIN") ?? "http://localhost:3000")
                .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries),
            // Secure cookies are only stored over HTTPS; defaults to on in production.
            CookieSecure: cookieSecure is not null ? cookieSecure == "true" : nodeEnv == "production");
    }

    private static string? Get(string name) => Environment.GetEnvironmentVariable(name);
}

// Minimal dotenv: KEY=VALUE lines, # comments, optional quotes. Variables
// already set in the environment win, as with the dotenv package.
public static class DotEnv
{
    // The nearest .env in `directory` or one of its parents. `dotnet run
    // --project src/Vizo.Api` starts in the project folder, below backend-dotnet/.env.
    public static string? Find(string directory)
    {
        for (var dir = new DirectoryInfo(directory); dir is not null; dir = dir.Parent)
        {
            var path = Path.Combine(dir.FullName, ".env");
            if (File.Exists(path)) return path;
        }
        return null;
    }

    public static void Load(string path)
    {
        if (!File.Exists(path)) return;
        foreach (var rawLine in File.ReadAllLines(path))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var eq = line.IndexOf('=');
            if (eq <= 0) continue;
            var key = line[..eq].Trim();
            var value = line[(eq + 1)..].Trim();
            if (value.Length >= 2 && (value[0] == '"' || value[0] == '\'') && value[^1] == value[0])
                value = value[1..^1];
            if (Environment.GetEnvironmentVariable(key) is null)
                Environment.SetEnvironmentVariable(key, value);
        }
    }
}
