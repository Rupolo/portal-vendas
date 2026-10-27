import type { Product } from "@/lib/types";

const FallbackShopeeProducts: Product[] = [
  {
    id: "shopee-001",
    title: "Fone de Ouvido Bluetooth TWS Pro — Cancelamento de Ruído",
    price: 89.9,
    originalPrice: 149.9,
    image: "https://placehold.co/400x400/f97316/ffffff?text=Fone+BT",
    marketplace: "shopee",
    url: "https://shopee.com.br/search?keyword=fone%20bluetooth",
    freeShipping: true,
    rating: 4.8,
    soldCount: 2340,
    category: "Eletrônicos",
  },
  {
    id: "shopee-002",
    title: "Smartwatch D20 Plus — Monitor Cardíaco e Notificações",
    price: 59.9,
    originalPrice: 99.9,
    image: "https://placehold.co/400x400/f97316/ffffff?text=Smartwatch",
    marketplace: "shopee",
    url: "https://shopee.com.br/search?keyword=smartwatch",
    freeShipping: true,
    rating: 4.6,
    soldCount: 5120,
    category: "Eletrônicos",
  },
  {
    id: "shopee-003",
    title: "Kit 3 Camisetas Básicas Algodão Premium Unissex",
    price: 79.9,
    originalPrice: 119.9,
    image: "https://placehold.co/400x400/f97316/ffffff?text=Camisetas",
    marketplace: "shopee",
    url: "https://shopee.com.br/search?keyword=camisetas%20algodao",
    freeShipping: false,
    rating: 4.7,
    soldCount: 8900,
    category: "Moda",
  },
  {
    id: "shopee-004",
    title: "Organizador de Maquiagem Acrílico com Gavetas",
    price: 45.9,
    originalPrice: 69.9,
    image: "https://placehold.co/400x400/f97316/ffffff?text=Organizador",
    marketplace: "shopee",
    url: "https://shopee.com.br/search?keyword=organizador%20maquiagem",
    freeShipping: true,
    rating: 4.9,
    soldCount: 1560,
    category: "Casa",
  },
  {
    id: "shopee-005",
    title: "Carregador Turbo USB-C 65W GaN — 3 Portas",
    price: 99.9,
    originalPrice: 159.9,
    image: "https://placehold.co/400x400/f97316/ffffff?text=Carregador",
    marketplace: "shopee",
    url: "https://shopee.com.br/search?keyword=carregador%2065w",
    freeShipping: true,
    rating: 4.5,
    soldCount: 3200,
    category: "Eletrônicos",
  },
  {
    id: "shopee-006",
    title: "Tênis Esportivo Running Leve — Unissex",
    price: 129.9,
    originalPrice: 199.9,
    image: "https://placehold.co/400x400/f97316/ffffff?text=Tenis",
    marketplace: "shopee",
    url: "https://shopee.com.br/search?keyword=tenis%20running",
    freeShipping: false,
    rating: 4.4,
    soldCount: 780,
    category: "Moda",
  },
];

function mapShopeeItem(item: any): Product | null {
  const basic = item?.item_basic ?? item;

  if (!basic || !basic.name) {
    return null;
  }

  const price = Number(basic.price ?? basic.price_before_discount ?? 0) / 100000;
  const originalPrice = basic.price_before_discount
    ? Number(basic.price_before_discount) / 100000
    : undefined;

  const image =
    basic.image ??
    basic.images?.[0]?.url ??
    "https://placehold.co/400x400/f97316/ffffff?text=Shopee";

  const itemId = basic.itemid ?? basic.item_id ?? basic.id ?? crypto?.randomUUID?.() ?? "shopee-item";
  const shopId = basic.shopid ?? basic.shop_id ?? "0";
  const slug = basic.shopid ? basic.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "product";

  return {
    id: `shopee-${itemId}`,
    title: basic.name,
    price: Number.isFinite(price) ? price : 0,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
    image,
    marketplace: "shopee",
    url: `https://shopee.com.br/${slug}-i.${shopId}.${itemId}`,
    freeShipping: Boolean(basic.shipping_fee ?? basic.free_shipping ?? false),
    rating: basic.item_rating?.rating_star ?? basic.rating_star,
    soldCount: Number(basic.historical_sold ?? basic.sold ?? 0),
    category: basic.category ?? "Shopee",
  };
}

export async function searchShopee(query: string): Promise<Product[]> {
  const term = query.trim();

  try {
    if (term) {
      const url = new URL("https://shopee.com.br/api/v4/search/search_items");
      url.searchParams.set("by", "relevancy");
      url.searchParams.set("keyword", term);
      url.searchParams.set("limit", "10");
      url.searchParams.set("newest", "0");
      url.searchParams.set("order", "desc");
      url.searchParams.set("skip_autocorrect", "1");

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer": "https://shopee.com.br/",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        next: { revalidate: 300 },
      });

      if (response.ok) {
        const payload = await response.json();
        const rawItems = Array.isArray(payload?.items) ? payload.items : [];
        const mapped = rawItems
          .map((item: any) => mapShopeeItem(item))
          .filter((item: Product | null): item is Product => Boolean(item));

        if (mapped.length > 0) {
          return mapped;
        }
      }
    }
  } catch {
    // Silent fallback to the curated catalog below when the public Shopee API blocks requests.
  }

  if (!term) {
    return FallbackShopeeProducts;
  }

  const normalized = term.toLowerCase();
  return FallbackShopeeProducts.filter(
    (item) =>
      item.title.toLowerCase().includes(normalized) ||
      item.category?.toLowerCase().includes(normalized),
  );
}

export function getShopeeProduct(id: string): Product | undefined {
  const product = FallbackShopeeProducts.find((item) => item.id === id);
  return product ?? undefined;
}

export const shopeeProducts = FallbackShopeeProducts;
