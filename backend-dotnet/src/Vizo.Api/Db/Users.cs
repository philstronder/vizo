using Dapper;
using Npgsql;
using Vizo.Api.Lib;

namespace Vizo.Api.Db;

// Rows carrying the address_* columns: a user, a condominium, or an order's buyer.
public abstract class AddressColumns
{
    public string? AddressPostalCode { get; init; }
    public string? AddressStreet { get; init; }
    public string? AddressNumber { get; init; }
    public string? AddressComplement { get; init; }
    public string? AddressDistrict { get; init; }
    public string? AddressCity { get; init; }
    public string? AddressState { get; init; }

    public DeliveryAddress? DeliveryAddress => AddressStreet is null
        ? null
        : new DeliveryAddress(
            PostalCode: AddressPostalCode ?? "",
            Street: AddressStreet,
            Number: AddressNumber ?? "",
            Complement: AddressComplement,
            District: AddressDistrict ?? "",
            City: AddressCity ?? "",
            State: AddressState ?? "");
}

public sealed class UserRow : AddressColumns
{
    public Guid Id { get; init; }
    public string Name { get; init; } = "";
    public string Email { get; init; } = "";
    public string PasswordHash { get; init; } = "";
    public string? BuildingName { get; init; } // null for TV store viewer accounts
    public string? BuildingBlock { get; init; }
    public string? UnitNumber { get; init; }
    public string? Phone { get; init; }
    public bool Verified { get; init; }
    public bool IsAdmin { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record DeliveryAddress(
    string PostalCode, string Street, string Number, string? Complement,
    string District, string City, string State);

public sealed record PublicUser(
    Guid Id,
    string Name,
    string Email,
    string? BuildingName,
    string? BuildingBlock,
    string? UnitNumber,
    string? Phone,
    DeliveryAddress? DeliveryAddress,
    bool Verified,
    bool IsAdmin,
    string MemberSince)
{
    public static PublicUser From(UserRow row) => new(
        row.Id,
        row.Name,
        row.Email,
        row.BuildingName,
        row.BuildingBlock,
        row.UnitNumber,
        row.Phone,
        row.DeliveryAddress,
        row.Verified,
        row.IsAdmin,
        Iso.Format(row.CreatedAt));
}

public sealed record CreateUserInput(
    string Name,
    string Email,
    string PasswordHash,
    // Building residents give a building and unit; TV store viewers give a
    // phone and delivery address instead.
    string? BuildingName = null,
    string? BuildingBlock = null,
    string? UnitNumber = null,
    string? Phone = null,
    DeliveryAddress? DeliveryAddress = null,
    // Address verification is a manual/async review step in a real deployment.
    // Accounts are marked verified immediately so the mock flow stays usable;
    // flip the default to false once that review step exists.
    bool Verified = true);

// Null fields keep their saved value; a building can be added but not removed.
public sealed record UpdateUserInput(
    string Name,
    string? BuildingName,
    string? UnitNumber,
    string? BuildingBlock, // "" clears it
    string? Phone,
    DeliveryAddress? DeliveryAddress);

public static class Users
{
    public static async Task<UserRow?> FindUserByEmail(this NpgsqlDataSource db, string email)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<UserRow>("SELECT * FROM users WHERE email = @email", new { email });
    }

    public static async Task<UserRow?> FindUserById(this NpgsqlDataSource db, Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<UserRow>("SELECT * FROM users WHERE id = @id", new { id });
    }

    public static async Task<UserRow> CreateUser(this NpgsqlDataSource db, CreateUserInput input)
    {
        await using var conn = await db.OpenConnectionAsync();
        var address = AddressParams.From(input.DeliveryAddress);
        return await conn.QuerySingleAsync<UserRow>(
            """
            INSERT INTO users (name, email, password_hash, building_name, unit_number, verified, phone,
              address_postal_code, address_street, address_number, address_complement, address_district, address_city, address_state, building_block)
            VALUES (@Name, @Email, @PasswordHash, @BuildingName, @UnitNumber, @Verified, @Phone,
              @PostalCode, @Street, @Number, @Complement, @District, @City, @State, @BuildingBlock)
            RETURNING *
            """,
            new
            {
                input.Name,
                input.Email,
                input.PasswordHash,
                input.BuildingName,
                input.UnitNumber,
                input.Verified,
                input.Phone,
                address.PostalCode,
                address.Street,
                address.Number,
                address.Complement,
                address.District,
                address.City,
                address.State,
                BuildingBlock = NullIfEmpty(input.BuildingBlock),
            });
    }

    public static async Task<UserRow?> UpdateUser(this NpgsqlDataSource db, Guid id, UpdateUserInput input)
    {
        await using var conn = await db.OpenConnectionAsync();
        var address = AddressParams.From(input.DeliveryAddress);
        return await conn.QuerySingleOrDefaultAsync<UserRow>(
            """
            UPDATE users SET
              name = @Name,
              building_name = COALESCE(@BuildingName, building_name),
              unit_number = COALESCE(@UnitNumber, unit_number),
              phone = COALESCE(@Phone, phone),
              address_postal_code = CASE WHEN @HasAddress THEN @PostalCode ELSE address_postal_code END,
              address_street = CASE WHEN @HasAddress THEN @Street ELSE address_street END,
              address_number = CASE WHEN @HasAddress THEN @Number ELSE address_number END,
              address_complement = CASE WHEN @HasAddress THEN @Complement ELSE address_complement END,
              address_district = CASE WHEN @HasAddress THEN @District ELSE address_district END,
              address_city = CASE WHEN @HasAddress THEN @City ELSE address_city END,
              address_state = CASE WHEN @HasAddress THEN @State ELSE address_state END,
              building_block = CASE WHEN @HasBuildingBlock THEN @BuildingBlock ELSE building_block END
            WHERE id = @Id RETURNING *
            """,
            new
            {
                Id = id,
                input.Name,
                input.BuildingName,
                input.UnitNumber,
                input.Phone,
                HasAddress = input.DeliveryAddress is not null,
                address.PostalCode,
                address.Street,
                address.Number,
                address.Complement,
                address.District,
                address.City,
                address.State,
                HasBuildingBlock = input.BuildingBlock is not null,
                BuildingBlock = NullIfEmpty(input.BuildingBlock),
            });
    }

    public static async Task<UserRow?> SetUserAdmin(this NpgsqlDataSource db, string email, bool isAdmin)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<UserRow>(
            "UPDATE users SET is_admin = @isAdmin WHERE email = @email RETURNING *", new { isAdmin, email });
    }

