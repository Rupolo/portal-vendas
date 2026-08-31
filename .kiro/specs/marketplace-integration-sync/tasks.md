# Implementation Plan: Portal Vendas (Dropshipping Marketplace)

## Overview

Plano de implementação completo para **Dropshipping Marketplace Integration**. Neste modelo, a loja virtual funciona como uma **intermediária entre o cliente final e o fornecedor**, sem a necessidade de manter produtos em estoque. O Portal Vendas sincroniza automaticamente pedidos dos marketplaces (Shopee e Mercado Livre) para os fornecedores, gerenciando o fluxo completo de vendas.

### Key Differences from Traditional E-Commerce:

| Aspecto | Modelo Tradicional | Dropshipping (Portal Vendas) |
|---------|-------------------|------------------------------|
| **Estoque** | Loja mantém produtos | Fornecedor mantém produtos |
| **Faturamento** | Loja fatura para cliente | Fornecedor fatura para cliente |
| **Logística** | Loja envia produtos | Fornecedor envia produtos |
| **Risco** | Loja investe em estoque | Loja sem risco de estoque |
| **Gestão** | Sincronização de estoque | Roteamento de pedidos para fornecedores |

---

## Phase 1: Infraestrutura de Base (Dropshipping Ready)

### 1. Configuração do Projeto e Dependências

- [x] 1.1 Instalar e configurar dependências principais
  - Instalar: ull, ullmq, 
edis, pg, prisma, @prisma/client
  - Criar arquivo .env com variáveis de ambiente (Redis, PostgreSQL, marketplace tokens, provider credentials)
  - Configurar tipo-segurança com Prisma CLI
  - _Requirements: 1, 2, 3, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] Todos os pacotes instalados com sucesso
    - [x] .env.example criado com todas as variáveis necessárias
    - [x] prisma init executado e configurado

- [x] 1.2 Configurar estrutura de diretórios e padrões
  - Criar: src/lib/services/, src/lib/types/, src/lib/utils/, src/api/, src/jobs/
  - Padronizar exportação de tipos e serviços
  - Criar arquivo de configuração centralizado (src/config.ts)
  - _Requirements: Arquitetura_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [x] Estrutura de diretórios criada
    - [x] Arquivos de configuração centralizados
    - [x] Padrões de importação documentados

### 2. Banco de Dados PostgreSQL (Dropshipping Schema)

- [x] 2.1 Criar schema PostgreSQL com todas as tabelas
  - Implementar schema completo (products, marketplace_products, orders, providers, provider_products, etc.)
  - Criar indexes para performance (provider_id, marketplace, status, created_at)
  - Configurar constraints e foreign keys
  - _Requirements: 1, 2, 4, 5, 6, 7, 8_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [x] Todas as 15 tabelas criadas
    - [x] Todos os indexes criados
    - [x] Foreign keys validadas
    - [x] Schema testado com dados de exemplo

- [x] 2.2 Configurar Prisma ORM e migrations
  - Criar schema.prisma com todos os modelos
  - Implementar primeira migration
  - Testar geração de tipos TypeScript
  - _Requirements: 1, 2, 4, 5, 6, 7_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] schema.prisma completo e válido
    - [x] Migration inicial criada e testada
    - [x] Tipos TypeScript gerados automaticamente
    - [x] Prisma Client configurado

### 3. Sistema de Filas (BullMQ + Redis)

- [x] 3.1 Configurar Redis e BullMQ
  - Instalar e conectar ao Redis (local ou Docker)
  - Criar factory de filas (src/lib/queue.ts)
  - Implementar 5 filas: productSync, orderRouting, providerNotification, webhookProcessing, errorRecovery
  - Configurar opciones padrão (retries, backoff exponencial, TTL)
  - _Requirements: 1, 2, 4, 6, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] Redis conectando com sucesso
    - [x] Todas as 5 filas criadas
    - [x] Backoff exponencial configurado
    - [x] Health check para Redis implementado

