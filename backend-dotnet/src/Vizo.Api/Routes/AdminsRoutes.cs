using Npgsql;
using Vizo.Api.Db;
using Vizo.Api.Lib;
using Vizo.Api.Middleware;

namespace Vizo.Api.Routes;

// Admins manage the admin list themselves. The first admin is created with the
// `make-admin` command.
public static class AdminsRoutes
{
    private sealed record AddAdminBody(string? Email);

    public static RouteGroupBuilder MapAdminsRoutes(this RouteGroupBuilder group)
    {
        group.RequireAdmin();
        group.MapGet("/", List);
        group.MapPost("/", Add);
        group.MapDelete("/{id}", Remove);
        return group;
    }

    private static async Task<IResult> List(NpgsqlDataSource db) =>
        Results.Json((await db.ListAdmins()).Select(PublicUser.From));

    // Promotes an existing account; the person has to sign up first.
    private static async Task<IResult> Add(HttpContext ctx, NpgsqlDataSource db)
    {
        var body = await RequestBody.Read<AddAdminBody>(ctx.Request);
        var v = new Validator();
        var email = v.Email(body.Email, "email");
        v.ThrowIfInvalid();

        var user = await db.FindUserByEmail(email)
            ?? throw HttpError.NotFound("No account with this email. Ask them to sign up first.");
        var updated = await db.SetUserAdminById(user.Id, true);
        return Results.Json(PublicUser.From(updated!), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> Remove(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var userId = Ids.Parse(id);
        // Admins can't demote themselves, so there's always at least one admin left.
        if (userId == ctx.RequiredUserId()) throw HttpError.BadRequest("You can't remove your own admin access");
        _ = await db.SetUserAdminById(userId, false) ?? throw HttpError.NotFound("User not found");
        return Results.NoContent();
    }
}
