using System.Text.Json;
using System.Text.RegularExpressions;
using Vizo.Api.Lib;

namespace Vizo.Api.Routes;

// Looks up a Brazilian postal code (CEP) on ViaCEP so address forms can fill
// in street, district, city and state. Public, since viewer sign-up uses it.
public static partial class CepRoutes
{
    public const string HttpClientName = "viacep";

    private sealed record ViaCepResponse(string? Logradouro, string? Bairro, string? Localidade, string? Uf, JsonElement? Erro);

    public static RouteGroupBuilder MapCepRoutes(this RouteGroupBuilder group)
    {
        group.MapGet("/{cep}", Lookup);
        return group;
    }

    private static async Task<IResult> Lookup(string cep, IHttpClientFactory httpClientFactory)
    {
        var digits = NonDigits().Replace(cep, "");
        if (digits.Length != 8) throw HttpError.BadRequest("CEP must have 8 digits");

        ViaCepResponse data;
        try
        {
            var client = httpClientFactory.CreateClient(HttpClientName);
            data = await client.GetFromJsonAsync<ViaCepResponse>($"https://viacep.com.br/ws/{digits}/json/")
                ?? throw new InvalidOperationException("ViaCEP returned null");
        }
        catch (Exception)
        {
            throw new HttpError(502, "CEP lookup is unavailable");
        }
        // ViaCEP answers unknown CEPs with { "erro": true } (or "true").
        if (data.Erro is { ValueKind: JsonValueKind.True } ||
            data.Erro is { ValueKind: JsonValueKind.String } erro && erro.GetString() is { Length: > 0 })
            throw HttpError.NotFound("CEP not found");

        return Results.Json(new
        {
            postalCode = $"{digits[..5]}-{digits[5..]}",
            street = data.Logradouro ?? "",
            district = data.Bairro ?? "",
            city = data.Localidade ?? "",
            state = data.Uf ?? "",
        });
    }

    [GeneratedRegex(@"\D")]
    private static partial Regex NonDigits();
}
