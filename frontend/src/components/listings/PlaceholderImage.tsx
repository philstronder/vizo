import { cn } from "@/lib/cn";
import { isRenderableImageSrc } from "@/lib/image";
import type { ListingCategory } from "@/types";
import { Armchair, BookOpen, Car, Cpu, Flower2, Package, Refrigerator, Shirt, Wrench } from "lucide-react";

const categoryIcon: Record<ListingCategory, React.ComponentType<{ className?: string }>> = {
  furniture: Armchair,
  electronics: Cpu,
  appliances: Refrigerator,
  vehicles: Car,
  clothing: Shirt,
  books: BookOpen,
  plants: Flower2,
  services: Wrench,
  other: Package,
};

// Deterministic pastel tint per image id so the same item always renders the same tone.
const tints = [
  "from-amber-100/80 to-cream-100",
  "from-info-bg to-cream-100",
  "from-success-bg to-cream-100",
  "from-cream-100 to-amber-100/60",
];

function tintFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return tints[hash % tints.length];
}

export function PlaceholderImage({
  seed,
  category,
  className,
}: {
  // The listing's first image — either a real photo (data:/http(s) URL,
  // rendered directly) or a stable id/filename used only to key the
  // fallback tint when there's no real photo.
  seed: string;
  category: ListingCategory;
  className?: string;
}) {
  if (isRenderableImageSrc(seed)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={seed} alt="" className={cn("object-cover border border-line", className)} />;
  }

  const Icon = categoryIcon[category];
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br border border-line",
        tintFor(seed),
        className
      )}
    >
      <Icon className="w-1/4 h-1/4 text-ink-400" />
    </div>
  );
}
