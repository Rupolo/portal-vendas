"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { MarketplaceBadge } from "@/components/MarketplaceBadge";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalPrice, clearCart } = useCart();

  const byMarketplace = {
    mercadolivre: items.filter((i) => i.marketplace === "mercadolivre"),
    shopee: items.filter((i) => i.marketplace === "shopee"),
  };

  if (items.length === 0) {
    return (
      <>
        <Header />
        <main className="mx-auto flex max-w-7xl flex-1 flex-col items-center justify-center px-4 py-20 sm:px-6">
          <ShoppingBag className="h-16 w-16 text-zinc-300" />
          <h1 className="mt-4 text-2xl font-bold text-zinc-800">
            Seu carrinho está vazio
          </h1>
          <p className="mt-2 text-zinc-500">
            Adicione produtos do Mercado Livre ou Shopee
          </p>
          <Link
            href="/"
            className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Explorar produtos
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900">Carrinho</h1>
          <button
            type="button"
            onClick={clearCart}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Limpar carrinho
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {(["mercadolivre", "shopee"] as const).map((marketplace) => {
              const group = byMarketplace[marketplace];
              if (group.length === 0) return null;

              return (
                <section key={marketplace} className="space-y-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    {marketplace === "mercadolivre" ? "Mercado Livre" : "Shopee"}
                  </h2>
                  {group.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-50">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-contain p-2"
                          unoptimized={item.marketplace === "shopee"}
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-2">
                        <MarketplaceBadge marketplace={item.marketplace} />
                        <p className="line-clamp-2 text-sm font-medium text-zinc-800">
                          {item.title}
                        </p>
                        <p className="font-bold text-zinc-900">
                          {formatPrice(item.price)}
                        </p>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                              className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-50"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                              className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-50"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-zinc-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>

          <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-lg font-bold text-zinc-900">Resumo</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal ({items.length} itens)</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              Como os produtos vêm de marketplaces diferentes, a compra é
              finalizada separadamente em cada plataforma.
            </p>
            <div className="mt-6 space-y-3">
              {byMarketplace.mercadolivre.length > 0 && (
                <a
                  href="https://www.mercadolivre.com.br/gz/cart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-yellow-900 hover:bg-yellow-500"
                >
                  <ExternalLink className="h-4 w-4" />
                  Finalizar no Mercado Livre
                </a>
              )}
              {byMarketplace.shopee.length > 0 && (
                <a
                  href="https://shopee.com.br/cart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600"
                >
                  <ExternalLink className="h-4 w-4" />
                  Finalizar na Shopee
                </a>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