    // Building names are typed in freely at sign-up, so communities are matched
    // case- and whitespace-insensitively. Accounts without a building (TV store
    // viewers) belong to no community.
    public static bool SameBuilding(string? a, string? b) =>
        a is not null && b is not null &&
        string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);

    public static async Task<IEnumerable<UserRow>> ListAdmins(this NpgsqlDataSource db)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QueryAsync<UserRow>("SELECT * FROM users WHERE is_admin ORDER BY name");
    }

    public static async Task<UserRow?> SetUserAdminById(this NpgsqlDataSource db, Guid id, bool isAdmin)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<UserRow>(
            "UPDATE users SET is_admin = @isAdmin WHERE id = @id RETURNING *", new { isAdmin, id });
    }

    private static string? NullIfEmpty(string? value) => string.IsNullOrEmpty(value) ? null : value;
}

// The address_* column values for an optional address (all null without one).
public sealed record AddressParams(
    string? PostalCode, string? Street, string? Number, string? Complement,
    string? District, string? City, string? State)
{
    public static AddressParams From(DeliveryAddress? address) => new(
        address?.PostalCode,
        address?.Street,
        address?.Number,
        string.IsNullOrEmpty(address?.Complement) ? null : address.Complement,
        address?.District,
        address?.City,
        address?.State);
}
