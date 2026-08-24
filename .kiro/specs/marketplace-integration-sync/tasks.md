# Implementation Plan: Marketplace Integration & Sync

## Overview

Plano de implementação completo para sincronização bidirecional de produtos, estoque e pedidos entre Portal Vendas e Marketplaces (Shopee e Mercado Livre). O projeto utiliza Next.js + TypeScript com arquitetura orientada a eventos baseada em BullMQ para processamento assíncrono e PostgreSQL para persistência.

---

## Phase 1: Infraestrutura de Base

### 1. Configuração do Projeto e Dependências

- [x] 1.1 Instalar e configurar dependências principais
  - Instalar: `bull`, `bullmq`, `redis`, `pg`, `prisma`, `@prisma/client`
  - Criar arquivo `.env` com variáveis de ambiente (Redis, PostgreSQL, marketplace tokens)
  - Configurar tipo-segurança com Prisma CLI
  - _Requirements: 1, 2, 3, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] Todos os pacotes instalados com sucesso
    - [x] `.env.example` criado com todas as variáveis necessárias
    - [x] `prisma init` executado e configurado

- [x] 1.2 Configurar estrutura de diretórios e padrões
  - Criar: `src/lib/services/`, `src/lib/types/`, `src/lib/utils/`, `src/api/`, `src/jobs/`
  - Padronizar exportação de tipos e serviços
  - Criar arquivo de configuração centralizado (`src/config.ts`)
  - _Requirements: Arquitetura_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [x] Estrutura de diretórios criada
    - [x] Arquivos de configuração centralizados
    - [x] Padrões de importação documentados

### 2. Banco de Dados PostgreSQL

- [x] 2.1 Criar schema PostgreSQL com todas as tabelas
  - Implementar schema completo (products, marketplace_products, orders, inventory, etc.)
  - Criar indexes para performance (vendor_id, marketplace, status, created_at)
  - Configurar constraints e foreign keys
  - _Requirements: 1, 2, 4, 5, 6, 7, 8_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [x] Todas as 10 tabelas criadas
    - [x] Todos os indexes criados
    - [x] Foreign keys validadas
    - [x] Schema testado com dados de exemplo

- [x] 2.2 Configurar Prisma ORM e migrations
  - Criar `schema.prisma` com todos os modelos
  - Implementar primeira migration
  - Testar geração de tipos TypeScript
  - _Requirements: 1, 2, 4, 5, 6, 7_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [x] `schema.prisma` completo e válido
    - [x] Migration inicial criada e testada
    - [x] Tipos TypeScript gerados automaticamente
    - [x] Prisma Client configurado

### 3. Sistema de Filas (BullMQ + Redis)

- [x] 3.1 Configurar Redis e BullMQ
  - Instalar e conectar ao Redis (local ou Docker)
  - Criar factory de filas (`src/lib/queue.ts`)
  - Implementar 5 filas: productSync, inventorySync, orderSync, webhookProcessing, errorRecovery
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
  - Criar helper de cache (`src/lib/cache.ts`)
  - Implementar TTLs para: schemas (5min), produtos (1min), inventário (30s), pedidos (2min)
  - Criar funções: get, set, invalidate, batch operations
  - _Requirements: 12_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [x] Helper de cache criado
    - [x] TTLs definidos conforme design
    - [x] Invalidação de cache ao atualizar dados
    - [x] Teste de hit/miss rate

- [ ] 4.2 Configurar cache de schemas de marketplaces
  - Cachear respostas de listagem de categorias/atributos do Shopee e ML
  - Implementar refresh automático ao expirar
  - Criar endpoint para invalidação manual
  - _Requirements: 11, 12_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [ ] Schemas cacheados
    - [ ] Refresh automático funcionando
    - [ ] Endpoint de invalidação manual
    - [ ] Teste de consistência de cache

---

## Phase 2: Autenticação, Autorização e Segurança

### 5. Gestão de Tokens de Autenticação

- [ ] 5.1 Implementar vault seguro para armazenamento de tokens
  - Criar serviço `src/lib/services/auth.service.ts` com métodos:
    - `storeMarketplaceCredentials()`
    - `retrieveAndDecrypt()`
    - `validateToken()`
    - `isTokenExpired()`
  - Implementar criptografia AES-256-GCM
  - Usar salt e IV aleatórios
  - _Requirements: 3, 6_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] Tokens criptografados antes de armazenar
    - [ ] Descriptografia segura
    - [ ] Validação de integridade com authTag
    - [ ] Teste de round-trip (encrypt/decrypt)

- [ ] 5.2 Implementar renovação automática de tokens (refresh)
  - Criar método `refreshToken()` no AuthService
  - Integrar com BullMQ para renovação agendada
  - Notificar vendedor quando refresh falha
  - Fazer fallback para manual re-auth
  - _Requirements: 3, 6_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Refresh token implementado
    - [ ] Job de renovação agendado
    - [ ] Notificação de falha enviada
    - [ ] Fallback para manual re-auth

