using Vizo.Api.Db;

namespace Vizo.Api.Lib;

// Request shapes shared by more than one route group (backend/src/lib/schemas.ts).

public sealed record DeliveryAddressBody(
    string? PostalCode, string? Street, string? Number, string? Complement,
    string? District, string? City, string? State);

// Added by admins, or by a resident at sign-up when theirs is missing from the
// list. A condominium's address has no complement.
public sealed record CondominiumBody(string? Name, DeliveryAddressBody? Address);

public static class Schemas
{
    public static DeliveryAddress DeliveryAddress(Validator v, DeliveryAddressBody? body, string[] path, bool withComplement = true)
    {
        if (body is null)
        {
            v.Add("Address is required", path);
            return new DeliveryAddress("", "", "", null, "", "", "");
        }
        return new DeliveryAddress(
            PostalCode: v.Required(body.PostalCode, "Postal code is required", [.. path, "postalCode"]),
            Street: v.Required(body.Street, "Street is required", [.. path, "street"]),
            Number: v.Required(body.Number, "Number is required", [.. path, "number"]),
            Complement: withComplement ? Validator.Optional(body.Complement) : null,
            District: v.Required(body.District, "District is required", [.. path, "district"]),
            City: v.Required(body.City, "City is required", [.. path, "city"]),
            State: v.Required(body.State, "State is required", [.. path, "state"]));
    }

    public static (string Name, DeliveryAddress Address) Condominium(Validator v, CondominiumBody body, string[] path) =>
        (v.Required(body.Name, "Name is required", [.. path, "name"]),
         DeliveryAddress(v, body.Address, [.. path, "address"], withComplement: false));
}
