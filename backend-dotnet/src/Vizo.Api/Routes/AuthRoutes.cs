using Npgsql;
using Vizo.Api.Db;
using Vizo.Api.Lib;
using Vizo.Api.Middleware;

namespace Vizo.Api.Routes;

public static class AuthRoutes
{
    // Building residents join their building's community; TV store viewers
    // (accountType "viewer") only shop in TV stores, so they give a phone and a
    // delivery address instead of a building.
    private sealed record RegisterBody(
        string? AccountType,
        string? Name,
        string? Email,
        string? Password,
        // resident
        string? UnitNumber,
        // Either a condominium from the list, or one to add to it.
        string? BuildingName,
        CondominiumBody? NewCondominium,
        string? BuildingBlock,
        // viewer
        string? Phone,
        DeliveryAddressBody? DeliveryAddress);

    private sealed record LoginBody(string? Email, string? Password);

    // Omitted fields keep their saved value. A building and unit go together, so
    // a viewer account can join a community but nobody can leave theirs.
    private sealed record UpdateMeBody(
        string? Name,
        string? BuildingName,
        string? UnitNumber,
        string? BuildingBlock, // empty clears it; not every condominium has blocks
        string? Phone,
        DeliveryAddressBody? DeliveryAddress);

    public static RouteGroupBuilder MapAuthRoutes(this RouteGroupBuilder group)
    {
        group.MapPost("/register", Register);
        group.MapPost("/login", Login);
        group.MapPost("/logout", Logout);
        group.MapGet("/me", GetMe).RequireAuth();
        group.MapPatch("/me", UpdateMe).RequireAuth();
        return group;
    }

