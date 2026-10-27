import type { Product } from "@/lib/types";

export function getProductKey(product: Pick<Product, "marketplace" | "id">): string {
  return `${product.marketplace}:${product.id}`;
}

export function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();

  return products.filter((product) => {
    const key = getProductKey(product);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeComparableTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSimilarityGroupKey(product: Pick<Product, "title">): string {
  const normalized = normalizeComparableTitle(product.title);
  const tokens = normalized
    .split(" ")
    .filter(Boolean)
    .filter((token) => !["para", "com", "de", "da", "do", "e", "o", "a", "em", "um", "uma", "por", "na", "no", "dos", "das"].includes(token));

  const meaningful = tokens.slice(0, 4).join(" ");
  return meaningful || normalized.slice(0, 40);
}

export function compareProducts(products: Product[]): Product[] {
  const deduped = dedupeProducts(products);
  const groups = new Map<string, Product[]>();

  for (const product of deduped) {
    const key = getSimilarityGroupKey(product);
    const group = groups.get(key) ?? [];
    group.push(product);
    groups.set(key, group);
  }

  const compared: Product[] = [];

  for (const group of groups.values()) {
    const cheapest = [...group].sort((a, b) => a.price - b.price)[0];
    if (cheapest) compared.push(cheapest);
  }

  return compared.sort((a, b) => a.price - b.price);
}

const PET_KEYWORDS = [
  "pet",
  "pets",
  "cachorro",
  "filhote",
  "gato",
  "ração",
  "racao",
  "petisco",
  "petisco para",
  "alimentacao",
  "alimentação",
  "alimento",
  "brinquedo",
  "brinquedos",
  "coleira",
  "guia",
  "casinha",
  "transportadora",
  "cama pet",
  "cama para cachorro",
  "cama para gato",
  "acessorio",
  "acessório",
  "banho",
  "higiene",
  "tosa",
  "shampoo",
  "antipulgas",
  "vermifugo",
  "medicamento",
  "vitamina",
  "petshop",
  "pet shop",
  "dog",
  "cat",
  "puppy",
  "kitten",
  "dog food",
  "cat food",
  "cat litter",
  "litter",
  "toy",
  "collar",
  "harness",
  "bed for dog",
  "bed for cat",
];

export function filterPetProducts(products: Product[]): Product[] {
  return products.filter((product) => {
    const haystack = `${product.title} ${product.category ?? ""}`.toLowerCase();

    const isPetRelated = PET_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()));
    return isPetRelated || /cachorro|gato|pet|racao|ração|brinquedo|coleira|cama|aliment/.test(haystack);
  });
}
