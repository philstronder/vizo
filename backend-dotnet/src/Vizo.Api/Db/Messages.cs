using Dapper;
using Npgsql;
using Vizo.Api.Lib;

namespace Vizo.Api.Db;

public sealed class MessageRow
{
    public Guid Id { get; init; }
    public Guid ListingId { get; init; }
    public Guid AuthorId { get; init; }
    public string AuthorName { get; init; } = "";
    public Guid SellerId { get; init; }
    public string Body { get; init; } = "";
    public DateTime CreatedAt { get; init; }
}

public sealed record ApiMessage(Guid Id, Guid ListingId, Guid AuthorId, string AuthorName, string Role, string Body, string CreatedAt)
{
    public static ApiMessage From(MessageRow row) => new(
        row.Id,
        row.ListingId,
        row.AuthorId,
        row.AuthorName,
        row.AuthorId == row.SellerId ? "seller" : "buyer",
        row.Body,
        Iso.Format(row.CreatedAt));
}

public static class Messages
{
    private const string MessageSelect = """
        SELECT m.*, u.name AS author_name, l.seller_id
        FROM messages m
        JOIN users u ON u.id = m.author_id
        JOIN listings l ON l.id = m.listing_id
        """;

    public static async Task<IEnumerable<MessageRow>> ListMessagesForListing(this NpgsqlDataSource db, Guid listingId)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QueryAsync<MessageRow>(
            $"{MessageSelect} WHERE m.listing_id = @listingId ORDER BY m.created_at ASC", new { listingId });
    }

    public static async Task<MessageRow> CreateMessage(this NpgsqlDataSource db, Guid listingId, Guid authorId, string body)
    {
        await using var conn = await db.OpenConnectionAsync();
        var id = await conn.ExecuteScalarAsync<Guid>(
            "INSERT INTO messages (listing_id, author_id, body) VALUES (@listingId, @authorId, @body) RETURNING id",
            new { listingId, authorId, body });
        return await conn.QuerySingleAsync<MessageRow>($"{MessageSelect} WHERE m.id = @id", new { id });
    }
}
