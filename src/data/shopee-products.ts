import type { Product } from "@/lib/types";

export const shopeeProducts: Product[] = [
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

export function searchShopee(query: string): Product[] {
  if (!query.trim()) return shopeeProducts;

  const term = query.toLowerCase();
  return shopeeProducts.filter(
    (p) =>
      p.title.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term),
  );
}

export function getShopeeProduct(id: string): Product | undefined {
  return shopeeProducts.find((p) => p.id === id);
}
