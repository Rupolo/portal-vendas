import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Star, Truck } from "lucide-react";
import { Header } from "@/components/Header";
import { MarketplaceBadge } from "@/components/MarketplaceBadge";
import { AddToCartButton } from "@/components/AddToCartButton";
import { getMercadoLivreProduct } from "@/lib/mercadolivre";
import { getShopeeProduct } from "@/data/shopee-products";
import { formatPrice, formatSoldCount } from "@/lib/format";
import type { Product } from "@/lib/types";

async function getProduct(id: string): Promise<Product | null> {
  if (id.startsWith("ml-")) {
    return getMercadoLivreProduct(id);
  }
  return getShopeeProduct(id) ?? null;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        )
      : null;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para busca
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50">
            <Image
              src={product.image}
              alt={product.title}
              fill
              className="object-contain p-8"
              priority
              unoptimized={product.marketplace === "shopee"}
            />
            {discount && (
              <span className="absolute left-4 top-4 rounded-xl bg-red-500 px-3 py-1.5 text-sm font-bold text-white">
                -{discount}%
              </span>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <MarketplaceBadge marketplace={product.marketplace} />

            <h1 className="text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl">
              {product.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              {product.rating && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {product.rating}
                </span>
              )}
              {product.soldCount && (
                <span>{formatSoldCount(product.soldCount)}</span>
              )}
              {product.freeShipping && (
                <span className="flex items-center gap-1 text-green-600">
                  <Truck className="h-4 w-4" />
                  Frete grátis
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              {product.originalPrice && product.originalPrice > product.price && (
                <p className="text-sm text-zinc-400 line-through">
                  {formatPrice(product.originalPrice)}
                </p>
              )}
              <p className="text-4xl font-bold text-zinc-900">
                {formatPrice(product.price)}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                em até 12x de {formatPrice(product.price / 12)} sem juros
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <AddToCartButton product={product} />
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-6 py-3.5 font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                <ExternalLink className="h-4 w-4" />
                Ver no {product.marketplace === "mercadolivre" ? "Mercado Livre" : "Shopee"}
              </a>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-medium">Compra segura</p>
              <p className="mt-1 text-blue-700">
                A finalização da compra é feita diretamente no{" "}
                {product.marketplace === "mercadolivre"
                  ? "Mercado Livre"
                  : "Shopee"}
                , com toda a proteção da plataforma original.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