- [x] 3.2 Configurar workers e listeners de fila
  - Criar processadores para cada fila
  - Implementar event listeners (completed, failed, stalled)
  - Adicionar logging estruturado para eventos de fila
  - _Requirements: 1, 2, 4, 6, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] Processadores criados para cada fila
    - [x] Event listeners funcionando
    - [x] Logs estruturados para cada evento
    - [x] Métricas de fila coletadas

### 4. Sistema de Cache (Redis)

- [x] 4.1 Implementar camada de cache com Redis
  - Criar helper de cache (src/lib/cache.ts)
  - Implementar TTLs para: schemas (5min), providers (10min), products (1min), orders (2min)
  - Criar funções: get, set, invalidate, batch operations
  - _Requirements: 12_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [x] Helper de cache criado
    - [x] TTLs definidos conforme design
    - [x] Invalidação de cache ao atualizar dados
    - [x] Teste de hit/miss rate

- [x] 4.2 Configurar cache de schemas de marketplaces
  - Cachear respostas de listagem de categorias/atributos do Shopee e ML
  - Implementar refresh automático ao expirar
  - Criar endpoint para invalidação manual
  - _Requirements: 11, 12_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [x] Schemas cacheados
    - [x] Refresh automático funcionando
    - [x] Endpoint de invalidação manual
    - [x] Teste de consistência de cache

---

## Phase 2: Autenticação, Autorização e Provedores

### 5. Gestão de Tokens de Autenticação e Provedores

- [ ] 5.1 Implementar vault seguro para armazenamento de tokens
  - Criar serviço src/lib/services/auth.service.ts com métodos:
    - storeMarketplaceCredentials()
    - storeProviderCredentials()
    - 
etrieveAndDecrypt()
    - alidateToken()
    - isTokenExpired()
  - Implementar criptografia AES-256-GCM
  - Usar salt e IV aleatórios
  - _Requirements: 3, 6_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [x] Tokens criptografados antes de armazenar
    - [x] Descriptografia segura
    - [x] Validação de integridade com authTag
    - [x] Teste de round-trip (encrypt/decrypt)

- [x] 5.2 Configurar e gerenciar provedores (providers)
  - Criar serviço src/lib/services/provider.service.ts
  - Endpoints para adicionar/editar/deletar provedores
  - Mapear provedores para categorias de produtos
  - Validar disponibilidade de provedores
  - _Requirements: 5_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] CRUD de provedores funcionando
    - [x] Mapeamento categoria-provedor
    - [x] Validação de disponibilidade
    - [x] Teste com 10 provedores

- [x] 5.3 Criar endpoints de autenticação de marketplaces
  - POST /api/marketplace/auth/connect - conectar conta
  - DELETE /api/marketplace/auth/:marketplace - desconectar
  - POST /api/marketplace/auth/:marketplace/refresh - renovar manual
  - Validar credenciais antes de armazenar
  - _Requirements: 3, 6_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] 3 endpoints funcionando
    - [ ] Validação de credenciais
    - [ ] Erro tratado quando token inválido
    - [ ] Teste com OAuth2 Shopee e ML

### 6. Validação de Webhooks e Roteamento

- [ ] 6.1 Implementar validação de assinatura de webhooks
  - Criar serviço src/lib/services/webhook-validator.service.ts
  - Implementar HMAC-SHA256 para Shopee
  - Implementar token validation para Mercado Livre
  - Usar 	imingSafeEqual para evitar timing attacks
  - _Requirements: 10, 3_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Validação HMAC-SHA256 Shopee funcionando
    - [ ] Validação token ML funcionando
    - [ ] Timing-safe comparison implementada
    - [ ] Teste com payloads inválidos (rejeitados)

- [ ] 6.2 Implementar idempotência em webhooks
  - Adicionar campo webhook_delivery_id único
  - Verificar duplicatas antes de processar
  - Armazenar webhook_deliveries na DB
  - Implementar deduplicação com Redis
  - _Requirements: 10, 4_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Webhook ID checado antes de processar
    - [ ] Duplicatas rejeitadas
    - [ ] Deduplicação com Redis funcionando
    - [ ] Teste com mesmo webhook 3x

