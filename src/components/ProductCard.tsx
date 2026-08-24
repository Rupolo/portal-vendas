"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Star, Truck } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatPrice, formatSoldCount } from "@/lib/format";
import { MarketplaceBadge } from "./MarketplaceBadge";
import { useCart } from "@/lib/cart-context";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        )
      : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md">
      <Link href={`/produto/${product.id}`} className="relative aspect-square overflow-hidden bg-zinc-50">
        <Image
          src={product.image}
          alt={product.title}
          fill
          className="object-contain p-4 transition group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 25vw"
          unoptimized={product.marketplace === "shopee"}
        />
        {discount && (
          <span className="absolute left-3 top-3 rounded-lg bg-red-500 px-2 py-1 text-xs font-bold text-white">
            -{discount}%
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <MarketplaceBadge marketplace={product.marketplace} />

        <Link href={`/produto/${product.id}`}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-zinc-800 hover:text-blue-600">
            {product.title}
          </h3>
        </Link>

        <div className="mt-auto space-y-1">
          {product.originalPrice && product.originalPrice > product.price && (
            <p className="text-xs text-zinc-400 line-through">
              {formatPrice(product.originalPrice)}
            </p>
          )}
          <p className="text-xl font-bold text-zinc-900">
            {formatPrice(product.price)}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {product.rating && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {product.rating}
              </span>
            )}
            {product.soldCount && <span>{formatSoldCount(product.soldCount)}</span>}
            {product.freeShipping && (
              <span className="flex items-center gap-0.5 text-green-600">
                <Truck className="h-3 w-3" />
                Frete grátis
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => addItem(product)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <ShoppingCart className="h-4 w-4" />
          Adicionar
        </button>
      </div>
    </article>
  );
}
