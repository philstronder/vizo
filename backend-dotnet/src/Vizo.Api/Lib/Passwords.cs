namespace Vizo.Api.Lib;

// Verifies the $2a/$2b hashes bcryptjs wrote, so existing accounts keep working.
public static class Passwords
{
    private const int SaltRounds = 10;

    public static string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, SaltRounds);

    public static bool Verify(string password, string hash) => BCrypt.Net.BCrypt.Verify(password, hash);
}
