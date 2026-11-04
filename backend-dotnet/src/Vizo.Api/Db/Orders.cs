using Dapper;
using Npgsql;
using Vizo.Api.Lib;

namespace Vizo.Api.Db;

// The buyer's address_* columns are joined in for store order deliveries.
public sealed class OrderRow : AddressColumns
{
    public Guid Id { get; init; }
    public Guid ListingId { get; init; }
    public string ListingTitle { get; init; } = "";
    public string? ListingImage { get; init; }
    public Guid BuyerId { get; init; }
    public string BuyerName { get; init; } = "";
    public Guid SellerId { get; init; }
    public string SellerName { get; init; } = "";
    public decimal Price { get; init; }
    public decimal Fees { get; init; }
    public string Status { get; init; } = "";
    public string? PickupLocation { get; init; }
    public string? PickupTime { get; init; }
    public DateTime CreatedAt { get; init; }
    public int? ReviewRating { get; init; }
    public Guid? StoreId { get; init; }
    public string? BuyerPhone { get; init; }
}

public sealed record ApiOrder(
    Guid Id,
    Guid ListingId,
    string ListingTitle,
    string ListingImage,
    Guid BuyerId,
    string BuyerName,
    Guid SellerId,
    string SellerName,
    double Price,
    double Fees,
    string Status,
    string? PickupLocation,
    string? PickupTime,
    string CreatedAt,
    int? ReviewRating,
    string? BuyerPhone,
    DeliveryAddress? DeliveryAddress)
{
    // Store products are delivered, so their orders carry the buyer's phone and
    // delivery address for the store admin (and the buyer) to see.
    public static ApiOrder From(OrderRow row) => new(
        row.Id,
        row.ListingId,
        row.ListingTitle,
        row.ListingImage ?? row.ListingId.ToString(),
        row.BuyerId,
        row.BuyerName,
        row.SellerId,
        row.SellerName,
        (double)row.Price,
        (double)row.Fees,
        row.Status,
        row.PickupLocation,
        row.PickupTime,
        Iso.Format(row.CreatedAt),
        row.ReviewRating,
        row.StoreId is not null ? row.BuyerPhone : null,
        row.StoreId is not null ? row.DeliveryAddress : null);
}

public sealed record CreateOrderInput(Guid ListingId, Guid BuyerId, string? PickupLocation, string? PickupTime);

public static class Orders
{
    private const string OrderSelect = """
        SELECT
          o.*,
          l.title AS listing_title,
          (CASE WHEN array_length(l.images, 1) > 0 THEN l.images[1] ELSE NULL END) AS listing_image,
          buyer.name AS buyer_name,
          seller.name AS seller_name,
          r.rating AS review_rating,
          l.store_id,
          buyer.phone AS buyer_phone,
          buyer.address_postal_code,
          buyer.address_street,
          buyer.address_number,
          buyer.address_complement,
          buyer.address_district,
          buyer.address_city,
          buyer.address_state
        FROM orders o
        JOIN listings l ON l.id = o.listing_id
        JOIN users buyer ON buyer.id = o.buyer_id
        JOIN users seller ON seller.id = o.seller_id
        LEFT JOIN seller_reviews r ON r.order_id = o.id
        """;

