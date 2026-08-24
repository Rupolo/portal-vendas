import { Header } from "@/components/Header";
import { ProductCatalog } from "@/components/ProductCatalog";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <ProductCatalog />
      </main>
      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-500 sm:px-6">
          Portal Vendas — Produtos do Mercado Livre e Shopee reunidos em um só
          lugar.
        </div>
      </footer>
    </>
  );
}
