import { NextRequest, NextResponse } from "next/server";
import { searchMercadoLivre } from "@/lib/mercadolivre";
import { searchShopee } from "@/data/shopee-products";
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

    if (!query.trim() && (!marketplace || marketplace === "all")) {
      const fallbackProducts = await searchShopee("");
      results.push(...fallbackProducts);
    }

    return NextResponse.json({ products: results, query });
  } catch {
    return NextResponse.json(
      { error: "Erro ao buscar produtos" },
      { status: 500 },
    );
  }
}