- [ ] 5.3 Criar endpoints de autenticação de marketplaces
  - `POST /api/marketplace/auth/connect` - conectar conta
  - `DELETE /api/marketplace/auth/:marketplace` - desconectar
  - `POST /api/marketplace/auth/:marketplace/refresh` - renovar manual
  - Validar credenciais antes de armazenar
  - _Requirements: 3, 6_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] 3 endpoints funcionando
    - [ ] Validação de credenciais
    - [ ] Erro tratado quando token inválido
    - [ ] Teste com OAuth2 Shopee e ML

### 6. Validação de Webhooks

- [ ] 6.1 Implementar validação de assinatura de webhooks
  - Criar serviço `src/lib/services/webhook-validator.service.ts`
  - Implementar HMAC-SHA256 para Shopee
  - Implementar token validation para Mercado Livre
  - Usar `timingSafeEqual` para evitar timing attacks
  - _Requirements: 10, 3_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Validação HMAC-SHA256 Shopee funcionando
    - [ ] Validação token ML funcionando
    - [ ] Timing-safe comparison implementada
    - [ ] Teste com payloads inválidos (rejeitados)

- [ ] 6.2 Implementar idempotência em webhooks
  - Adicionar campo `webhook_delivery_id` único
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
    - [ ] Teste de carga no webhook

---

## Phase 3: Sincronização de Produtos

### 7. Mapeamento de Dados (Portal → Marketplace)

- [ ] 7.1 Implementar mapeamento de produtos para Shopee
  - Criar método `mapProductToShopee()` em ProductSyncService
  - Mapear: título, descrição, preço, imagens, categoria, atributos
  - Validar campos obrigatórios
  - Testar com produtos reais
  - _Requirements: 1, 7, 11_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] Mapeamento completo implementado
    - [ ] Campos obrigatórios validados
    - [ ] Descrição formatada como HTML
    - [ ] Teste com 5 produtos diferentes

- [ ] 7.2 Implementar mapeamento de produtos para Mercado Livre
  - Criar método `mapProductToML()` em ProductSyncService
  - Mapear: título, descrição, preço, imagens, categoria, atributos
  - Validar contra schema ML (categorias, atributos obrigatórios)
  - Testar com produtos reais
  - _Requirements: 1, 7, 11_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] Mapeamento completo implementado
    - [ ] Validação de categoria/atributos
    - [ ] Descrição formatada corretamente
    - [ ] Teste com 5 produtos diferentes

- [ ] 7.3 Criar estratégia de mapeamento de categorias
  - Implementar `CategoryMappingService`
  - Cachear categorias de cada marketplace
  - Permitir mapeamento manual customizado
  - Validar contra regras de cada marketplace
  - _Requirements: 7, 11_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Categorias cacheadas (5min TTL)
    - [ ] Mapeamento automático funcionando
    - [ ] Mapeamento manual permitido
    - [ ] Validação de regras funcionando

### 8. Sincronização de Produtos (Portal → Marketplace)

- [ ] 8.1 Implementar ProductSyncService com métodos core
  - Criar classe `ProductSyncService` com métodos:
    - `syncProductToMarketplaces(product)`
    - `batchSyncProducts(products)`
    - `fetchMarketplaceProduct(marketplace, id)`
    - `mapProductToMarketplace(product, marketplace)`
  - Integrar com filas de processamento
  - _Requirements: 1, 7, 12_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] Todos os métodos implementados
    - [ ] Integração com queue funcionando
    - [ ] Logging estruturado
    - [ ] Teste com 100 produtos (batch)

- [ ] 8.2 Implementar sincronização de novo produto
  - Criar job para quando produto é criado
  - Enviar para todos os marketplaces configurados
  - Armazenar remoteId de cada marketplace
  - Atualizar último sync timestamp
  - _Requirements: 1_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Job criado para novo produto
    - [ ] RemoteIds armazenados
    - [ ] Timestamp atualizado
    - [ ] Teste end-to-end (Portal → Shopee/ML)

- [ ] 8.3 Implementar sincronização de atualização de produto
  - Detectar mudanças (título, preço, descrição, imagens)
  - Sincronizar apenas campos alterados quando possível
  - Aplicar rate limits do Shopee/ML
  - Atualizar último sync timestamp
  - _Requirements: 1, 12_
  - _Effort: 2.5 horas_
  - _Acceptance Criteria:_
    - [ ] Detecção de mudanças funcionando
    - [ ] Sincronização de mudanças funcionando
    - [ ] Rate limits respeitados
    - [ ] Teste com 1000 atualizações/min

- [ ] 8.4 Implementar deleção/desativação de produtos
  - Criar job para quando produto é deletado
  - Opção 1: Desativar anúncio (seguro)
  - Opção 2: Remover anúncio (se API permitir)
  - Limpar marketplace_products mappings
  - _Requirements: 1_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Deleção dispara sync
    - [ ] Anúncio desativado no marketplace
    - [ ] Mapping limpo
    - [ ] Teste de deleção funcional

