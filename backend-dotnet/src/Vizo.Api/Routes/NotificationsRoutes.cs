using Npgsql;
using Vizo.Api.Db;
using Vizo.Api.Lib;
using Vizo.Api.Middleware;

namespace Vizo.Api.Routes;

public static class NotificationsRoutes
{
    public static RouteGroupBuilder MapNotificationsRoutes(this RouteGroupBuilder group)
    {
        group.RequireAuth();
        group.MapGet("/", List);
        group.MapPatch("/read-all", ReadAll);
        group.MapPatch("/{id}/read", Read);
        return group;
    }

    private static async Task<IResult> List(HttpContext ctx, NpgsqlDataSource db) =>
        Results.Json((await db.ListNotificationsForUser(ctx.RequiredUserId())).Select(ApiNotification.From));

    private static async Task<IResult> ReadAll(HttpContext ctx, NpgsqlDataSource db)
    {
        await db.MarkAllNotificationsRead(ctx.RequiredUserId());
        return Results.NoContent();
    }

    private static async Task<IResult> Read(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        if (!await db.MarkNotificationRead(Ids.Parse(id), ctx.RequiredUserId()))
            throw HttpError.NotFound("Notification not found");
        return Results.NoContent();
    }
}
