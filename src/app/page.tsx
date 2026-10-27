import { Header } from "@/components/Header";
import { ProductCatalog } from "@/components/ProductCatalog";

const featuredCategories = [
  { name: "Ração", description: "Melhores preços em alimentação", emoji: "🥩" },
  { name: "Brinquedos", description: "Diversão com desconto", emoji: "🦴" },
  { name: "Higiene", description: "Banho, limpeza e cuidado", emoji: "🛁" },
  { name: "Acessórios", description: "Coleiras, camas e muito mais", emoji: "🐾" },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <section className="mb-8 rounded-3xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 p-6 text-white shadow-lg shadow-orange-200 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-50">
                Melhor oferta do dia
              </p>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Tudo para pets com o menor preço.
              </h1>
              <p className="mt-3 text-sm text-orange-50 md:text-base">
                Compare ração, acessórios, brincadeiras, higiene e bem-estar para
                cachorro e gato entre Mercado Livre e Shopee em um único lugar.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-orange-100">
                Oferta do nicho
              </p>
              <p className="mt-2 text-3xl font-black">Até 40% OFF</p>
              <p className="text-sm text-orange-50">em produtos selecionados</p>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          {featuredCategories.map((category) => (
            <div
              key={category.name}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 text-3xl">{category.emoji}</div>
              <h2 className="text-lg font-bold text-zinc-900">{category.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">{category.description}</p>
            </div>
          ))}
        </section>

        <ProductCatalog />
      </main>
      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-500 sm:px-6">
          Meu Pet Store — Tudo para seu melhor amigo.
        </div>
      </footer>
    </>
  );
}