### 9. Sincronização de Metadados e Atributos

- [ ] 9.1 Sincronizar descrições e imagens
  - Implementar upload de múltiplas imagens
  - Formatar descrição HTML para cada marketplace
  - Otimizar imagens para web (compression)
  - Testar com descrições longas (>5000 chars)
  - _Requirements: 7, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Múltiplas imagens carregadas
    - [ ] Descrição formatada corretamente
    - [ ] Imagens comprimidas
    - [ ] Teste com descrição de 10k chars

- [ ] 9.2 Sincronizar atributos específicos por marketplace
  - Implementar AttributeSyncService
  - Mapear atributos Portal → Shopee/ML
  - Validar atributos obrigatórios
  - Permitir valores padrão ou manual fallback
  - _Requirements: 7, 11_
  - _Effort: 2.5 horas_
  - _Acceptance Criteria:_
    - [ ] Atributos obrigatórios identificados
    - [ ] Validação funcionando
    - [ ] Valores padrão aplicados
    - [ ] Fallback manual permitido

---

## Phase 4: Sincronização de Estoque

### 10. Gerenciamento de Inventário

- [ ] 10.1 Implementar InventoryService com gestão de estoque
  - Criar classe `InventoryService` com métodos:
    - `updateInventory(productId, quantity)`
    - `reserveInventory(productId, quantity)`
    - `releaseReservation(productId, quantity)`
    - `getAvailableQuantity(productId)`
    - `checkOutOfStock(productId)`
  - Usar transações DB para evitar race conditions
  - _Requirements: 2, 6_
  - _Effort: 2.5 horas_
  - _Acceptance Criteria:_
    - [ ] Todos os métodos implementados
    - [ ] Transações implementadas
    - [ ] Teste de race condition
    - [ ] Teste de múltiplas operações simultâneas

- [ ] 10.2 Implementar sincronização de estoque (Portal → Marketplaces)
  - Criar job que sincroniza quantidade para todos os marketplaces
  - Aplicar rate limits
  - Retry com backoff exponencial
  - Log detalhado de cada sincronização
  - _Requirements: 2, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Job sincroniza quantidade
    - [ ] Rate limits respeitados
    - [ ] Retry funcionando
    - [ ] Teste com 500 produtos

- [ ] 10.3 Implementar lock distribuído para estoque
  - Usar Redis para distributed lock
  - Implementar `acquireInventoryLock()` e `releaseInventoryLock()`
  - TTL automático para evitar deadlocks
  - Fallback para SQL locking
  - _Requirements: 2, 6_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Lock adquirido com sucesso
    - [ ] TTL funcionando
    - [ ] Fallback para SQL funcionando
    - [ ] Teste de lock contention

- [ ] 10.4 Implementar desativação automática quando estoque = 0
  - Job que verifica estoque disponível
  - Desativa anúncio no marketplace quando = 0
  - Reativa quando estoque > 0
  - Notifica vendedor
  - _Requirements: 2_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Desativação automática funcionando
    - [ ] Reativação automática funcionando
    - [ ] Notificação enviada
    - [ ] Teste com múltiplos produtos

### 11. Sincronização de Estoque via Webhooks (Marketplace → Portal)

- [ ] 11.1 Implementar captura de mudanças de estoque por webhook
  - Criar handler para webhook de inventário
  - Extrair quantidade do payload do Shopee/ML
  - Atualizar inventário local
  - Notificar se há discrepância
  - _Requirements: 2, 4, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Webhook capturado
    - [ ] Quantidade atualizada
    - [ ] Discrepância detectada
    - [ ] Notificação enviada

- [ ] 11.2 Implementar restauração de estoque em cancelamento
  - Quando pedido é cancelado, restaurar estoque
  - Validar que pedido existe
  - Log de restauração
  - Verificar se há conflito com outros pedidos
  - _Requirements: 2, 4_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Cancelamento dispara restauração
    - [ ] Quantidade restaurada corretamente
    - [ ] Log criado
    - [ ] Conflitos detectados e tratados

---

## Phase 5: Captura e Gerenciamento de Pedidos

### 12. Captura de Pedidos via Webhooks

- [ ] 12.1 Implementar OrderManagementService
  - Criar classe `OrderManagementService` com métodos:
    - `captureOrderFromWebhook(event)`
    - `storeOrder(remoteOrder)`
    - `updateOrderStatus(orderId, status)`
    - `syncOrderStatusToMarketplace(orderId, status)`
    - `listOrders(filter)`
    - `getOrderDetails(orderId)`
  - _Requirements: 4, 6, 10_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] Todos os métodos implementados
    - [ ] Transações em cascata
    - [ ] Logging detalhado
    - [ ] Teste com dados reais de Shopee/ML

