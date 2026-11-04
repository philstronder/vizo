using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Vizo.Api.Lib;

// HS256 tokens interchangeable with the Node backend's jsonwebtoken ones
// ({ userId, iat, exp }), so a session survives switching backends. Done by
// hand because Microsoft.IdentityModel refuses HMAC keys under 32 bytes, and
// existing JWT_SECRET values may be shorter.
public static class Jwt
{
    public const string CookieName = "vizo_token";
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    private static readonly byte[] Header =
        JsonSerializer.SerializeToUtf8Bytes(new { alg = "HS256", typ = "JWT" });

    public static string Sign(Guid userId, string secret)
    {
        var iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var payload = JsonSerializer.SerializeToUtf8Bytes(new
        {
            userId = userId.ToString(),
            iat,
            exp = iat + (long)Lifetime.TotalSeconds,
        });
        var signingInput = $"{Base64Url.EncodeToString(Header)}.{Base64Url.EncodeToString(payload)}";
        return $"{signingInput}.{Base64Url.EncodeToString(Hmac(signingInput, secret))}";
    }

    // Returns the user id, or null for a malformed, tampered or expired token.
    public static Guid? Verify(string token, string secret)
    {
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 3) return null;

            using var header = JsonDocument.Parse(Base64Url.DecodeFromChars(parts[0]));
            if (!header.RootElement.TryGetProperty("alg", out var alg) || alg.GetString() != "HS256") return null;

            var expected = Hmac($"{parts[0]}.{parts[1]}", secret);
            if (!CryptographicOperations.FixedTimeEquals(expected, Base64Url.DecodeFromChars(parts[2]))) return null;

            using var payload = JsonDocument.Parse(Base64Url.DecodeFromChars(parts[1]));
            var claims = payload.RootElement;
            if (claims.TryGetProperty("exp", out var exp) &&
                DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= exp.GetInt64()) return null;

            return claims.TryGetProperty("userId", out var userId) && Guid.TryParse(userId.GetString(), out var id)
                ? id
                : null;
        }
        catch (Exception e) when (e is FormatException or JsonException or InvalidOperationException)
        {
            return null;
        }
    }

    private static byte[] Hmac(string signingInput, string secret) =>
        HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(signingInput));
}
