import { StoreView } from "@/components/stores/StoreView";

export default async function StorePage({ params, searchParams }: PageProps<"/stores/[id]">) {
  const { id } = await params;
  const { purchased } = await searchParams;
  return <StoreView storeId={id} purchased={purchased === "1"} />;
}
