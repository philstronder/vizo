using Npgsql;
using Vizo.Api.Db;
using Vizo.Api.Lib;
using Vizo.Api.Middleware;

namespace Vizo.Api.Routes;

public static class ListingsRoutes
{
    private static readonly string[] Categories =
        ["furniture", "electronics", "appliances", "vehicles", "clothing", "books", "plants", "services", "other"];
    private static readonly string[] Conditions = ["new", "used-excellent", "used-good"];
    private static readonly int[] AuctionDurationDays = [1, 3, 7];

    private sealed record CreateListingBody(
        string? Title,
        string? Description,
        string? Category,
        string? Condition,
        string[]? Images,
        string? Type,
        double? Price,
        double? StartingPrice,
        int? AuctionDurationDays,
        string? StoreId,
        int? Quantity);

    private sealed record RestockBody(int? Quantity);

    private sealed record PlaceBidBody(double? Amount);

    private sealed record PostMessageBody(string? Body);

    public static RouteGroupBuilder MapListingsRoutes(this RouteGroupBuilder group)
    {
        group.MapGet("/", List);
        group.MapPost("/", Create).RequireAuth();
        group.MapGet("/{id}", Get);
        group.MapDelete("/{id}", Delete).RequireAuth();
        group.MapPost("/{id}/restock", Restock).RequireAdmin();
        group.MapGet("/{id}/bids", ListBids);
        group.MapPost("/{id}/bids", PlaceBid).RequireAuth();
        group.MapGet("/{id}/messages", ListMessages);
        group.MapPost("/{id}/messages", PostMessage).RequireAuth();
        return group;
    }

    private static async Task<IResult> List(HttpContext ctx, NpgsqlDataSource db)
    {
        var query = ctx.Request.Query;
        // Like Express' req.query, a repeated parameter isn't a single string.
        string? Single(string name) => query[name] is { Count: 1 } values ? values[0] : null;
        var status = Single("status");
        var sellerId = Single("sellerId");
        var storeId = Single("storeId");
        var type = Single("type");

        // Default to active-only for the general marketplace feed, but when
        // scoped to a specific seller (e.g. "My Listings"), show every status
        // unless the caller explicitly asks for one. "all" lifts the filter.
        var resolvedStatus = status == "all" ? null : status ?? (sellerId is not null ? null : "active");

        // A store's products are public. Everything else is the viewer's
        // building community, so it needs a signed-in viewer.
        ListingFilters scope;
        if (storeId is not null)
        {
            var store = await db.FindStoreById(Ids.Parse(storeId)) ?? throw HttpError.NotFound("Store not found");
            scope = new ListingFilters(StoreId: store.Id);
        }
        else
        {
            var viewerId = ctx.UserId() ?? throw HttpError.Unauthorized("Sign in to see your community's listings");
            var viewer = await db.FindUserById(viewerId) ?? throw HttpError.Unauthorized();
            if (viewer.BuildingName is null) throw HttpError.Forbidden("TV store accounts don't have a building community");
            scope = new ListingFilters(BuildingName: viewer.BuildingName);
        }

        var rows = await db.ListListings(scope with
        {
            Status = resolvedStatus,
            Category = Single("category"),
            Type = type is "direct" or "auction" ? type : null,
            Q = Single("q"),
            SellerId = string.IsNullOrEmpty(sellerId) ? null : Ids.Parse(sellerId),
        });
        return Results.Json(rows.Select(ApiListing.From));
    }

