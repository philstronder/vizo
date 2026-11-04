namespace Vizo.Api.Lib;

public static class Ids
{
    // A malformed UUID in the URL (e.g. a mistyped store link) can't match
    // anything, so it's a 404, as Postgres' 22P02 is in the error handler.
    public static Guid Parse(string id) =>
        Guid.TryParse(id, out var guid) ? guid : throw HttpError.NotFound();
}

public static class Iso
{
    // Same shape as Date#toISOString().
    public static string Format(DateTime value) =>
        value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'");
}