- [ ] 12.2 Implementar webhook handler para pedidos
  - Criar endpoint `POST /api/webhooks/order`
  - Validar assinatura
  - Checar idempotência
  - Enfileirar para processamento
  - Extrair dados do cliente, itens, endereço
  - _Requirements: 4, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Endpoint criado
    - [ ] Validação funcionando
    - [ ] Idempotência funcionando
    - [ ] Webhook testado com Shopee/ML

- [ ] 12.3 Armazenar pedidos com dados completos
  - Implementar `storeOrder()` method
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

- [ ] 12.4 Atualizar estoque ao capturar pedido
  - Automaticamente descontar do inventário_disponível
  - Usar reserved_quantity se não houver stock
  - Validar se tem estoque suficiente
  - Notificar se overselling ocorreu
  - _Requirements: 2, 4_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Estoque descontado automaticamente
    - [ ] Reserved quantity atualizado
    - [ ] Validação de estoque funcionando
    - [ ] Notificação de overselling enviada

### 13. Sincronização de Status de Pedidos

- [ ] 13.1 Implementar atualização de status local
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

- [ ] 13.2 Sincronizar status para marketplace
  - Implementar `syncOrderStatusToMarketplace()`
  - Chamar API apropriada para Shopee/ML
  - Incluir tracking number se disponível
  - Retry com backoff em caso de falha
  - Notificar vendedor em caso de erro
  - _Requirements: 4_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Status sincronizado para Shopee
    - [ ] Status sincronizado para ML
    - [ ] Tracking number incluído
    - [ ] Retry funcionando
    - [ ] Notificação de erro enviada

- [ ] 13.3 Receber atualizações de status do marketplace
  - Criar webhook handler para status changes
  - Atualizar status local
  - Notificar vendedor se mudança importante
  - Detectar discrepâncias
  - _Requirements: 4, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Webhook handler criado
    - [ ] Status atualizado localmente
    - [ ] Notificação enviada
    - [ ] Discrepância detectada

---

## Phase 6: Tratamento de Erros e Falhas

### 14. Error Handling Framework

- [ ] 14.1 Implementar ErrorHandlerService
  - Criar classe `ErrorHandlerService` com métodos:
    - `classifyError(error)`
    - `isRecoverable(error)`
    - `retryWithBackoff(fn, maxRetries, baseDelay)`
    - `executeWithCircuitBreaker(key, fn)`
    - `logError(error)`
    - `notifyAdminOfError(error)`
  - Classificar erros: timeout, auth, rate limit, bad request, etc
  - _Requirements: 6, 12_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] Todos os métodos implementados
    - [ ] Classificação correta de erros
    - [ ] Retry backoff funcionando (5s, 10s, 20s, 60s)
    - [ ] Circuit breaker funcionando

- [ ] 14.2 Implementar retry com exponential backoff
  - Backoff formula: delay = baseDelay * (2 ^ attempt), max 60s
  - Configurações diferentes por tipo de erro
  - Logging de cada tentativa
  - Random jitter para evitar thundering herd
  - _Requirements: 1, 2, 4, 6, 10_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Backoff calculado corretamente
    - [ ] Jitter implementado
    - [ ] Logging de tentativas
    - [ ] Teste com 5+ tentativas

- [ ] 14.3 Implementar circuit breaker
  - Estados: CLOSED (normal), OPEN (reject), HALF_OPEN (testing)
  - Thresholds: 5 failures → OPEN, 2 successes → CLOSED
  - Timeout de 60s antes de HALF_OPEN
  - Notificar admin quando OPEN
  - _Requirements: 6, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Estados implementados corretamente
    - [ ] Transições funcionando
    - [ ] Notificação enviada quando OPEN
    - [ ] Teste com 10+ falhas seguidas

- [ ] 14.4 Implementar dead letter queue
  - Jogar para DLQ após N tentativas falhadas
  - Armazenar dados completos do job
  - Criar admin endpoint para revisar e reprocessar
  - Notificar admin periodicamente
  - _Requirements: 6, 12_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] DLQ criada
    - [ ] Job movido após falhas
    - [ ] Endpoint de review criado
    - [ ] Reprocessamento funcionando

### 15. Detecção e Resolução de Conflitos

- [ ] 15.1 Implementar ConflictDetectionService
  - Criar classe `ConflictDetectionService`
  - Implementar `detectConflicts(local, remote, field)`
  - Comparar: preço, estoque, título, descrição
  - Considerar timestamps (qual é mais recente)
  - Usar field-level comparison
  - _Requirements: 5_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Conflitos detectados corretamente
    - [ ] Timestamps comparados
    - [ ] Campos múltiplos suportados
    - [ ] Teste com 20+ cenários

- [ ] 15.2 Implementar ConflictResolutionService
  - Criar classe `ConflictResolutionService`
  - Estratégias: 'latest', 'local-priority', 'remote-priority', 'inventory-min'
  - Implementar `resolveByStrategy(conflict, strategy)`
  - Aplicar resolução automaticamente
  - Notificar vendedor se necessário
  - _Requirements: 5_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Todas as estratégias implementadas
    - [ ] Resolução aplicada automaticamente
    - [ ] Notificação enviada ao vendedor
    - [ ] Teste com todas as estratégias

