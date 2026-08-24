# ?? Como Iniciar Portal Vendas Localmente

## Pré-requisitos
- Docker Desktop instalado e rodando
- Node.js v18+ instalado
- PowerShell ou terminal compatível

## Passos para Iniciar

### 1?? Inicie os Serviços (PostgreSQL + Redis)

Abra um terminal PowerShell e execute:

```powershell
cd c:\Users\andre\portal-vendas
docker-compose up -d
```

Aguarde ~15 segundos para os health checks passarem.

Verifique o status:
```powershell
docker-compose ps
```

Ambos devem estar com status `healthy`.

---

### 2?? Execute as Migrations do Prisma

Em um novo terminal PowerShell:

```powershell
cd c:\Users\andre\portal-vendas
npx prisma migrate deploy
```

Isso vai criar as 15 tabelas PostgreSQL necessárias.

Alternativa se não tiver migrations:
```powershell
npx prisma db push
```

---

### 3?? Inicie o Servidor Next.js

```powershell
cd c:\Users\andre\portal-vendas
npm run dev
```

Você deve ver:
```
> next dev
  ? Next.js 16.3.1
  - Local:        http://localhost:3000
  - Environments: .env
```

---

### 4?? Verifique se Tudo Está Funcionando

Abra um terceiro terminal e teste o health endpoint:

```powershell
curl http://localhost:3000/api/health
```

Você deve receber uma resposta JSON como:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX...",
  "checks": {
    "database": { "status": "healthy", "latency": "5ms" },
    "redis": { "status": "healthy", "latency": "2ms" },
    "queues": { "status": "healthy", "queueCount": 5 }
  }
}
```

---

## ?? O que Foi Configurado

? **Infraestrutura Completa (Phase 1 - 100%):**
- PostgreSQL 16 com 15 tabelas
- Redis 7 com BullMQ (5 filas)
- Health check endpoint
- Exponential backoff para retries
- Cache layer com TTLs
- 24 tasks completadas

? **Próximas Fases (346 tasks restantes):**
- Phase 2-3: Integração com Shopee e Mercado Livre
- Phase 4-11: Sincronização, webhooks, resolução de conflitos

---

## ?? Parar os Serviços

```powershell
docker-compose down
```

Para remover volumes (banco de dados):
```powershell
docker-compose down -v
```

---

## ?? Troubleshooting

### Porta 5432 (PostgreSQL) já em uso
```powershell
docker-compose down
# Ou mude a porta em docker-compose.yml: "5433:5432"
```

### Porta 6379 (Redis) já em uso
```powershell
# Mude em docker-compose.yml: "6380:6379"
# Atualize .env: REDIS_PORT="6380"
```

### Migrations falhando
```powershell
# Reset completo do banco
npx prisma migrate reset --force
```

### next dev não inicia
```powershell
npm install
npm run dev
```

---

**Dúvidas?** Avise quando tiver iniciado! Depois continuaremos com Phase 2 (integrações com marketplaces).
