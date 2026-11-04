using Npgsql;
using Vizo.Api.Db;
using Vizo.Api.Lib;
using Vizo.Api.Middleware;

namespace Vizo.Api.Routes;

public static class StoresRoutes
{
    private sealed record StoreBody(string? Name, string? Description);

    // Only admins see the full list of stores. Viewers reach a single store
    // through its QR code, so GET /{id} stays public.
    public static RouteGroupBuilder MapStoresRoutes(this RouteGroupBuilder group)
    {
        group.MapGet("/", List).RequireAdmin();
        group.MapGet("/{id}", Get);
        group.MapPost("/", Create).RequireAdmin();
        group.MapPatch("/{id}", Update).RequireAdmin();
        group.MapDelete("/{id}", Delete).RequireAdmin();
        return group;
    }

    private static async Task<IResult> List(NpgsqlDataSource db) =>
        Results.Json((await db.ListStores()).Select(ApiStore.From));

    private static async Task<IResult> Get(string id, NpgsqlDataSource db)
    {
        var store = await db.FindStoreById(Ids.Parse(id)) ?? throw HttpError.NotFound("Store not found");
        return Results.Json(ApiStore.From(store));
    }

    private static async Task<IResult> Create(HttpContext ctx, NpgsqlDataSource db)
    {
        var input = await ReadStoreInput(ctx.Request);
        var store = await db.CreateStore(input, ctx.RequiredUserId());
        return Results.Json(ApiStore.From(store), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> Update(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var storeId = Ids.Parse(id);
        var input = await ReadStoreInput(ctx.Request);
        var store = await db.UpdateStore(storeId, input) ?? throw HttpError.NotFound("Store not found");
        return Results.Json(ApiStore.From(store));
    }

    private static async Task<IResult> Delete(string id, NpgsqlDataSource db)
    {
        if (!await db.DeleteStore(Ids.Parse(id))) throw HttpError.NotFound("Store not found");
        return Results.NoContent();
    }

    private static async Task<StoreInput> ReadStoreInput(HttpRequest request)
    {
        var body = await RequestBody.Read<StoreBody>(request);
        var v = new Validator();
        var name = v.Required(body.Name, "Name is required", "name");
        var description = Validator.Optional(body.Description) ?? "";
        v.Check(description.Length <= 2000, "Description must be at most 2000 characters", "description");
        v.ThrowIfInvalid();
        return new StoreInput(name, description);
    }
}
