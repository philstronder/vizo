using Npgsql;
using Vizo.Api.Db;
using Vizo.Api.Lib;
using Vizo.Api.Middleware;

namespace Vizo.Api.Routes;

// The condominiums residents can pick at sign-up. Anyone can read the list
// (the sign-up form is public); only admins change it.
public static class CondominiumsRoutes
{
    public static RouteGroupBuilder MapCondominiumsRoutes(this RouteGroupBuilder group)
    {
        group.MapGet("/", List);
        group.MapPost("/", Create).RequireAdmin();
        group.MapDelete("/{id}", Delete).RequireAdmin();
        return group;
    }

    private static async Task<IResult> List(NpgsqlDataSource db) =>
        Results.Json((await db.ListCondominiums()).Select(ApiCondominium.From));

    private static async Task<IResult> Create(HttpContext ctx, NpgsqlDataSource db)
    {
        var body = await RequestBody.Read<CondominiumBody>(ctx.Request);
        var v = new Validator();
        var (name, address) = Schemas.Condominium(v, body, []);
        v.ThrowIfInvalid();

        var row = await db.CreateCondominium(name, address)
            ?? throw HttpError.Conflict("This condominium is already on the list");
        return Results.Json(ApiCondominium.From(row), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> Delete(string id, NpgsqlDataSource db)
    {
        if (!await db.DeleteCondominium(Ids.Parse(id))) throw HttpError.NotFound("Condominium not found");
        return Results.NoContent();
    }
}
