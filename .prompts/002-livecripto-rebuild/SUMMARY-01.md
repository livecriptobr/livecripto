# FASE 1 - Provisionamento de Usuario (Clerk -> Supabase)

## Data: 2026-01-02

## Resumo Executivo

FASE 1 concluida com sucesso. O sistema de provisionamento de usuarios entre Clerk e o banco de dados PostgreSQL (via Prisma) foi implementado com duas estrategias complementares: webhook e on-demand.

## O Que Foi Implementado

### 1. Funcoes de Geracao de Username (`src/lib/username.ts`)
- **normalizeUsername()** - Normaliza strings para username valido:
  - Converte para minusculas
  - Remove acentos (NFD normalization)
  - Substitui caracteres especiais por hifens
  - Colapsa hifens multiplos
  - Limita a 20 caracteres
- **generateRandomSuffix()** - Gera sufixo aleatorio de 4 caracteres (hex)
- **generateOverlayToken()** - Gera token de overlay de 64 caracteres (hex)

### 2. User Service Completo (`src/services/user.service.ts`)
Servico centralizado para operacoes de usuario:
- **getOrCreateUser()** - Busca ou cria usuario com username unico
- **getUserByClerkId()** - Busca por Clerk ID
- **getUserByUsername()** - Busca por username
- **updateUsername()** - Atualiza username com validacao de unicidade
- **rotateOverlayToken()** - Regenera token de overlay
- **updatePayoutSettings()** - Atualiza PIX key e Lightning Address
- **updateAlertSettings()** - Atualiza configuracoes de alertas (merge)

### 3. Webhook Handler do Clerk (`src/app/api/webhooks/clerk/route.ts`)
Endpoint para receber eventos do Clerk via Svix:
- **user.created** - Cria usuario no banco com username unico
- **user.updated** - Atualiza email e displayName
- **user.deleted** - Remove usuario do banco
- Validacao de assinatura HMAC via Svix
- Tratamento de erros robusto

### 4. Dashboard Layout Atualizado (`src/app/(dashboard)/dashboard/layout.tsx`)
- Sidebar fixa com navegacao
- On-demand provisioning (fallback se webhook falhar)
- Links para: Dashboard, Perfil, Historico, Saques, Alertas, Controles

### 5. Dashboard Page Atualizada (`src/app/(dashboard)/dashboard/page.tsx`)
- Exibe dados do usuario provisionado
- Mostra link de doacao publica
- Mostra URL do overlay (truncada)
- Exibe informacoes do usuario (username, displayName, email, doacao minima)

### 6. Componente UserLinks (`src/components/dashboard/UserLinks.tsx`)
- Componente cliente para copiar links
- Botoes com feedback visual (Check/Copy icons)
- URLs de doacao e overlay

### 7. Dependencias Instaladas
- **svix** - Validacao de webhooks do Clerk
- **lucide-react** - Icones (Check, Copy)

## Estrutura de Arquivos Criados

```
src/
├── lib/
│   └── username.ts          # Funcoes de username
├── services/
│   └── user.service.ts      # Servico de usuario
├── app/
│   ├── api/
│   │   └── webhooks/
│   │       └── clerk/
│   │           └── route.ts # Webhook handler
│   └── (dashboard)/
│       └── dashboard/
│           ├── layout.tsx   # Layout atualizado
│           └── page.tsx     # Page atualizada
└── components/
    └── dashboard/
        └── UserLinks.tsx    # Componente de links
```

## Configuracao Necessaria

### 1. Variavel de Ambiente
Adicione ao `.env.local`:
```
CLERK_WEBHOOK_SECRET=whsec_xxxx
```

### 2. Configurar Webhook no Clerk Dashboard
1. Acesse: Clerk Dashboard > Webhooks
2. Crie novo endpoint: `https://seu-dominio.com/api/webhooks/clerk`
3. Selecione eventos: `user.created`, `user.updated`, `user.deleted`
4. Copie o Signing Secret para `CLERK_WEBHOOK_SECRET`

### 3. Para desenvolvimento local
Use ngrok ou similar para expor endpoint local:
```bash
ngrok http 3000
```

## Fluxo de Provisionamento

```
[Usuario cria conta no Clerk]
         |
         v
[Clerk envia webhook user.created]
         |
         v
[POST /api/webhooks/clerk]
         |
         +--> [Valida assinatura Svix]
         |
         +--> [Gera username unico]
         |
         +--> [Cria User no banco]
         |
         v
[Usuario no banco de dados]

--- FALLBACK (se webhook falhar) ---

[Usuario acessa /dashboard]
         |
         v
[Layout chama userService.getOrCreateUser()]
         |
         +--> [Busca por clerkUserId]
         |
         +--> [Se nao existe, cria]
         |
         v
[Usuario garantido no banco]
```

## Proximos Passos (FASE 2)

1. Criar pagina de doacao publica (`/[username]`)
2. Implementar formulario de doacao
3. Integrar primeiro gateway de pagamento (OpenPix para PIX)
4. Criar pagina de overlay (`/overlay/[username]`)

## Comandos Uteis

```bash
# Desenvolvimento
pnpm dev

# Gerar cliente Prisma
pnpm prisma generate

# Criar migration
pnpm prisma migrate dev --name add_user_fields

# Testar webhook localmente (com ngrok)
ngrok http 3000
```

## Status
- [x] FASE 0 Concluida
- [x] FASE 1 Concluida
- [ ] FASE 2 Pendente
