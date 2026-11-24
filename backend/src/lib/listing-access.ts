import { findListingById, type ListingRow } from "../db/listings";
import { findUserById, sameBuilding } from "../db/users";
import { notFound, unauthorized } from "./http-error";

// Store products are public: anyone who scanned a store's QR code can see
// them. Community listings are only visible to signed-in members of the
// seller's building. Listings from other buildings 404 rather than 403 so
// their existence isn't leaked.
export async function findViewableListing(id: string, viewerId: string | undefined): Promise<ListingRow> {
  const listing = await findListingById(id);
  if (!listing) throw notFound("listing_not_found");
  if (listing.store_id) return listing;
  if (!viewerId) throw unauthorized("sign_in_to_see_listings");
  if (viewerId === listing.seller_id) return listing;
  const viewer = await findUserById(viewerId);
  if (!viewer || !sameBuilding(viewer.building_name, listing.seller_building_name)) {
    throw notFound("listing_not_found");
  }
  return listing;
}
