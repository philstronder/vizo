using Dapper;
using Npgsql;
using Vizo.Api.Lib;

namespace Vizo.Api.Db;

public sealed class StoreRow
{
    public Guid Id { get; init; }
    public string Name { get; init; } = "";
    public string Description { get; init; } = "";
    public Guid CreatedBy { get; init; }
    public DateTime CreatedAt { get; init; }
    public long ProductCount { get; init; }
}

public sealed record ApiStore(Guid Id, string Name, string Description, long ProductCount, string CreatedAt)
{
    public static ApiStore From(StoreRow row) =>
        new(row.Id, row.Name, row.Description, row.ProductCount, Iso.Format(row.CreatedAt));
}

public sealed record StoreInput(string Name, string Description);

public static class Stores
{
    private const string StoreSelect = """
        SELECT
          s.id, s.name, s.description, s.created_by, s.created_at,
          (SELECT count(*) FROM listings l WHERE l.store_id = s.id AND l.status = 'active') AS product_count
        FROM stores s
        WHERE s.deleted_at IS NULL
        """;

    public static async Task<IEnumerable<StoreRow>> ListStores(this NpgsqlDataSource db)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QueryAsync<StoreRow>($"{StoreSelect} ORDER BY s.created_at DESC");
    }

    public static async Task<StoreRow?> FindStoreById(this NpgsqlDataSource db, Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<StoreRow>($"{StoreSelect} AND s.id = @id", new { id });
    }

    public static async Task<StoreRow> CreateStore(this NpgsqlDataSource db, StoreInput input, Guid createdBy)
    {
        Guid id;
        await using (var conn = await db.OpenConnectionAsync())
        {
            id = await conn.ExecuteScalarAsync<Guid>(
                "INSERT INTO stores (name, description, created_by) VALUES (@Name, @Description, @createdBy) RETURNING id",
                new { input.Name, input.Description, createdBy });
        }
        return (await db.FindStoreById(id))!;
    }

    public static async Task<StoreRow?> UpdateStore(this NpgsqlDataSource db, Guid id, StoreInput input)
    {
        await using (var conn = await db.OpenConnectionAsync())
        {
            var updated = await conn.ExecuteAsync(
                "UPDATE stores SET name = @Name, description = @Description WHERE id = @id AND deleted_at IS NULL",
                new { input.Name, input.Description, id });
            if (updated == 0) return null;
        }
        return await db.FindStoreById(id);
    }

    // Soft-deletes the store and takes its unsold products off sale. Rows are
    // kept because orders may reference the store's listings.
    public static async Task<bool> DeleteStore(this NpgsqlDataSource db, Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        var deleted = await conn.ExecuteAsync(
            "UPDATE stores SET deleted_at = now() WHERE id = @id AND deleted_at IS NULL", new { id }, tx);
        if (deleted == 0) return false; // rolled back on dispose
        await conn.ExecuteAsync(
            "UPDATE listings SET status = 'ended' WHERE store_id = @id AND status = 'active'", new { id }, tx);
        await tx.CommitAsync();
        return true;
    }
}
