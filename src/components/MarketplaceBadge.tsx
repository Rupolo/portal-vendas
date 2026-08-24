import type { Marketplace } from "@/lib/types";

const marketplaceConfig: Record<
  Marketplace,
  { label: string; color: string; bg: string }
> = {
  mercadolivre: {
    label: "Mercado Livre",
    color: "text-yellow-800",
    bg: "bg-yellow-100",
  },
  shopee: {
    label: "Shopee",
    color: "text-orange-800",
    bg: "bg-orange-100",
  },
};

export function MarketplaceBadge({
  marketplace,
}: {
  marketplace: Marketplace;
}) {
  const config = marketplaceConfig[marketplace];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.label}
    </span>
  );
}
