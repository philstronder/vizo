using Npgsql;
using Vizo.Api.Db;
using Vizo.Api.Lib;
using Vizo.Api.Middleware;

namespace Vizo.Api.Routes;

public static class OrdersRoutes
{
    private sealed record CheckoutBody(string? ListingId, string? PickupLocation, string? PickupTime);

    private sealed record ReviewBody(int? Rating, string? Comment);

    public static RouteGroupBuilder MapOrdersRoutes(this RouteGroupBuilder group)
    {
        group.MapGet("/mine", Mine).RequireAuth();
        group.MapPost("/", Checkout).RequireAuth();
        group.MapPatch("/{id}/complete", Complete).RequireAuth();
        group.MapPost("/{id}/review", Review).RequireAuth();
        return group;
    }

    private static async Task<IResult> Mine(HttpContext ctx, NpgsqlDataSource db) =>
        Results.Json((await db.ListOrdersForUser(ctx.RequiredUserId())).Select(ApiOrder.From));

    private static async Task<IResult> Checkout(HttpContext ctx, NpgsqlDataSource db)
    {
        var userId = ctx.RequiredUserId();
        var body = await RequestBody.Read<CheckoutBody>(ctx.Request);
        var v = new Validator();
        v.Check(!string.IsNullOrEmpty(body.ListingId), "Listing id is required", "listingId");
        var pickupLocation = body.PickupLocation is null ? null : v.Required(body.PickupLocation, "Pickup location can't be empty", "pickupLocation");
        v.ThrowIfInvalid();

        // Buyers can only check out store products or their own building's listings.
        var listingId = Ids.Parse(body.ListingId!);
        await db.FindViewableListing(listingId, userId);
        var (orderId, reason) = await db.CheckoutListingTx(
            new CreateOrderInput(listingId, userId, pickupLocation, Validator.Optional(body.PickupTime)));
        if (reason is not null) throw HttpError.BadRequest(reason);

        var listing = await db.FindListingById(listingId);
        if (listing is not null)
        {
            await db.CreateNotification(new CreateNotificationInput(
                listing.SellerId, "sold", $"{listing.Title} sold!", "Your item was purchased.", "/orders"));
        }

        var order = await db.FindOrderById(orderId!.Value) ?? throw HttpError.NotFound("Order not found");
        return Results.Json(ApiOrder.From(order), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> Complete(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var orderId = Ids.Parse(id);
        var userId = ctx.RequiredUserId();
        if (await db.CompleteOrder(orderId, userId) is { } error) throw error;

        var order = await db.FindOrderById(orderId) ?? throw HttpError.NotFound("Order not found");

        // Let whoever didn't mark it know the handoff was recorded.
        var markedByBuyer = order.BuyerId == userId;
        await db.CreateNotification(new CreateNotificationInput(
            markedByBuyer ? order.SellerId : order.BuyerId,
            "order_completed",
            $"{order.ListingTitle} delivered",
            $"{(markedByBuyer ? order.BuyerName : order.SellerName)} marked this order as delivered.",
            "/orders"));

        return Results.Json(ApiOrder.From(order));
    }

    private static async Task<IResult> Review(string id, HttpContext ctx, NpgsqlDataSource db)
    {
        var orderId = Ids.Parse(id);
        var body = await RequestBody.Read<ReviewBody>(ctx.Request);
        var v = new Validator();
        v.Check(body.Rating is >= 1 and <= 5, "Rating must be a whole number from 1 to 5", "rating");
        var comment = Validator.Optional(body.Comment);
        v.Check(comment is null || comment.Length <= 1000, "Comment must be at most 1000 characters", "comment");
        v.ThrowIfInvalid();

        var error = await db.ReviewOrder(orderId, ctx.RequiredUserId(), body.Rating!.Value,
            string.IsNullOrEmpty(comment) ? null : comment);
        if (error is not null) throw error;

        var order = await db.FindOrderById(orderId) ?? throw HttpError.NotFound("Order not found");
        return Results.Json(ApiOrder.From(order), statusCode: StatusCodes.Status201Created);
    }
}