- [ ] 15.3 Implementar resolução manual de conflitos
  - Criar endpoint `POST /api/conflicts/:id/resolve`
  - Permitir vendedor escolher qual valor usar
  - Validar entrada
  - Aplicar resolução e sincronizar
  - Registrar decisão para auditoria
  - _Requirements: 5_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Endpoint criado
    - [ ] Validação funcionando
    - [ ] Resolução aplicada
    - [ ] Auditoria registrada

- [ ] 15.4 Implementar logging de conflitos
  - Criar ConflictLog com: campo, valor_local, valor_remoto, timestamp
  - Armazenar em DB
  - Criar endpoint para listar conflitos não resolvidos
  - Dashboard visual de conflitos
  - _Requirements: 5, 8_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Conflitos registrados na DB
    - [ ] Endpoint de listagem criado
    - [ ] Filtros funcionando
    - [ ] Teste com 100 conflitos

---

## Phase 7: Logging e Auditoria

### 16. Sistema de Logging Estruturado

- [ ] 16.1 Implementar logging estruturado com Winston
  - Instalar Winston e winston-daily-rotate-file
  - Configurar níveis: error, warn, info, debug, trace
  - Estrutura: timestamp, level, service, operation, userId, details
  - Arquivos por dia em `logs/`
  - _Requirements: 6, 8_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Winston configurado
    - [ ] Níveis de log funcionando
    - [ ] Arquivos diários criados
    - [ ] Formato estruturado

- [ ] 16.2 Implementar audit log para operações críticas
  - Logar: sincronizações, mudanças de estoque, status updates, conflitos
  - Incluir: userId, timestamp, ação, dados antes/depois
  - Armazenar em DB (sync_logs table)
  - Manter por 90+ dias
  - _Requirements: 6, 8_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Audit log criado para operações
    - [ ] Dados antes/depois armazenados
    - [ ] Retenção de 90 dias
    - [ ] Teste com 1000 logs

- [ ] 16.3 Implementar observabilidade para filas
  - Logar entrada/saída de jobs
  - Registrar duração de processamento
  - Contar sucessos/falhas por tipo
  - Criar métricas para alertas
  - _Requirements: 6, 8, 12_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Job lifecycle logado
    - [ ] Duração registrada
    - [ ] Contadores implementados
    - [ ] Métricas coletadas

---

## Phase 8: API Endpoints

### 17. Product Management Endpoints

- [ ] 17.1 Criar endpoints de gerenciamento de produtos
  - `POST /api/products` - criar novo produto
  - `PUT /api/products/:id` - atualizar produto
  - `DELETE /api/products/:id` - deletar produto
  - `GET /api/products/:id` - obter detalhes
  - Validar entrada com Zod/Joi
  - _Requirements: 1, 7_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] 4 endpoints implementados
    - [ ] Validação funcionando
    - [ ] Erro handling apropriado
    - [ ] Teste com dados válidos/inválidos

- [ ] 17.2 Criar endpoints de sincronização manual
  - `GET /api/products/:id/sync-status` - status de sync
  - `POST /api/products/:id/force-sync` - forçar sync agora
  - `GET /api/products/:id/history` - histórico de syncs
  - Filtro por marketplace
  - _Requirements: 1_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] 3 endpoints implementados
    - [ ] Status retornado corretamente
    - [ ] Histórico paginado
    - [ ] Filtros funcionando

### 18. Inventory Endpoints

- [ ] 18.1 Criar endpoints de inventário
  - `PUT /api/inventory/:productId` - atualizar quantidade
  - `GET /api/inventory/:productId` - obter quantidade
  - `GET /api/inventory` - listar por filtros
  - Retornar: total, reserved, available, by_marketplace
  - _Requirements: 2_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] 3 endpoints implementados
    - [ ] Quantidade atualizada corretamente
    - [ ] Breakdown por marketplace
    - [ ] Teste com múltiplos produtos

### 19. Order Endpoints

- [ ] 19.1 Criar endpoints de pedidos
  - `GET /api/orders` - listar com paginação e filtros
  - `GET /api/orders/:orderId` - detalhes do pedido
  - `PUT /api/orders/:orderId/status` - atualizar status
  - `PUT /api/orders/:orderId/tracking` - atualizar rastreamento
  - _Requirements: 4_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] 4 endpoints implementados
    - [ ] Paginação funcionando
    - [ ] Filtros por status/marketplace/data
    - [ ] Teste com 1000 pedidos

- [ ] 19.2 Criar endpoints de dashboard de pedidos
  - `GET /api/orders/metrics` - totais e estatísticas
  - `GET /api/orders/pending` - pedidos aguardando ação
  - `GET /api/orders/recent` - últimos 20 pedidos
  - _Requirements: 4, 8_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [ ] 3 endpoints implementados
    - [ ] Métricas calculadas corretamente
    - [ ] Performance < 500ms
    - [ ] Teste com 10k pedidos

