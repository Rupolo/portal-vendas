export type Marketplace = "mercadolivre" | "shopee";

export interface Product {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: string;
  marketplace: Marketplace;
  url: string;
  freeShipping?: boolean;
  rating?: number;
  soldCount?: number;
  category?: string;
}

export interface CartItem extends Product {
  quantity: number;
}