    private static async Task<IResult> Create(HttpContext ctx, NpgsqlDataSource db)
    {
        var userId = ctx.RequiredUserId();
        var body = await RequestBody.Read<CreateListingBody>(ctx.Request);
        var v = new Validator();
        var title = v.Required(body.Title, "Title is required", "title");
        var description = v.Required(body.Description, "Description is required", "description");
        v.Check(body.Category is not null && Categories.Contains(body.Category), "Invalid category", "category");
        v.Check(body.Condition is not null && Conditions.Contains(body.Condition), "Invalid condition", "condition");
        var images = body.Images ?? [];
        v.Check(images.Length <= 5, "At most 5 images", "images");
        v.Check(body.Type is "direct" or "auction", "Type must be direct or auction", "type");
        v.Check(body.Price is null or > 0, "Price must be positive", "price");
        v.Check(body.StartingPrice is null or > 0, "Starting price must be positive", "startingPrice");
        v.Check(body.AuctionDurationDays is null || AuctionDurationDays.Contains(body.AuctionDurationDays.Value),
            "Auction duration must be 1, 3 or 7 days", "auctionDurationDays");
        v.Check(body.StoreId is null || body.StoreId.Length > 0, "Store id can't be empty", "storeId");
        v.Check(body.Quantity is null or >= 1 and <= 100000, "Quantity must be from 1 to 100000", "quantity");
        if (v.IsValid)
        {
            v.Check(body.Type != "direct" || body.Price is not null, "price is required for direct sale listings", "price");
            v.Check(body.Type != "auction" || body.StartingPrice is not null, "startingPrice is required for auction listings", "startingPrice");
            v.Check(body.StoreId is null || body.Type == "direct", "store products must be direct sale listings", "type");
            v.Check(body.StoreId is null || body.Condition == "new", "store products must be new", "condition");
            v.Check(body.StoreId is not null || body.Quantity is null or 1, "only store products can have more than one unit", "quantity");
        }
        v.ThrowIfInvalid();

        var seller = await db.FindUserById(userId) ?? throw HttpError.Unauthorized();
        Guid? storeId = null;
        if (body.StoreId is not null)
        {
            if (!seller.IsAdmin) throw HttpError.Forbidden("Only admins can add products to a store");
            storeId = Ids.Parse(body.StoreId);
            if (await db.FindStoreById(storeId.Value) is null) throw HttpError.NotFound("Store not found");
        }
        else if (seller.BuildingName is null)
        {
            throw HttpError.Forbidden("Add a building to your profile to list items in a community");
        }

        var listing = await db.CreateListing(new CreateListingInput(
            SellerId: userId,
            StoreId: storeId,
            Title: title,
            Description: description,
            Category: body.Category!,
            Condition: body.Condition!,
            Images: images,
            Type: body.Type!,
            Quantity: body.Quantity,
            Price: body.Price,
            StartingPrice: body.StartingPrice,
            AuctionEndsAt: body.Type == "auction" ? DateTime.UtcNow.AddDays(body.AuctionDurationDays ?? 3) : null));
        return Results.Json(ApiListing.From(listing), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> Get(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var listing = await db.FindViewableListing(Ids.Parse(id), ctx.UserId());
        return Results.Json(ApiListing.From(listing));
    }

    private static async Task<IResult> Delete(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        if (!await db.DeleteListing(Ids.Parse(id), ctx.RequiredUserId()))
            throw HttpError.NotFound("Listing not found, or you don't own it");
        return Results.NoContent();
    }

    // Admins add units to a store product, which also re-publishes it once sold out.
    private static async Task<IResult> Restock(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var listingId = Ids.Parse(id);
        var body = await RequestBody.Read<RestockBody>(ctx.Request);
        var v = new Validator();
        v.Check(body.Quantity is >= 1 and <= 100000, "Quantity must be from 1 to 100000", "quantity");
        v.ThrowIfInvalid();

        if (!await db.RestockListing(listingId, body.Quantity!.Value))
            throw HttpError.NotFound("Store product not found, or it can't be restocked");
        var listing = await db.FindListingById(listingId);
        return Results.Json(ApiListing.From(listing!));
    }

    private static async Task<IResult> ListBids(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var listing = await db.FindViewableListing(Ids.Parse(id), ctx.UserId());
        return Results.Json((await db.ListBidsForListing(listing.Id)).Select(ApiBid.From));
    }

    private static async Task<IResult> PlaceBid(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var listingId = Ids.Parse(id);
        var userId = ctx.RequiredUserId();
        var body = await RequestBody.Read<PlaceBidBody>(ctx.Request);
        var v = new Validator();
        v.Check(body.Amount is > 0, "Amount must be positive", "amount");
        v.ThrowIfInvalid();
        var amount = body.Amount!.Value;

        var listing = await db.FindViewableListing(listingId, userId);
        if (listing.SellerId == userId) throw HttpError.Forbidden("You cannot bid on your own listing");

        if (await db.PlaceBidTx(listingId, userId, amount) is { } reason) throw HttpError.BadRequest(reason);

        await db.CreateNotification(new CreateNotificationInput(
            listing.SellerId, "new_bid", $"New bid on {listing.Title}", $"Someone bid ${amount}.", $"/listing/{listing.Id}"));

        var updated = await db.FindListingById(listingId);
        return Results.Json(ApiListing.From(updated!), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> ListMessages(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var listing = await db.FindViewableListing(Ids.Parse(id), ctx.UserId());
        // TV show store products have no seller Q&A.
        if (listing.StoreId is not null) return Results.Json(Array.Empty<ApiMessage>());
        return Results.Json((await db.ListMessagesForListing(listing.Id)).Select(ApiMessage.From));
    }

    private static async Task<IResult> PostMessage(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var listingId = Ids.Parse(id);
        var userId = ctx.RequiredUserId();
        var body = await RequestBody.Read<PostMessageBody>(ctx.Request);
        var v = new Validator();
        var text = v.Required(body.Body, "Message can't be empty", "body");
        v.ThrowIfInvalid();

        var listing = await db.FindViewableListing(listingId, userId);
        if (listing.StoreId is not null) throw HttpError.BadRequest("Store products don't take questions");

        var message = await db.CreateMessage(listingId, userId, text);

        if (userId != listing.SellerId)
        {
            await db.CreateNotification(new CreateNotificationInput(
                listing.SellerId, "message", $"New message on {listing.Title}", text, $"/listing/{listing.Id}"));
        }

        return Results.Json(ApiMessage.From(message), statusCode: StatusCodes.Status201Created);
    }
}