### 20. Configuration Endpoints

- [ ] 20.1 Criar endpoints de configuração de sync
  - `GET /api/config/sync` - obter config
  - `PUT /api/config/sync` - atualizar config
  - Parâmetros: sync_frequency, auto_sync_enabled, conflict_strategy, max_retries
  - Validar valores permitidos
  - _Requirements: 9, 8_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] 2 endpoints implementados
    - [ ] Validação de valores
    - [ ] Config aplicada imediatamente
    - [ ] Teste com todas as opções

- [ ] 20.2 Criar endpoints de webhook management
  - `GET /api/webhooks/deliveries` - listar entregas
  - `GET /api/webhooks/deliveries/:id` - detalhe
  - `POST /api/webhooks/deliveries/:id/retry` - retentar
  - Filtro por status, marketplace, data
  - _Requirements: 10, 8_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] 3 endpoints implementados
    - [ ] Paginação funcionando
    - [ ] Retry disparado corretamente
    - [ ] Teste com 1000 deliveries

---

## Phase 9: Dashboard e Monitoramento

### 21. Dashboard de Sincronização

- [ ] 21.1 Implementar endpoints de dashboard
  - `GET /api/dashboard/sync-status` - status geral
  - `GET /api/dashboard/metrics` - métricas de período
  - `GET /api/dashboard/marketplace/:marketplace` - detalhe por marketplace
  - Dados: status, last_sync, product_count, error_count, recent_errors
  - _Requirements: 8_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] 3 endpoints implementados
    - [ ] Status calculado corretamente
    - [ ] Performance < 1s
    - [ ] Teste com dados reais

- [ ] 21.2 Implementar page de dashboard no frontend
  - Exibir status geral (healthy/warning/critical)
  - Cards por marketplace
  - Gráficos de sucesso/falha (últimos 7 dias)
  - Lista de erros recentes
  - _Requirements: 8_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] Layout implementado
    - [ ] Status visual correto
    - [ ] Gráficos renderizados
    - [ ] Auto-refresh a cada 30s

- [ ] 21.3 Implementar alertas em tempo real
  - Notificar quando sincronização falha 3x
  - Notificar quando fila > 10k items
  - Notificar quando webhook delay > 5s
  - Usar WebSocket para tempo real
  - _Requirements: 6, 8, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] WebSocket configurado
    - [ ] Alertas enviados corretamente
    - [ ] Persistência de alertas
    - [ ] Teste com múltiplos clientes

---

## Phase 10: Testes

### 22. Unit Tests

- [ ] 22.1 Escrever testes para ProductSyncService
  - Testes de mapeamento (Shopee/ML)
  - Testes de validação
  - Testes de categorias e atributos
  - Coverage mínimo: 90%
  - _Requirements: Qualidade_
  - _Effort: 3 horas_
  - _Acceptance Criteria:_
    - [ ] 20+ testes implementados
    - [ ] Coverage > 90%
    - [ ] Testes passando
    - [ ] Mock de APIs externas

- [ ] 22.2 Escrever testes para InventoryService
  - Testes de atualização
  - Testes de reserva
  - Testes de lock distribuído
  - Testes de race conditions
  - Coverage mínimo: 90%
  - _Requirements: Qualidade_
  - _Effort: 2.5 horas_
  - _Acceptance Criteria:_
    - [ ] 15+ testes implementados
    - [ ] Coverage > 90%
    - [ ] Testes de concorrência
    - [ ] Testes passando

- [ ] 22.3 Escrever testes para OrderManagementService
  - Testes de captura
  - Testes de atualização de status
  - Testes de armazenamento
  - Coverage mínimo: 90%
  - _Requirements: Qualidade_
  - _Effort: 2.5 horas_
  - _Acceptance Criteria:_
    - [ ] 15+ testes implementados
    - [ ] Coverage > 90%
    - [ ] Teste com dados reais
    - [ ] Testes passando

- [ ] 22.4 Escrever testes para ErrorHandlerService
  - Testes de classificação de erro
  - Testes de retry backoff
  - Testes de circuit breaker
  - Coverage mínimo: 95%
  - _Requirements: Qualidade_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] 20+ testes implementados
    - [ ] Coverage > 95%
    - [ ] Todos os cenários cobertos
    - [ ] Testes passando

### 23. Integration Tests

- [ ] 23.1 Testar fluxo completo de sincronização de produto
  - Criar produto no Portal
  - Sincronizar para Shopee
  - Sincronizar para Mercado Livre
  - Validar nos dois marketplaces
  - _Requirements: 1, 7, 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Teste criado e passando
    - [ ] Produto criado em ambos marketplaces
    - [ ] Dados corretos mapeados
    - [ ] Teste com 5 tipos de produtos diferentes

