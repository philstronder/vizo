using Vizo.Api.Lib;

namespace Vizo.Api.Db;

// Applies backend/db/schema.sql (copied next to the binary) to DATABASE_URL.
//   dotnet run -- migrate
public static class Migrate
{
    public static async Task<int> Run(AppEnv env)
    {
        var schemaPath = Path.Combine(AppContext.BaseDirectory, "db", "schema.sql");
        await using var db = Database.CreateDataSource(env);
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = await File.ReadAllTextAsync(schemaPath);
            await cmd.ExecuteNonQueryAsync();
            await tx.CommitAsync();
            Console.WriteLine($"Applied {schemaPath}");
            return 0;
        }
        catch (Exception e)
        {
            await tx.RollbackAsync();
            Console.Error.WriteLine($"Migration failed: {e}");
            return 1;
        }
    }
}

// Grants (or with --revoke, removes) admin rights for an existing account.
//   dotnet run -- make-admin someone@example.com [--revoke]
public static class MakeAdmin
{
    public static async Task<int> Run(AppEnv env, string[] args)
    {
        var email = args.FirstOrDefault(a => !a.StartsWith("--"));
        var revoke = args.Contains("--revoke");
        if (email is null)
        {
            Console.Error.WriteLine("Usage: make-admin <email> [--revoke]");
            return 1;
        }
        await using var db = Database.CreateDataSource(env);
        var user = await db.SetUserAdmin(email, !revoke);
        if (user is null)
        {
            Console.Error.WriteLine($"No user with email {email}");
            return 1;
        }
        Console.WriteLine($"{user.Email} is {(user.IsAdmin ? "now an admin" : "no longer an admin")}");
        return 0;
    }
}
