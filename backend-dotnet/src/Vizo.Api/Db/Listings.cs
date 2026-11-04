using Dapper;
using Npgsql;
using Vizo.Api.Lib;

namespace Vizo.Api.Db;

public sealed class ListingRow
{
    public Guid Id { get; init; }
    public Guid SellerId { get; init; }
    public Guid? StoreId { get; init; }
    public string SellerName { get; init; } = "";
    public string? SellerUnitNumber { get; init; }
    public string? SellerBuildingName { get; init; }
    public bool SellerVerified { get; init; }
    public DateTime SellerMemberSince { get; init; }
    public string Title { get; init; } = "";
    public string Description { get; init; } = "";
    public string Category { get; init; } = "";
    public string Condition { get; init; } = "";
    public string Type { get; init; } = ""; // "direct" | "auction"
    public string Status { get; init; } = "";
    public string[] Images { get; init; } = [];
    public int Quantity { get; init; }
    public decimal? Price { get; init; }
    public decimal? StartingPrice { get; init; }
    public decimal? CurrentBid { get; init; }
    public Guid? MaxBidderId { get; init; }
    public DateTime? AuctionEndsAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public long BidCount { get; init; }
    public decimal? SellerRating { get; init; } // null with no reviews
    public long SellerReviewCount { get; init; }
}

public sealed record ApiListing(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string Condition,
    string Type,
    string Status,
    string[] Images,
    int Quantity,
    Guid SellerId,
    Guid? StoreId,
    string SellerName,
    string? SellerUnitNumber,
    string? SellerBuildingName,
    bool SellerVerified,
    string SellerMemberSince,
    double? SellerRating,
    long SellerReviewCount,
    string CreatedAt,
    double? Price,
    double? StartingPrice,
    double? CurrentBid,
    long? BidCount,
    Guid? MaxBidderId,
    string? AuctionEndsAt)
{
    // Amounts go out as plain JSON numbers (12.5, not 12.50), like Number() did.
    public static ApiListing From(ListingRow row) => new(
        row.Id,
        row.Title,
        row.Description,
        row.Category,
        row.Condition,
        row.Type,
        row.Status,
        row.Images,
        row.Quantity,
        row.SellerId,
        row.StoreId,
        row.SellerName,
        row.SellerUnitNumber,
        row.SellerBuildingName,
        row.SellerVerified,
        Iso.Format(row.SellerMemberSince),
        (double?)row.SellerRating,
        row.SellerReviewCount,
        Iso.Format(row.CreatedAt),
        (double?)row.Price,
        (double?)row.StartingPrice,
        (double?)row.CurrentBid,
        row.Type == "auction" ? row.BidCount : null,
        row.MaxBidderId,
        row.AuctionEndsAt is { } endsAt ? Iso.Format(endsAt) : null);
}

public sealed record ListingFilters(
    string? Status = null,
    string? Category = null,
    string? Type = null, // "direct" | "auction"
    Guid? SellerId = null,
    string? Q = null,
    // Exactly one scope applies: a store's products, or a building's
    // community listings (which never include store products).
    Guid? StoreId = null,
    string? BuildingName = null);

public sealed record CreateListingInput(
    Guid SellerId,
    Guid? StoreId,
    string Title,
    string Description,
    string Category,
    string Condition,
    string[] Images,
    string Type,
    int? Quantity,
    double? Price,
    double? StartingPrice,
    DateTime? AuctionEndsAt);

public sealed class BidRow
{
    public Guid Id { get; init; }
    public Guid ListingId { get; init; }
    public Guid BidderId { get; init; }
    public string BidderName { get; init; } = "";
    public decimal Amount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed record ApiBid(Guid Id, Guid ListingId, Guid BidderId, string BidderName, double Amount, string CreatedAt)
{
    public static ApiBid From(BidRow row) =>
        new(row.Id, row.ListingId, row.BidderId, row.BidderName, (double)row.Amount, Iso.Format(row.CreatedAt));
}

public static class Listings
{
    private const string ListingSelect = """
        SELECT
          l.*,
          u.name AS seller_name,
          u.unit_number AS seller_unit_number,
          u.building_name AS seller_building_name,
          u.verified AS seller_verified,
          u.created_at AS seller_member_since,
          COALESCE((SELECT count(*) FROM bids b WHERE b.listing_id = l.id), 0) AS bid_count,
          (SELECT avg(r.rating) FROM seller_reviews r WHERE r.seller_id = l.seller_id) AS seller_rating,
          (SELECT count(*) FROM seller_reviews r WHERE r.seller_id = l.seller_id) AS seller_review_count
        FROM listings l
        JOIN users u ON u.id = l.seller_id
        """;

    // Enum columns are compared against casts, since Npgsql sends strings typed
    // as text. An unknown value fails the cast (22P02), which is a 404.
    public static async Task<IEnumerable<ListingRow>> ListListings(this NpgsqlDataSource db, ListingFilters filters)
    {
        var conditions = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrEmpty(filters.Status)) { conditions.Add("l.status = @status::listing_status"); p.Add("status", filters.Status); }
        if (!string.IsNullOrEmpty(filters.Category)) { conditions.Add("l.category = @category::listing_category"); p.Add("category", filters.Category); }
        if (filters.Type is not null) { conditions.Add("l.type = @type::listing_type"); p.Add("type", filters.Type); }
        if (filters.SellerId is not null) { conditions.Add("l.seller_id = @sellerId"); p.Add("sellerId", filters.SellerId); }
        if (filters.StoreId is not null) { conditions.Add("l.store_id = @storeId"); p.Add("storeId", filters.StoreId); }
        if (filters.BuildingName is not null)
        {
            conditions.Add("l.store_id IS NULL");
            conditions.Add("lower(trim(u.building_name)) = lower(trim(@buildingName))");
            p.Add("buildingName", filters.BuildingName);
        }
        if (!string.IsNullOrEmpty(filters.Q))
        {
            conditions.Add("(l.title ILIKE @q OR l.description ILIKE @q)");
            p.Add("q", $"%{filters.Q}%");
        }

