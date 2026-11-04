using Dapper;
using Npgsql;
using Vizo.Api.Lib;

namespace Vizo.Api.Db;

public sealed class NotificationRow
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string Type { get; init; } = "";
    public string Title { get; init; } = "";
    public string Body { get; init; } = "";
    public string? Href { get; init; }
    public bool Read { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record ApiNotification(Guid Id, string Type, string Title, string Body, string? Href, bool Read, string CreatedAt)
{
    public static ApiNotification From(NotificationRow row) =>
        new(row.Id, row.Type, row.Title, row.Body, row.Href, row.Read, Iso.Format(row.CreatedAt));
}

public sealed record CreateNotificationInput(Guid UserId, string Type, string Title, string Body, string? Href = null);

public static class Notifications
{
    public static async Task<IEnumerable<NotificationRow>> ListNotificationsForUser(this NpgsqlDataSource db, Guid userId)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QueryAsync<NotificationRow>(
            "SELECT * FROM notifications WHERE user_id = @userId ORDER BY created_at DESC", new { userId });
    }

    public static async Task CreateNotification(this NpgsqlDataSource db, CreateNotificationInput input)
    {
        await using var conn = await db.OpenConnectionAsync();
        await conn.ExecuteAsync(
            "INSERT INTO notifications (user_id, type, title, body, href) VALUES (@UserId, @Type::notification_type, @Title, @Body, @Href)",
            input);
    }

    public static async Task<bool> MarkNotificationRead(this NpgsqlDataSource db, Guid id, Guid userId)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.ExecuteAsync(
            "UPDATE notifications SET read = TRUE WHERE id = @id AND user_id = @userId", new { id, userId }) > 0;
    }

    public static async Task MarkAllNotificationsRead(this NpgsqlDataSource db, Guid userId)
    {
        await using var conn = await db.OpenConnectionAsync();
        await conn.ExecuteAsync("UPDATE notifications SET read = TRUE WHERE user_id = @userId AND read = FALSE", new { userId });
    }
}
