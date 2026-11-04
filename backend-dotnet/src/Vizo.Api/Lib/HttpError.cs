namespace Vizo.Api.Lib;

public sealed class HttpError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;

    public static HttpError BadRequest(string message) => new(400, message);
    public static HttpError Unauthorized(string message = "Not authenticated") => new(401, message);
    public static HttpError Forbidden(string message = "Not allowed") => new(403, message);
    public static HttpError NotFound(string message = "Not found") => new(404, message);
    public static HttpError Conflict(string message) => new(409, message);
}
