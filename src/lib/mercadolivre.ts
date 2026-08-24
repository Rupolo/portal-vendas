import type { Product } from "./types";

interface MLResult {
  id: string;
  title: string;
  price: number;
  original_price?: number;
  thumbnail: string;
  permalink: string;
  shipping?: { free_shipping?: boolean };
}

interface MLSearchResponse {
  results: MLResult[];
}

export async function searchMercadoLivre(query: string): Promise<Product[]> {
  if (!query.trim()) return [];

  const url = new URL("https://api.mercadolibre.com/sites/MLB/search");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "20");

  const response = await fetch(url.toString(), {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error("Erro ao buscar produtos no Mercado Livre");
  }

  const data: MLSearchResponse = await response.json();

  return data.results.map((item) => ({
    id: `ml-${item.id}`,
    title: item.title,
    price: item.price,
    originalPrice: item.original_price,
    image: item.thumbnail.replace("-I.jpg", "-O.jpg"),
    marketplace: "mercadolivre",
    url: item.permalink,
    freeShipping: item.shipping?.free_shipping ?? false,
  }));
}

export async function getMercadoLivreProduct(id: string): Promise<Product | null> {
  const mlId = id.replace(/^ml-/, "");
  const response = await fetch(`https://api.mercadolibre.com/items/${mlId}`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) return null;

  const item = await response.json();

  return {
    id: `ml-${item.id}`,
    title: item.title,
    price: item.price,
    originalPrice: item.original_price,
    image: item.pictures?.[0]?.url ?? item.thumbnail,
    marketplace: "mercadolivre",
    url: item.permalink,
    freeShipping: item.shipping?.free_shipping ?? false,
    soldCount: item.sold_quantity,
  };
}