    private static async Task<IResult> Register(HttpContext ctx, NpgsqlDataSource db, AppEnv env)
    {
        var body = await RequestBody.Read<RegisterBody>(ctx.Request);
        var v = new Validator();
        var accountType = body.AccountType ?? "resident";
        var name = v.Required(body.Name, "Name is required", "name");
        var email = v.Email(body.Email, "email");
        var password = v.MinLength(body.Password, 6, "Password must be at least 6 characters", "password");
        if (accountType is not ("resident" or "viewer"))
        {
            v.Add("Invalid account type", "accountType");
            v.ThrowIfInvalid();
        }

        CreateUserInput input;
        if (accountType == "resident")
        {
            var unitNumber = v.Required(body.UnitNumber, "Unit number is required", "unitNumber");
            var buildingName = body.BuildingName is null ? null : v.Required(body.BuildingName, "Building name is required", "buildingName");
            var newCondominium = body.NewCondominium is null ? ((string, DeliveryAddress)?)null : Schemas.Condominium(v, body.NewCondominium, ["newCondominium"]);
            v.ThrowIfInvalid();
            if (await db.FindUserByEmail(email) is not null) throw HttpError.Conflict("An account with this email already exists");

            // Residents pick from the admin-maintained list, or add their condominium
            // when it's missing. Store the list's exact name so everyone in the
            // community shows the same spelling.
            if (newCondominium is var (condoName, condoAddress))
            {
                var created = await db.CreateCondominium(condoName, condoAddress)
                    ?? throw HttpError.Conflict("This condominium is already on the list; choose it there");
                buildingName = created.Name;
            }
            else
            {
                var condominium = buildingName is null ? null : await db.FindCondominiumByName(buildingName);
                buildingName = condominium?.Name ?? throw HttpError.BadRequest("Choose a condominium from the list");
            }

            input = new CreateUserInput(name, email, Passwords.Hash(password),
                BuildingName: buildingName, BuildingBlock: Validator.Optional(body.BuildingBlock), UnitNumber: unitNumber);
        }
        else
        {
            var phone = v.MinLength(body.Phone?.Trim(), 8, "Phone is required", "phone");
            var address = Schemas.DeliveryAddress(v, body.DeliveryAddress, ["deliveryAddress"]);
            v.ThrowIfInvalid();
            if (await db.FindUserByEmail(email) is not null) throw HttpError.Conflict("An account with this email already exists");

            input = new CreateUserInput(name, email, Passwords.Hash(password), Phone: phone, DeliveryAddress: address);
        }

        var user = await db.CreateUser(input);
        SetAuthCookie(ctx, env, user.Id);
        return Results.Json(PublicUser.From(user), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> Login(HttpContext ctx, NpgsqlDataSource db, AppEnv env)
    {
        var body = await RequestBody.Read<LoginBody>(ctx.Request);
        var v = new Validator();
        var email = v.Email(body.Email, "email");
        var password = v.MinLength(body.Password, 1, "Password is required", "password");
        v.ThrowIfInvalid();

        var user = await db.FindUserByEmail(email);
        if (user is null || !Passwords.Verify(password, user.PasswordHash))
            throw HttpError.Unauthorized("Invalid email or password");

        SetAuthCookie(ctx, env, user.Id);
        return Results.Json(PublicUser.From(user));
    }

    private static IResult Logout(HttpContext ctx)
    {
        ctx.Response.Cookies.Delete(Jwt.CookieName, new CookieOptions { Path = "/" });
        return Results.NoContent();
    }

    private static async Task<IResult> GetMe(HttpContext ctx, NpgsqlDataSource db)
    {
        var user = await db.FindUserById(ctx.RequiredUserId()) ?? throw HttpError.NotFound("User not found");
        return Results.Json(PublicUser.From(user));
    }

    private static async Task<IResult> UpdateMe(HttpContext ctx, NpgsqlDataSource db)
    {
        var userId = ctx.RequiredUserId();
        var body = await RequestBody.Read<UpdateMeBody>(ctx.Request);
        var v = new Validator();
        var name = v.Required(body.Name, "Name is required", "name");
        var buildingName = body.BuildingName is null ? null : v.Required(body.BuildingName, "Building name is required", "buildingName");
        var unitNumber = body.UnitNumber is null ? null : v.Required(body.UnitNumber, "Unit number is required", "unitNumber");
        var phone = body.Phone is null ? null : v.MinLength(body.Phone.Trim(), 8, "Phone is required", "phone");
        var address = body.DeliveryAddress is null ? null : Schemas.DeliveryAddress(v, body.DeliveryAddress, ["deliveryAddress"]);
        if (v.IsValid && (buildingName is null) != (unitNumber is null))
            v.Add("Building name and unit number go together", "unitNumber");
        v.ThrowIfInvalid();

        // Communities are matched by condominium name, so it has to come from the
        // admin list (stored with the list's spelling). Keeping the current one is
        // always allowed, even if admins have since removed it from the list.
        if (buildingName is not null)
        {
            var current = await db.FindUserById(userId) ?? throw HttpError.NotFound("User not found");
            if (!Users.SameBuilding(current.BuildingName, buildingName))
            {
                var condominium = await db.FindCondominiumByName(buildingName)
                    ?? throw HttpError.BadRequest("Choose a condominium from the list");
                buildingName = condominium.Name;
            }
            else
            {
                buildingName = current.BuildingName!;
            }
        }

        var user = await db.UpdateUser(userId, new UpdateUserInput(
                name, buildingName, unitNumber, Validator.Optional(body.BuildingBlock), phone, address))
            ?? throw HttpError.NotFound("User not found");
        return Results.Json(PublicUser.From(user));
    }

    private static void SetAuthCookie(HttpContext ctx, AppEnv env, Guid userId) =>
        ctx.Response.Cookies.Append(Jwt.CookieName, Jwt.Sign(userId, env.JwtSecret), new CookieOptions
        {
            HttpOnly = true,
            Secure = env.CookieSecure,
            SameSite = SameSiteMode.Lax,
            MaxAge = Jwt.Lifetime,
            Expires = DateTimeOffset.UtcNow.Add(Jwt.Lifetime),
            Path = "/",
        });
}
