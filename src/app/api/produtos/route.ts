import { NextRequest, NextResponse } from "next/server";
import { searchMercadoLivre } from "@/lib/mercadolivre";
import { searchShopee } from "@/data/shopee-products";
import { compareProducts, dedupeProducts, filterPetProducts } from "@/lib/products";
import type { Marketplace, Product } from "@/lib/types";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const marketplace = request.nextUrl.searchParams.get(
    "marketplace",
  ) as Marketplace | "all" | null;

  try {
    const results: Product[] = [];

    if (!marketplace || marketplace === "all" || marketplace === "mercadolivre") {
      if (query.trim()) {
        const mlProducts = await searchMercadoLivre(query);
        results.push(...mlProducts);
      }
    }

    if (!marketplace || marketplace === "all" || marketplace === "shopee") {
      const shopeeResults = await searchShopee(query);
      results.push(...shopeeResults);
    }

    const products = compareProducts(filterPetProducts(dedupeProducts(results)));

    return NextResponse.json({ products, query });
  } catch {
    return NextResponse.json(
      { error: "Erro ao buscar produtos" },
      { status: 500 },
    );
  }
}
