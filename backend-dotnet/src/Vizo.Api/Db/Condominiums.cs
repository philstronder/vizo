using Dapper;
using Npgsql;

namespace Vizo.Api.Db;

// Address columns are null for condominiums seeded from users.building_name.
public sealed class CondominiumRow : AddressColumns
{
    public Guid Id { get; init; }
    public string Name { get; init; } = "";
    public DateTime CreatedAt { get; init; }
}

public sealed record ApiCondominium(Guid Id, string Name, DeliveryAddress? Address)
{
    public static ApiCondominium From(CondominiumRow row) => new(row.Id, row.Name, row.DeliveryAddress);
}

public static class Condominiums
{
    public static async Task<IEnumerable<CondominiumRow>> ListCondominiums(this NpgsqlDataSource db)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QueryAsync<CondominiumRow>("SELECT * FROM condominiums ORDER BY name");
    }

    // Matched like users.building_name, ignoring case and surrounding spaces.
    public static async Task<CondominiumRow?> FindCondominiumByName(this NpgsqlDataSource db, string name)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<CondominiumRow>(
            "SELECT * FROM condominiums WHERE lower(trim(name)) = lower(trim(@name))", new { name });
    }

    // Null when a condominium with that name already exists.
    public static async Task<CondominiumRow?> CreateCondominium(this NpgsqlDataSource db, string name, DeliveryAddress address)
    {
        await using var conn = await db.OpenConnectionAsync();
        var p = AddressParams.From(address);
        return await conn.QuerySingleOrDefaultAsync<CondominiumRow>(
            """
            INSERT INTO condominiums
              (name, address_postal_code, address_street, address_number, address_complement, address_district, address_city, address_state)
            VALUES (@name, @PostalCode, @Street, @Number, @Complement, @District, @City, @State)
            ON CONFLICT DO NOTHING RETURNING *
            """,
            new { name, p.PostalCode, p.Street, p.Number, p.Complement, p.District, p.City, p.State });
    }

    // Residents who already joined keep their community; it just can't be picked
    // at sign-up anymore.
    public static async Task<bool> DeleteCondominium(this NpgsqlDataSource db, Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.ExecuteAsync("DELETE FROM condominiums WHERE id = @id", new { id }) > 0;
    }
}
