"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { Marketplace, Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

type Filter = Marketplace | "all";
type PetCategory = "all" | "racao" | "acessorios" | "brinquedos" | "higiene" | "saude" | "casa";

const petCategories: { value: PetCategory; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "racao", label: "Ração" },
  { value: "acessorios", label: "Acessórios" },
  { value: "brinquedos", label: "Brinquedos" },
  { value: "higiene", label: "Higiene" },
  { value: "saude", label: "Saúde" },
  { value: "casa", label: "Casa" },
];

function matchesPetCategory(product: Product, category: PetCategory): boolean {
  if (category === "all") return true;

  const haystack = `${product.title} ${product.category ?? ""}`.toLowerCase();

  const map: Record<Exclude<PetCategory, "all">, string[]> = {
    racao: ["racao", "ração", "petisco", "alimentacao", "alimentação", "alimento"],
    acessorios: ["coleira", "guia", "acessorio", "acessório", "transportadora", "casinha"],
    brinquedos: ["brinquedo", "toy", "mordedor", "osso"],
    higiene: ["higiene", "banho", "shampoo", "tosa", "limpeza"],
    saude: ["saude", "saúde", "vermifugo", "antipulgas", "vitamina", "medicamento"],
    casa: ["cama", "tapete", "casa", "pet house", "pet bed", "bed"],
  };

  return map[category].some((keyword) => haystack.includes(keyword));
}

export function ProductCatalog() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [petCategory, setPetCategory] = useState<PetCategory>("all");
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

  const visibleProducts = useMemo(() => {
    return products.filter((product) => matchesPetCategory(product, petCategory));
  }, [products, petCategory]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-12 text-white sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Os melhores preços para pets
        </h1>
        <p className="mt-2 max-w-xl text-blue-100">
          Compare ração, brinquedos, acessórios, cama e higiene para cachorro e
          gato entre Mercado Livre e Shopee em um só lugar.
        </p>

        <form onSubmit={handleSearch} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busque por ração, petisco, coleira, cama ou brinquedo..."
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

      <div className="space-y-3">
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

        <div className="flex flex-wrap gap-2">
          {petCategories.map((category) => (
            <button
              key={category.value}
              type="button"
              onClick={() => setPetCategory(category.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                petCategory === category.value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-16 text-center">
          <p className="text-lg font-medium text-zinc-600">
            Nenhum produto encontrado nessa categoria
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Tente outra busca, marketplace ou categoria pet.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-500">
            {visibleProducts.length} produto{visibleProducts.length !== 1 && "s"} encontrado
            {visibleProducts.length !== 1 && "s"}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard key={`${product.marketplace}-${product.id}`} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