    public static async Task<IEnumerable<OrderRow>> ListOrdersForUser(this NpgsqlDataSource db, Guid userId)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QueryAsync<OrderRow>(
            $"{OrderSelect} WHERE o.buyer_id = @userId OR o.seller_id = @userId ORDER BY o.created_at DESC", new { userId });
    }

    public static async Task<OrderRow?> FindOrderById(this NpgsqlDataSource db, Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<OrderRow>($"{OrderSelect} WHERE o.id = @id", new { id });
    }

    private sealed class PurchasableListing
    {
        public Guid SellerId { get; init; }
        public string Type { get; init; } = "";
        public string Status { get; init; } = "";
        public decimal? Price { get; init; }
        public decimal? CurrentBid { get; init; }
        public Guid? MaxBidderId { get; init; }
        public int Quantity { get; init; }
    }

    // Buying a listing transactionally: locks the listing, verifies it's
    // purchasable, snapshots the agreed price, takes one unit (marking it sold
    // when none are left), and creates the order in one atomic unit. Returns the
    // order id, or why the purchase was refused.
    public static async Task<(Guid? OrderId, string? Reason)> CheckoutListingTx(this NpgsqlDataSource db, CreateOrderInput input)
    {
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        var listing = await conn.QuerySingleOrDefaultAsync<PurchasableListing>(
            "SELECT id, seller_id, type, status, price, current_bid, max_bidder_id, quantity FROM listings WHERE id = @ListingId FOR UPDATE",
            new { input.ListingId }, tx);
        // Returning without committing rolls back when the transaction is disposed.
        if (listing is null) return (null, "Listing not found");
        if (listing.SellerId == input.BuyerId) return (null, "You cannot buy your own listing");
        if (listing.Status != "active" || listing.Quantity < 1) return (null, "This listing is no longer available");
        if (listing.Type == "auction" && listing.MaxBidderId != input.BuyerId)
            return (null, "Only the winning bidder can check out this auction");

        var price = listing.Type == "auction" ? listing.CurrentBid : listing.Price;
        await conn.ExecuteAsync(
            """
            UPDATE listings
            SET quantity = quantity - 1,
                status = CASE WHEN quantity - 1 = 0 THEN 'sold' ELSE status END
            WHERE id = @ListingId
            """,
            new { input.ListingId }, tx);
        var orderId = await conn.ExecuteScalarAsync<Guid>(
            """
            INSERT INTO orders (listing_id, buyer_id, seller_id, price, pickup_location, pickup_time)
            VALUES (@ListingId, @BuyerId, @SellerId, @price, @PickupLocation, @PickupTime)
            RETURNING id
            """,
            new { input.ListingId, input.BuyerId, listing.SellerId, price, input.PickupLocation, input.PickupTime }, tx);
        await tx.CommitAsync();
        return (orderId, null);
    }

    // Marks an order as delivered. Only the buyer or seller may do it, and only
    // while the order is still open, so completed/cancelled orders are left alone.
    // Returns the error to respond with, or null on success.
    public static async Task<HttpError?> CompleteOrder(this NpgsqlDataSource db, Guid orderId, Guid userId)
    {
        await using (var conn = await db.OpenConnectionAsync())
        {
            var updated = await conn.ExecuteAsync(
                """
                UPDATE orders SET status = 'completed'
                WHERE id = @orderId AND (buyer_id = @userId OR seller_id = @userId)
                  AND status IN ('pending_pickup', 'ready_for_pickup', 'shipped')
                """,
                new { orderId, userId });
            if (updated > 0) return null;
        }

        var order = await db.FindOrderById(orderId);
        if (order is null) return HttpError.NotFound("Order not found");
        if (order.BuyerId != userId && order.SellerId != userId)
            return HttpError.Forbidden("Only the buyer or seller can update this order");
        return HttpError.Conflict($"This order is already {order.Status}");
    }

    // Lets the buyer rate the seller once the order is completed. The UNIQUE
    // order_id constraint makes ON CONFLICT the one-review-per-order guard.
    public static async Task<HttpError?> ReviewOrder(this NpgsqlDataSource db, Guid orderId, Guid userId, int rating, string? comment)
    {
        var order = await db.FindOrderById(orderId);
        if (order is null) return HttpError.NotFound("Order not found");
        if (order.BuyerId != userId) return HttpError.Forbidden("Only the buyer can rate this seller");
        if (order.Status != "completed") return HttpError.Conflict("You can rate the seller once the order is delivered");

        await using var conn = await db.OpenConnectionAsync();
        var inserted = await conn.ExecuteAsync(
            """
            INSERT INTO seller_reviews (order_id, seller_id, buyer_id, rating, comment)
            VALUES (@Id, @SellerId, @BuyerId, @rating, @comment)
            ON CONFLICT (order_id) DO NOTHING
            """,
            new { order.Id, order.SellerId, order.BuyerId, rating = (short)rating, comment });
        return inserted > 0 ? null : HttpError.Conflict("You already rated this order");
    }
}
