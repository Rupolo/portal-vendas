"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { Marketplace, Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

type Filter = Marketplace | "all";

export function ProductCatalog() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async (q: string, marketplace: Filter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (marketplace !== "all") params.set("marketplace", marketplace);

      const res = await fetch(`/api/produtos?${params}`);
      const data = await res.json();
      setProducts(data.products ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts("", "all");
  }, [fetchProducts]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchProducts(query, filter);
  }

  function handleFilterChange(newFilter: Filter) {
    setFilter(newFilter);
    fetchProducts(query, newFilter);
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "mercadolivre", label: "Mercado Livre" },
    { value: "shopee", label: "Shopee" },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-12 text-white sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Encontre os melhores preços
        </h1>
        <p className="mt-2 max-w-xl text-blue-100">
          Busque produtos do Mercado Livre e Shopee em um só lugar. Compare
          preços e compre com segurança.
        </p>

        <form onSubmit={handleSearch} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="O que você procura? Ex: notebook, fone, tênis..."
              className="w-full rounded-2xl border-0 py-4 pl-12 pr-4 text-zinc-900 shadow-lg placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-white px-8 py-4 font-semibold text-blue-700 shadow-lg transition hover:bg-blue-50"
          >
            Buscar
          </button>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleFilterChange(f.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === f.value
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center">
          <p className="text-lg font-medium text-zinc-600">
            Nenhum produto encontrado
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Tente outra busca ou altere o filtro de marketplace
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            {products.length} produto{products.length !== 1 && "s"} encontrado
            {products.length !== 1 && "s"}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
