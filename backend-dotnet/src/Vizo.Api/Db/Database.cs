using Npgsql;
using Vizo.Api.Lib;

namespace Vizo.Api.Db;

public static class Database
{
    public static NpgsqlDataSource CreateDataSource(AppEnv env)
    {
        var connection = new NpgsqlConnectionStringBuilder(ToConnectionString(env.DatabaseUrl))
        {
            // No Kerberos here; otherwise Npgsql probes for libgssapi on Linux and logs an error.
            GssEncryptionMode = GssEncryptionMode.Disable,
        };
        if (env.PgSsl)
        {
            // Same behaviour as the pg pool: verify against the RDS CA bundle
            // when one is given, otherwise encrypt without verifying.
            if (env.PgSslCaPath is not null)
            {
                connection.SslMode = SslMode.VerifyFull;
                connection.RootCertificate = env.PgSslCaPath;
            }
            else
            {
                connection.SslMode = SslMode.Require;
            }
        }
        return NpgsqlDataSource.Create(connection);
    }

    // Npgsql takes key=value connection strings; DATABASE_URL is a
    // postgres:// URL, as node-postgres expects.
    private static string ToConnectionString(string databaseUrl)
    {
        if (!databaseUrl.StartsWith("postgres://") && !databaseUrl.StartsWith("postgresql://")) return databaseUrl;

        var uri = new Uri(databaseUrl);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5433,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
        };
        var userInfo = uri.UserInfo.Split(':', 2);
        if (userInfo[0].Length > 0) builder.Username = Uri.UnescapeDataString(userInfo[0]);
        if (userInfo.Length > 1) builder.Password = Uri.UnescapeDataString(userInfo[1]);
        return builder.ConnectionString;
    }
}
