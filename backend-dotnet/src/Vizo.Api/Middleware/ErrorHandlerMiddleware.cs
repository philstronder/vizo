using Npgsql;
using Vizo.Api.Lib;

namespace Vizo.Api.Middleware;

public sealed class ErrorHandlerMiddleware(RequestDelegate next, ILogger<ErrorHandlerMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (Exception err) when (!ctx.Response.HasStarted)
        {
            var (status, body) = err switch
            {
                ValidationException e => (400, (object)new { message = "Invalid request", issues = e.Issues }),
                HttpError e => (e.Status, new { message = e.Message }),
                // invalid_text_representation: a malformed UUID in the URL, e.g. a
                // mistyped store link. Nothing can match it, so treat it as not found.
                PostgresException { SqlState: PostgresErrorCodes.InvalidTextRepresentation } =>
                    (404, new { message = "Not found" }),
                // Kestrel's own rejections, such as a body over the size limit.
                BadHttpRequestException e => (e.StatusCode, new { message = e.Message }),
                _ => (500, new { message = "Internal server error" }),
            };
            if (status == 500) logger.LogError(err, "Unhandled error");

            ctx.Response.Clear();
            ctx.Response.StatusCode = status;
            await ctx.Response.WriteAsJsonAsync(body);
        }
    }
}