- [ ] 23.2 Testar fluxo de sincronização de estoque
  - Alterar estoque no Portal
  - Sincronizar para marketplaces
  - Receber webhook de venda
  - Descontar automaticamente
  - Reativar quando restabelecer estoque
  - _Requirements: 2, 4, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Teste criado e passando
    - [ ] Estoque atualizado em todos os places
    - [ ] Webhook processado corretamente
    - [ ] Desativação/reativação automática

- [ ] 23.3 Testar captura de pedido via webhook
  - Simular webhook de novo pedido (Shopee/ML)
  - Validar captura
  - Validar armazenamento
  - Validar desconto de estoque
  - Validar notificação ao vendedor
  - _Requirements: 4, 10_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Teste criado e passando
    - [ ] Pedido capturado corretamente
    - [ ] Estoque descontado
    - [ ] Notificação enviada

- [ ] 23.4 Testar tratamento de erros e retries
  - Simular timeout de API
  - Validar retry com backoff
  - Simular rate limit
  - Validar fila de retry
  - Validar notificação após 3 falhas
  - _Requirements: 6, 12_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Teste criado e passando
    - [ ] Retry executado corretamente
    - [ ] Backoff calculado corretamente
    - [ ] Notificação enviada

- [ ] 23.5 Testar detecção e resolução de conflitos
  - Criar conflito de preço
  - Validar detecção
  - Testar cada estratégia de resolução
  - Validar resolução manual
  - Validar sincronização pós-resolução
  - _Requirements: 5_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Teste criado e passando
    - [ ] Conflitos detectados
    - [ ] Todas as estratégias testadas
    - [ ] Sincronização pós-resolução

### 24. Load Tests

- [ ] 24.1 Teste de carga: sincronização de 1000 produtos
  - Setup: 1000 produtos para sincronizar
  - Validar conclusão em < 5 minutos
  - Validar taxa de sucesso > 95%
  - Monitorar CPU/memória/conexões
  - _Requirements: 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] 1000 produtos sincronizados
    - [ ] Tempo < 5 min
    - [ ] Taxa de sucesso > 95%
    - [ ] Recursos utilizados < 80%

- [ ] 24.2 Teste de carga: webhooks simultâneos
  - Simular 100 webhooks/seg
  - Validar processamento em < 30s
  - Validar fila não overflow
  - Monitorar CPU/memória
  - _Requirements: 10, 12_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] 100 webhooks/seg processados
    - [ ] Latência < 30s
    - [ ] Fila estável
    - [ ] Sem memory leak

- [ ] 24.3 Teste de carga: dashboard com 10k pedidos
  - Setup: 10k pedidos no banco
  - Validar listagem em < 2s
  - Validar paginação em < 1s
  - Validar métricas em < 1s
  - _Requirements: 8, 12_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [ ] Query < 2s
    - [ ] Paginação < 1s
    - [ ] Métricas < 1s
    - [ ] Índices otimizados

---

## Phase 11: Deployment e Operacional

### 25. Dockerização e Containerização

- [ ] 25.1 Criar Dockerfile para aplicação
  - Multi-stage build para otimização
  - Node base image slim
  - Instalar apenas dependências de produção
  - Healthcheck implementado
  - _Requirements: Deployment_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [ ] Dockerfile criado
    - [ ] Build bem-sucedido
    - [ ] Image size < 500MB
    - [ ] Healthcheck funcionando

- [ ] 25.2 Criar docker-compose para ambiente local
  - Services: app, postgres, redis
  - Volumes para dados persistentes
  - Environment variables configuradas
  - Health checks para cada serviço
  - _Requirements: Deployment_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [ ] docker-compose.yml criado
    - [ ] `docker-compose up` funciona
    - [ ] Todos os serviços saudáveis
    - [ ] Dados persistem entre restarts

- [ ] 25.3 Configurar CI/CD pipeline (GitHub Actions)
  - Teste: lint, unit tests, integration tests
  - Build: Docker image
  - Push: Docker registry
  - Deploy: staging automático
  - _Requirements: Deployment_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Pipeline criado
    - [ ] Testes executados automaticamente
    - [ ] Build e push funcionando
    - [ ] Deploy automático para staging

### 26. Monitoramento em Produção

- [ ] 26.1 Setup de observabilidade
  - Instalar e configurar Prometheus
  - Exportar métricas de: API, fila, database
  - Configurar Grafana para visualização
  - Criar dashboards de saúde
  - _Requirements: 8_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Prometheus coletando métricas
    - [ ] Grafana exibindo dashboards
    - [ ] Métricas de API/fila/DB
    - [ ] Alertas configurados

- [ ] 26.2 Setup de logging centralizado
  - Instalar ELK Stack (Elasticsearch, Logstash, Kibana)
  - Ou usar CloudWatch/DataDog
  - Centralizar logs de todos os services
  - Criar queries para troubleshooting
  - _Requirements: 6, 8_
  - _Effort: 2 horas_
  accept_
    - [ ] Logs centralizados
    - [ ] Kibana acessível
    - [ ] Filtros e queries funcionando
    - [ ] Retenção 90+ dias