- [ ] 6.3 Implementar rate limiting em webhooks
  - Limitar a 100 req/min por marketplace
  - Usar token bucket algorithm
  - Retornar 429 quando limite excedido
  - Retentar com backoff
  - _Requirements: 10, 12_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [ ] Rate limiter criado
    - [ ] 429 retornado quando limite excedido
    - [ ] Backoff implementado

---

## Phase 3: Gestão de Produtos (Provider Mapping)

### 7. Gestão de Provedores e Mapeamento de Produtos

- [x] 7.1 Implementar ProviderService com métodos core
  - Criar classe ProviderService com métodos:
    - ssignProductToProvider(productId, providerId, providerSku)
    - atchAssignProductsToProviders(products)
    - getProviderByProduct(productId)
    - alidateProviderAvailability(providerId)
  - Integrar com filas de processamento
  - _Requirements: 1, 5, 12_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [x] Todos os métodos implementados
    - [x] Integração com queue funcionando
    - [x] Logging estruturado
    - [x] Teste com 100 produtos

- [x] 7.2 Implementar mapeamento produto-provedor
  - Criar endpoint POST /api/products/:id/assign-provider
  - Permitir vendedor escolher provedor para cada produto
  - Armazenar providerSku e informações de mapping
  - Validar se provedor está disponível
  - _Requirements: 5_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] Endpoint funcionando
    - [x] Mapping armazenado corretamente
    - [ ] Validação de disponibilidade
    - [x] Teste end-to-end

- [x] 7.3 Implementar sincronização de catálogo do provedor
  - Sincronizar produtos do provedor para o catálogo da loja
  - Mapear providerSku para productId local
  - Atualizar preços automaticamente (opcional)
  - _Requirements: 5, 11_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] Catálogo sincronizado
    - [x] Mapping providerSku ↔ productId
    - [x] Preços atualizados (opcional)
    - [x] Teste com 500 produtos do provedor

### 8. Sync com Marketplaces (Product Mapping)

- [ ] 8.1 Implementar ProductSyncService com métodos core
  - Criar classe ProductSyncService com métodos:
    - syncProductToMarketplaces(product)
    - atchSyncProducts(products)
    - etchMarketplaceProduct(marketplace, id)
    - mapProductToMarketplace(product, marketplace)
  - Integrar com filas de processamento
  - _Requirements: 1, 7, 12_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] Todos os métodos implementados
    - [ ] Integração com queue funcionando
    - [ ] Logging estruturado
    - [x] Teste com 100 produtos (batch)

- [x] 8.2 Implementar sincronização de novo produto
  - Criar job para quando produto é criado
  - Enviar para todos os marketplaces configurados
  - Armazenar remoteId de cada marketplace
  - Atualizar último sync timestamp
  - _Requirements: 1_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] Job criado para novo produto
    - [x] RemoteIds armazenados
    - [x] Timestamp atualizado
    - [x] Teste end-to-end (Portal → Shopee/ML)

- [x] 8.3 Implementar sincronização de atualização de produto
  - Detectar mudanças (título, preço, descrição, imagens)
  - Sincronizar apenas campos alterados quando possível
  - Aplicar rate limits do Shopee/ML
  - Atualizar último sync timestamp
  - _Requirements: 1, 12_
  - _Effort: 2.5 horas_
  - _Acceptance Criteria:_
    - [x] Detecção de mudanças funcionando
    - [x] Sincronização de mudanças funcionando
    - [x] Rate limits respeitados
    - [x] Teste com 1000 atualizações/min

- [x] 8.4 Implementar deleção/desativação de produtos
  - Criar job para quando produto é deletado
  - Opção 1: Desativar anúncio (seguro)
  - Opção 2: Remover anúncio (se API permitir)
  - Limpar marketplace_products mappings
  - _Requirements: 1_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [x] Deleção dispara sync
    - [x] Anúncio desativado no marketplace
    - [x] Mapping limpo
    - [x] Teste de deleção funcional

