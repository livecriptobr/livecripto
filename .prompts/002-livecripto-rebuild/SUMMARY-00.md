# FASE 0 - Fundacao do Projeto LiveCripto

## Data: 2026-01-02

## Resumo Executivo

FASE 0 concluida com sucesso. O projeto LiveCripto foi inicializado do zero com toda a infraestrutura base necessaria para desenvolvimento.

## O Que Foi Implementado

### 1. Inicializacao do Projeto Next.js
- Next.js 16 com App Router
- TypeScript configurado
- Tailwind CSS 4 integrado
- ESLint configurado
- Gerenciador de pacotes: pnpm

### 2. Dependencias Instaladas
- **@clerk/nextjs** - Autenticacao
- **prisma + @prisma/client** (v5.22.0) - ORM para banco de dados
- **zod** - Validacao de schemas
- **framer-motion** - Animacoes
- **lucide-react** - Icones

### 3. Schema Prisma Completo
Modelos criados em `prisma/schema.prisma`:
- **User** - Usuarios (streamers)
- **Donation** - Doacoes recebidas
- **Alert** - Fila de alertas para overlay
- **WithdrawRequest** - Solicitacoes de saque
- **WebhookEvent** - Eventos de webhook (idempotencia)
- **Ledger** - Registro contabil

Enums definidos:
- PaymentProvider (MERCADOPAGO, OPENPIX, COINSNAP)
- DonationStatus (CREATED, PENDING, PAID, FAILED, EXPIRED, REFUNDED)
- AlertStatus (QUEUED, LOCKED, READY, PLAYING, DONE, SKIPPED)
- WithdrawStatus (REQUESTED, PROCESSING, PAID, REJECTED)
- LedgerType (CREDIT, DEBIT)
- LedgerSource (DONATION, WITHDRAW, ADJUSTMENT)

### 4. Arquivos de Configuracao
- `src/lib/db.ts` - Singleton do Prisma Client
- `src/middleware.ts` - Middleware do Clerk para protecao de rotas
- `.env.example` - Template de variaveis de ambiente

### 5. Paginas Criadas

#### Landing Page (`src/app/page.tsx`)
- Design dark theme com gradiente roxo
- CTAs para Sign-up e Sign-in

#### Autenticacao
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

#### Dashboard
- `src/app/(dashboard)/dashboard/layout.tsx` - Layout com header e navegacao
- `src/app/(dashboard)/dashboard/page.tsx` - Pagina principal com cards de metricas

### 6. Estrutura de Pastas
```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/
│   │   └── sign-up/[[...sign-up]]/
│   ├── (dashboard)/
│   │   └── dashboard/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── donate/
│   └── overlay/
├── lib/
│   ├── db.ts
│   └── payments/
├── services/
├── types/
└── middleware.ts
prisma/
└── schema.prisma
```

## Proximos Passos (FASE 1)

1. Configurar variaveis de ambiente reais no Clerk
2. Criar pagina de doacao publica (`/d/[username]`)
3. Implementar webhook handler para MercadoPago
4. Criar overlay page (`/overlay/[token]`)
5. Implementar sistema de alertas com SSE

## Comandos Uteis

```bash
# Desenvolvimento
pnpm dev

# Gerar cliente Prisma apos alteracoes no schema
pnpm prisma generate

# Criar migration
pnpm prisma migrate dev --name nome_da_migration

# Visualizar banco de dados
pnpm prisma studio
```

## Variaveis de Ambiente Necessarias

Copie `.env.example` para `.env.local` e configure:
- DATABASE_URL (PostgreSQL)
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- CLERK_SECRET_KEY
- Credenciais de pagamento (MercadoPago, OpenPix, Coinsnap)

## Status
- [x] FASE 0 Concluida
- [ ] FASE 1 Pendente