        var where = conditions.Count > 0 ? $"WHERE {string.Join(" AND ", conditions)}" : "";
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QueryAsync<ListingRow>($"{ListingSelect} {where} ORDER BY l.created_at DESC", p);
    }

    public static async Task<ListingRow?> FindListingById(this NpgsqlDataSource db, Guid id)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QuerySingleOrDefaultAsync<ListingRow>($"{ListingSelect} WHERE l.id = @id", new { id });
    }

    public static async Task<ListingRow> CreateListing(this NpgsqlDataSource db, CreateListingInput input)
    {
        Guid id;
        await using (var conn = await db.OpenConnectionAsync())
        {
            id = await conn.ExecuteScalarAsync<Guid>(
                """
                INSERT INTO listings
                  (seller_id, title, description, category, condition, type, images, price, starting_price, current_bid, auction_ends_at, store_id, quantity)
                VALUES (@SellerId, @Title, @Description, @Category::listing_category, @Condition::listing_condition, @Type::listing_type,
                  @Images, @Price, @StartingPrice, @StartingPrice, @AuctionEndsAt, @StoreId, @Quantity)
                RETURNING id
                """,
                new
                {
                    input.SellerId,
                    input.Title,
                    input.Description,
                    input.Category,
                    input.Condition,
                    input.Type,
                    input.Images,
                    input.Price,
                    input.StartingPrice,
                    input.AuctionEndsAt,
                    input.StoreId,
                    Quantity = input.Quantity ?? 1,
                });
        }
        return (await db.FindListingById(id))!;
    }

    public static async Task<bool> DeleteListing(this NpgsqlDataSource db, Guid id, Guid sellerId)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.ExecuteAsync("DELETE FROM listings WHERE id = @id AND seller_id = @sellerId", new { id, sellerId }) > 0;
    }

    // Adds units to a store product and puts it back on sale. Products of deleted
    // stores, and community listings, can't be restocked.
    public static async Task<bool> RestockListing(this NpgsqlDataSource db, Guid id, int units)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.ExecuteAsync(
            """
            UPDATE listings l SET quantity = l.quantity + @units, status = 'active'
            FROM stores s
            WHERE l.id = @id AND s.id = l.store_id AND s.deleted_at IS NULL
              AND l.type = 'direct' AND l.status IN ('active', 'sold')
            """,
            new { id, units }) > 0;
    }

    public static async Task<IEnumerable<BidRow>> ListBidsForListing(this NpgsqlDataSource db, Guid listingId)
    {
        await using var conn = await db.OpenConnectionAsync();
        return await conn.QueryAsync<BidRow>(
            """
            SELECT b.*, u.name AS bidder_name
            FROM bids b
            JOIN users u ON u.id = b.bidder_id
            WHERE b.listing_id = @listingId
            ORDER BY b.created_at DESC
            """,
            new { listingId });
    }

    private sealed class BiddableListing
    {
        public string Type { get; init; } = "";
        public string Status { get; init; } = "";
        public decimal? CurrentBid { get; init; }
        public decimal? StartingPrice { get; init; }
        public DateTime? AuctionEndsAt { get; init; }
    }

    // Places a bid transactionally: locks the listing row, validates the bid
    // beats the current price, inserts the bid, and updates the listing's
    // current_bid/max_bidder_id in one atomic unit. Returns why the bid was
    // refused, or null when it was placed.
    public static async Task<string?> PlaceBidTx(this NpgsqlDataSource db, Guid listingId, Guid bidderId, double amount)
    {
        await using var conn = await db.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        var listing = await conn.QuerySingleOrDefaultAsync<BiddableListing>(
            "SELECT type, status, current_bid, starting_price, auction_ends_at FROM listings WHERE id = @listingId FOR UPDATE",
            new { listingId }, tx);
        // Returning without committing rolls back when the transaction is disposed.
        if (listing is null) return "Listing not found";
        if (listing.Type != "auction" || listing.Status != "active") return "This listing is not an active auction";
        if (listing.AuctionEndsAt is { } endsAt && endsAt < DateTime.UtcNow) return "This auction has ended";
        var floor = (double)(listing.CurrentBid ?? listing.StartingPrice ?? 0);
        if (amount <= floor) return $"Bid must be greater than {floor}";

        await conn.ExecuteAsync(
            "INSERT INTO bids (listing_id, bidder_id, amount) VALUES (@listingId, @bidderId, @amount)",
            new { listingId, bidderId, amount }, tx);
        await conn.ExecuteAsync(
            "UPDATE listings SET current_bid = @amount, max_bidder_id = @bidderId WHERE id = @listingId",
            new { amount, bidderId, listingId }, tx);
        await tx.CommitAsync();
        return null;
    }
}