### 9. Sincronização de Metadados e Atributos

- [x] 9.1 Sincronizar descrições e imagens
  - Implementar upload de múltiplas imagens
  - Formatar descrição HTML para cada marketplace
  - Otimizar imagens para web (compression)
  - Testar com descrições longas (>5000 chars)
  - _Requirements: 7, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] Múltiplas imagens carregadas
    - [x] Descrição formatada corretamente
    - [x] Imagens comprimidas
    - [x] Teste com descrição de 10k chars

- [x] 9.2 Sincronizar atributos específicos por marketplace
  - Implementar AttributeSyncService
  - Mapear atributos Portal → Shopee/ML
  - Validar atributos obrigatórios
  - Permitir valores padrão ou manual fallback
  - _Requirements: 7, 11_
  - _Effort: 2.5 horas_
  - _Acceptance Criteria:_
    - [x] Atributos obrigatórios identificados
    - [x] Validação funcionando
    - [x] Valores padrão aplicados
    - [x] Fallback manual permitido

---

## Phase 4: Roteamento de Pedidos (Dropshipping Core)

### 10. Processamento de Pedidos (Sem Estoque)

- [ ] 10.1 Implementar OrderRoutingService (dropshipping core)
  - Criar classe OrderRoutingService com métodos:
    - 
outeOrderToProvider(order)
    - llocateOrderToProvider(order)
    - alidateProviderStock(order)
    - 
otifyProviderOfOrder(order)
  - **Key Difference:** Sem estoque, apenas rotear para provedor
  - _Requirements: 2, 4, 5_
  - _Effort: 4 horas_
  - _Acceptance Criteria:_
    - [ ] Todos os métodos implementados
    - [ ] Roteamento automático funcionando
    - [ ] Validação de disponibilidade do provedor
    - [ ] Teste com 100 pedidos simultâneos

- [ ] 10.2 Implementar rastreamento de status do pedido
  - Criar tabela order_provider_assignments para rastrear roteamento
  - Registar timestamp de cada roteamento
  - Permitir re-roteamento se provedor indisponível
  - _Requirements: 4, 6_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Tabela criada
    - [ ] Roteamento registrado
    - [ ] Re-roteamento funcional
    - [ ] Teste com re-roteamento

- [ ] 10.3 Implementar notificação do provedor
  - Criar job para notificar provedor de novo pedido
  - Enviar dados do cliente (endereço de entrega)
  - Aguardar confirmação do provedor
  - Atualizar status do pedido
  - _Requirements: 4, 5_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Job criado
    - [ ] Dados do cliente enviados
    - [ ] Confirmação recebida
    - [ ] Status atualizado

- [ ] 10.4 Implementar fallback para múltiplos provedores
  - Se provedor A indisponível, tentar provedor B
  - Configurar prioridade de provedores por categoria
  - Notificar vendedor se todos os provedores indisponíveis
  - _Requirements: 5, 6_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Fallback funcionando
    - [ ] Prioridade configurável
    - [ ] Notificação enviada
    - [ ] Teste com 3 provedores

### 11. Webhooks de Pedidos dos Marketplaces

- [ ] 11.1 Implementar webhook handler para Shopee
  - Endpoint /api/webhooks/shopee/order
  - Validar assinatura HMAC-SHA256
  - Extrair dados do pedido (produtos, cliente, endereço)
  - Trigger job de roteamento para provedor
  - _Requirements: 4, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Endpoint funcionando
    - [ ] Assinatura validada
    - [ ] Roteamento disparado
    - [ ] Teste com payloads reais

- [ ] 11.2 Implementar webhook handler para Mercado Livre
  - Endpoint /api/webhooks/mercadolivre/order
  - Validar token de acesso
  - Extrair dados do pedido
  - Trigger job de roteamento para provedor
  - _Requirements: 4, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Endpoint funcionando
    - [ ] Token validado
    - [ ] Roteamento disparado
    - [ ] Teste com payloads reais

