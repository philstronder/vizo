using Npgsql;
using Vizo.Api.Db;
using Vizo.Api.Lib;

namespace Vizo.Api.Middleware;

// Records the user id when a valid auth cookie is present, but does not reject
// the request otherwise. Use RequireAuth to enforce authentication.
public sealed class AttachUserMiddleware(RequestDelegate next, AppEnv env)
{
    private const string UserIdKey = "userId";

    public Task InvokeAsync(HttpContext ctx)
    {
        // An invalid/expired token is treated as signed out.
        if (ctx.Request.Cookies.TryGetValue(Jwt.CookieName, out var token) &&
            Jwt.Verify(token, env.JwtSecret) is { } userId)
        {
            ctx.Items[UserIdKey] = userId;
        }
        return next(ctx);
    }

    public static Guid? UserIdOf(HttpContext ctx) => ctx.Items[UserIdKey] as Guid?;
}

public static class AuthExtensions
{
    public static Guid? UserId(this HttpContext ctx) => AttachUserMiddleware.UserIdOf(ctx);

    // For handlers behind RequireAuth, where the id is always present.
    public static Guid RequiredUserId(this HttpContext ctx) => ctx.UserId() ?? throw HttpError.Unauthorized();

    public static TBuilder RequireAuth<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (filterCtx, next) =>
        {
            if (filterCtx.HttpContext.UserId() is null) throw HttpError.Unauthorized();
            return await next(filterCtx);
        });

    public static TBuilder RequireAdmin<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter(async (filterCtx, next) =>
        {
            var http = filterCtx.HttpContext;
            var userId = http.UserId() ?? throw HttpError.Unauthorized();
            var db = http.RequestServices.GetRequiredService<NpgsqlDataSource>();
            var user = await db.FindUserById(userId);
            if (user is not { IsAdmin: true }) throw HttpError.Forbidden("Only admins can do this");
            return await next(filterCtx);
        });
}
