using System.Text.Json;
using System.Text.RegularExpressions;

namespace Vizo.Api.Lib;

// Stand-in for zod: request bodies bind to DTOs with nullable fields, then a
// Validator trims and checks them, collecting issues that the error handler
// returns as { message: "Invalid request", issues } with status 400.
public sealed record ValidationIssue(string[] Path, string Message);

public sealed class ValidationException(IReadOnlyList<ValidationIssue> issues) : Exception("Invalid request")
{
    public IReadOnlyList<ValidationIssue> Issues { get; } = issues;
}

public sealed partial class Validator
{
    private readonly List<ValidationIssue> _issues = [];

    // Trimmed value; a missing or blank one is reported with `message`.
    public string Required(string? value, string message, params string[] path)
    {
        var trimmed = value?.Trim() ?? "";
        if (trimmed.Length == 0) Add(message, path);
        return trimmed;
    }

    public static string? Optional(string? value) => value?.Trim();

    public string Email(string? value, params string[] path)
    {
        var trimmed = value?.Trim() ?? "";
        if (!EmailPattern().IsMatch(trimmed)) Add("Invalid email address", path);
        return trimmed;
    }

    public string MinLength(string? value, int min, string message, params string[] path)
    {
        if ((value?.Length ?? 0) < min) Add(message, path);
        return value ?? "";
    }

    // Cross-field checks (zod's .refine) only run once the fields themselves are valid.
    public bool IsValid => _issues.Count == 0;

    public void Check(bool condition, string message, params string[] path)
    {
        if (!condition) Add(message, path);
    }

    public void Add(string message, params string[] path) => _issues.Add(new ValidationIssue(path, message));

    public void ThrowIfInvalid()
    {
        if (_issues.Count > 0) throw new ValidationException(_issues);
    }

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();
}

public static class RequestBody
{
    // A missing, non-JSON or wrongly typed body is a 400, as zod would make it.
    public static async Task<T> Read<T>(HttpRequest request) where T : class
    {
        try
        {
            return await request.ReadFromJsonAsync<T>() ?? throw Invalid();
        }
        catch (Exception e) when (e is JsonException or InvalidOperationException)
        {
            throw Invalid();
        }
    }

    private static ValidationException Invalid() => new([new ValidationIssue([], "Expected a JSON object body")]);
}
