# Portal Vendas

Portal web para buscar e vender produtos do **Mercado Livre** e **Shopee** em um só lugar.

## Funcionalidades

- Busca de produtos em tempo real no Mercado Livre (API oficial)
- Catálogo de produtos da Shopee (editável)
- Filtro por marketplace (Todos / ML / Shopee)
- Carrinho de compras com persistência local
- Página de detalhes do produto
- Redirecionamento para checkout nas plataformas originais

## Como rodar

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Estrutura

- `src/lib/mercadolivre.ts` — integração com API pública do Mercado Livre
- `src/data/shopee-products.ts` — produtos da Shopee (edite para adicionar seus produtos/links de afiliado)
- `src/app/api/produtos/route.ts` — API unificada de busca
- `src/app/carrinho/page.tsx` — carrinho de compras

## Próximos passos

1. **Shopee API**: cadastre-se no [Shopee Open Platform](https://open.shopee.com/) para sincronizar produtos automaticamente
2. **Links de afiliado**: substitua as URLs em `shopee-products.ts` pelos seus links de afiliado
3. **Mercado Livre**: configure o programa de afiliados do ML para monetizar vendas
