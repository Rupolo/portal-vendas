import { describe, expect, it } from "vitest";
import { compareProducts, dedupeProducts, filterPetProducts } from "@/lib/products";

describe("dedupeProducts", () => {
  it("removes duplicate products with the same marketplace and id", () => {
    const products = [
      {
        id: "shopee-001",
        title: "Fone Bluetooth",
        price: 89.9,
        image: "https://example.com/a.jpg",
        marketplace: "shopee",
        url: "https://example.com/a",
      },
      {
        id: "shopee-001",
        title: "Fone Bluetooth",
        price: 89.9,
        image: "https://example.com/a.jpg",
        marketplace: "shopee",
        url: "https://example.com/a",
      },
      {
        id: "ml-123",
        title: "Notebook",
        price: 1999,
        image: "https://example.com/b.jpg",
        marketplace: "mercadolivre",
        url: "https://example.com/b",
      },
    ] as any;

    expect(dedupeProducts(products)).toHaveLength(2);
    expect(dedupeProducts(products)[0].id).toBe("shopee-001");
    expect(dedupeProducts(products)[1].id).toBe("ml-123");
  });
});

describe("compareProducts", () => {
  it("keeps the cheapest offer for equivalent products and sorts by lowest price first", () => {
    const products = [
      {
        id: "ml-123",
        title: "Fone de Ouvido Bluetooth TWS Pro",
        price: 289.9,
        image: "https://example.com/ml.jpg",
        marketplace: "mercadolivre",
        url: "https://example.com/ml",
      },
      {
        id: "shopee-111",
        title: "Fone de Ouvido Bluetooth TWS Pro",
        price: 199.9,
        image: "https://example.com/shopee.jpg",
        marketplace: "shopee",
        url: "https://example.com/shopee",
      },
      {
        id: "ml-456",
        title: "Smartwatch D20 Plus",
        price: 349.9,
        image: "https://example.com/watch.jpg",
        marketplace: "mercadolivre",
        url: "https://example.com/watch",
      },
    ] as any;

    const result = compareProducts(products);

    expect(result).toHaveLength(2);
    expect(result[0].marketplace).toBe("shopee");
    expect(result[0].price).toBe(199.9);
    expect(result[1].marketplace).toBe("mercadolivre");
    expect(result[1].price).toBe(349.9);
  });
});

describe("filterPetProducts", () => {
  it("keeps only pet-related products and removes unrelated items", () => {
    const products = [
      {
        id: "ml-100",
        title: "Ração Premium para cachorro adulto",
        price: 140,
        image: "https://example.com/racao.jpg",
        marketplace: "mercadolivre",
        url: "https://example.com/racao",
      },
      {
        id: "shopee-100",
        title: "Notebook Gamer 16GB",
        price: 3500,
        image: "https://example.com/notebook.jpg",
        marketplace: "shopee",
        url: "https://example.com/notebook",
      },
      {
        id: "ml-200",
        title: "Cama para gato com colchão",
        price: 210,
        image: "https://example.com/cama.jpg",
        marketplace: "mercadolivre",
        url: "https://example.com/cama",
      },
    ] as any;

    const result = filterPetProducts(products);

    expect(result).toHaveLength(2);
    expect(result.every((product) => /cachorro|gato|racao|ração|cama|coleira|pet|brinquedo/i.test(product.title))).toBe(true);
  });
});