- [ ] 26.3 Setup de alertas
  - Criar alertas para: taxa de erro > 5%, fila > 10k, API latência > 2s
  - Integrar com Slack/PagerDuty
  - Escalation policy
  - Teste de alert
  - _Requirements: 6, 8_
  - _Effort: 1 hora_
  - _Acceptance Criteria:_
    - [ ] Alertas criados
    - [ ] Integração com Slack
    - [ ] Teste de alerta funcionando
    - [ ] Runbooks criados

### 27. Scaling e Performance

- [ ] 27.1 Otimizar queries de banco de dados
  - Criar índices estratégicos
  - Analisar planos de query
  - Otimizar N+1 queries
  - Implementar paginação
  - _Requirements: 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Índices criados
    - [ ] Queries explicadas
    - [ ] Performance melhorada > 50%
    - [ ] Teste com 1M de registros

- [ ] 27.2 Configurar auto-scaling horizontal
  - Load balancer (Nginx/HAProxy)
  - Múltiplas instâncias da aplicação
  - Session sharing via Redis
  - Health checks
  - _Requirements: 12_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Load balancer configurado
    - [ ] 3+ instâncias da app
    - [ ] Session sharing funcionando
    - [ ] Failover testado

- [ ] 27.3 Otimizar cache strategy
  - L1 cache em memória (LRU)
  - L2 cache em Redis
  - Cache invalidation automática
  - Teste de hit rate
  - _Requirements: 12_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] 2 camadas de cache
    - [ ] TTLs configurados
    - [ ] Hit rate > 80%
    - [ ] Teste sob carga

### 28. Documentação e Runbooks

- [ ] 28.1 Criar documentação da arquitetura
  - Diagrama geral da arquitetura
  - Descrição de cada componente
  - Data flows
  - Security considerations
  - _Requirements: Documentação_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Documentação completa
    - [ ] Diagramas claros
    - [ ] Exemplos de fluxo
    - [ ] Revisado

- [ ] 28.2 Criar runbooks para operações comuns
  - Como escalar manualmente
  - Como debugar sincronização falhada
  - Como resolver conflitos
  - Como fazer rollback
  - _Requirements: Documentação_
  - _Effort: 2 horas_
  - _Acceptance Criteria:_
    - [ ] Runbooks criados
    - [ ] Passo a passo claro
    - [ ] Screenshots inclusos
    - [ ] Testados com novo operador

- [ ] 28.3 Criar guia de troubleshooting
  - Problemas comuns e soluções
  - Como ler logs
  - Como interpretar métricas
  - Contatos e escalation
  - _Requirements: Documentação_
  - _Effort: 1.5 horas_
  - _Acceptance Criteria:_
    - [ ] Guia criado
    - [ ] 10+ problemas cobertos
    - [ ] Exemplos reais
    - [ ] Revisado

---

## Summary & Notes

### Task Statistics

- **Total Tasks**: 28 epics com ~100 sub-tasks
- **Total Effort Estimado**: ~120-150 horas
- **Phases**: 11 fases
- **Dependencies**: Fase 1 → Fase 2 → Fases 3-5 (paralelo) → Fase 6-9 (paralelo) → Fases 10-11

### Implementation Order

**Phase 1-2** (Infrastructure + Auth): Deve ser feito primeiro - base para tudo
**Phase 3-5** (Sync + Orders): Podem ser feitos em paralelo (diferentes services)
**Phase 6-9** (Errors + Endpoints + Dashboard): Paralelo, mas dependem de Phase 1-5
**Phase 10-11** (Testes + Deployment): Paralelo aos anteriores, mas finaliza antes de produção

### Key Considerations

1. **Database**: Prepare migrations desde o início, test scaling com 1M+ registros
2. **Queue**: Monitorar tamanho de fila, implementar DLQ para jobs problemáticos
3. **Cache**: Implementar invalidation strategy clara desde cedo
4. **Error Handling**: Não deixar para o final - integrar durante implementação
5. **Testes**: Escrever testes conforme implementa, não deixar para o final
6. **Monitoring**: Setup antes de produção, não depois

### Risk Mitigation

- **Race Conditions**: Usar locks distribuídos desde Phase 4
- **Data Loss**: Backup diário de DB, transaction logs
- **API Rate Limits**: Implementar queue e rate limiter em Phase 1
- **Token Expiration**: Refresh tokens antes de expirar, não depois

### Success Criteria

- [ ] Todos os endpoints testados
- [ ] Taxa de sync success > 99%
- [ ] Latência API < 500ms (p95)
- [ ] Latência webhook < 30s (p95)
- [ ] CPU < 70%, Memória < 80%
- [ ] Coverage de testes > 85%
- [ ] Zero data loss em produção

