"use client";

import Link from "next/link";
import { Search, ShoppingCart, Store } from "lucide-react";
import { useCart } from "@/lib/cart-context";

export function Header() {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-teal-700 bg-gradient-to-br from-orange-200 via-yellow-100 to-orange-100 shadow-sm">
            <span className="text-2xl" aria-hidden="true">
              🐾
            </span>
          </div>

          <div className="leading-none">
            <div className="text-center font-black uppercase tracking-[-0.08em] text-zinc-900">
              <div className="text-2xl leading-none text-teal-700 sm:text-3xl">Meu Pet</div>
              <div className="text-2xl leading-none text-orange-500 sm:text-3xl">Store</div>
            </div>
            <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Tudo para seu melhor amigo
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 sm:flex"
          >
            <Search className="h-4 w-4" />
            Buscar
          </Link>
          <Link
            href="/carrinho"
            className="relative flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