- [ ] 11.3 Armazenar pedidos com dados completos
  - Implementar storeOrder() method
  - Extrair: cliente, itens, endereço, pagamento, total
  - Criar registros em orders e order_items
  - Criar transaction para garantir consistência
  - _Requirements: 4_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Pedido armazenado completamente
    - [ ] Itens associados corretamente
    - [ ] Transação atômica
    - [ ] Teste com pedido de 10 itens

### 12. Sincronização de Status de Pedidos

- [ ] 12.1 Implementar atualização de status local
  - Permitir vendedor atualizar status (processing, shipped, delivered)
  - Validar transições de status
  - Registrar timestamp de mudança
  - Preparar dados para sincronização remota
  - _Requirements: 4_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Status atualizado localmente
    - [ ] Transições validadas
    - [ ] Timestamp registrado
    - [ ] Teste com todas as transições válidas

- [ ] 12.2 Sincronizar status para marketplace
  - Implementar syncOrderStatusToMarketplace()
  - Chamar API apropriada para Shopee/ML
  - Atualizar status do pedido no provedor
  - _Requirements: 4, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Sincronização implementada
    - [ ] Status atualizado no marketplace
    - [ ] Status atualizado no provedor
    - [ ] Teste com todos os status

---

## Phase 5: Relatórios e Analytics (Dropshipping)

### 13. Relatórios de Vendas e Provedores

- [ ] 13.1 Implementar relatórios de vendas
  - Total de vendas por período
  - Vendas por provedor
  - Vendas por marketplace
  - Comissões calculadas
  - _Requirements: 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Relatórios funcionando
    - [ ] Filtros por período
    - [ ] Exportação CSV/PDF
    - [ ] Teste com 1000 pedidos

- [ ] 13.2 Implementar relatórios de desempenho do provedor
  - Tempo médio de resposta
  - Taxa de sucesso nos pedidos
  - Estoque disponível (fornecido pelo provedor)
  - _Requirements: 5, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Métricas coletadas
    - [ ] Relatórios funcionando
    - [ ] Alertas configuráveis
    - [ ] Teste com provedores reais

---

## Phase 6: Escalonamento e Performance

### 14. Escalonamento Horizontal

- [ ] 14.1 Configurar multiple instances
  - Suportar múltiplas instâncias do Next.js
  - Redis para distributed locking
  - Database connection pooling
  - _Requirements: 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Múltiplas instâncias funcionando
    - [ ] Distributed locking
    - [ ] Connection pooling
    - [ ] Teste com 5 instâncias

- [ ] 14.2 Implementar queue workers
  - Múltiplos workers por fila
  - Balanceamento de carga
  - Retry e error handling
  - _Requirements: 6, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Workers configurados
    - [ ] Load balancing
    - [ ] Retry funcionando
    - [ ] Teste com 1000 jobs/min

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| **Phase 1: Infraestrutura** | 12 | ✅ 100% |
| **Phase 2: Auth & Providers** | 9 | ⏳ Pending |
| **Phase 3: Product Sync** | 12 | ⏳ Pending |
| **Phase 4: Order Routing** | 12 | ⏳ Pending |
| **Phase 5: Reporting** | 4 | ⏳ Pending |
| **Phase 6: Scaling** | 4 | ⏳ Pending |
| **TOTAL** | **53** | **22%** |

---

**Key Dropshipping Features:**
1. ✅ **Sem estoque** - Fornecedor mantém produtos
2. ✅ **Roteamento de pedidos** - Pedido → Provedor (sem estoque)
3. ✅ **Mapeamento Provider-SKU** - Associar produtos a provedores
4. ✅ **Sincronização automática** - Novos pedidos roteados automaticamente
5. ✅ **Fallback múltiplo** - Tenta múltiplos provedores se um indisponível
