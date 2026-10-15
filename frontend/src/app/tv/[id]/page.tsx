import { StoreEntry } from "@/components/stores/StoreEntry";

// Target of a TV show's QR code: locks this tab to the show's store.
export default async function TvEntryPage({ params }: PageProps<"/tv/[id]">) {
  const { id } = await params;
  return <StoreEntry storeId={id} />;
}
