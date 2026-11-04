using Npgsql;
using Vizo.Api.Db;

namespace Vizo.Api.Lib;

public static class ListingAccess
{
    // Store products are public: anyone who scanned a store's QR code can see
    // them. Community listings are only visible to signed-in members of the
    // seller's building. Listings from other buildings 404 rather than 403 so
    // their existence isn't leaked.
    public static async Task<ListingRow> FindViewableListing(this NpgsqlDataSource db, Guid id, Guid? viewerId)
    {
        var listing = await db.FindListingById(id) ?? throw HttpError.NotFound("Listing not found");
        if (listing.StoreId is not null) return listing;
        if (viewerId is null) throw HttpError.Unauthorized("Sign in to see your community's listings");
        if (viewerId == listing.SellerId) return listing;
        var viewer = await db.FindUserById(viewerId.Value);
        if (viewer is null || !Users.SameBuilding(viewer.BuildingName, listing.SellerBuildingName))
            throw HttpError.NotFound("Listing not found");
        return listing;
    }
}
