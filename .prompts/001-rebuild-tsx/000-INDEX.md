# LiveCripto TSX - Plano de Reconstrução

## Resumo
Recriar o aplicativo LiveCripto em TypeScript/Next.js com os métodos de pagamento do wbtv.

## Arquivos do Plano

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `001-rebuild-plan.md` | Plano completo com todas as fases |
| 2 | `002-PROMPT-setup-project.md` | Setup do projeto Next.js |
| 3 | `003-PROMPT-payment-libs.md` | Libraries de pagamento (Coinsnap, OpenPix, TTS) |
| 4 | `004-PROMPT-api-routes.md` | Todas as API routes |
| 5 | `005-PROMPT-frontend-pages.md` | Páginas do frontend |
| 6 | `006-PROMPT-database-deploy.md` | Schema do banco e deploy |

## Ordem de Execução

1. **Setup** - Executar `002-PROMPT-setup-project.md`
2. **Libs** - Executar `003-PROMPT-payment-libs.md`
3. **APIs** - Executar `004-PROMPT-api-routes.md`
4. **Frontend** - Executar `005-PROMPT-frontend-pages.md`
5. **Deploy** - Executar `006-PROMPT-database-deploy.md`

## ENVs Necessárias

### Do LiveCripto Atual
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BUNNY_STORAGE_HOST`
- `BUNNY_STORAGE_ZONE_NAME`
- `BUNNY_STORAGE_KEY`
- `BUNNY_CDN_HOST`

### Do WBTV (Pagamentos)
- `COINSNAP_API_KEY`
- `COINSNAP_STORE_ID`
- `COINSNAP_WEBHOOK_SECRET`
- `OPENPIX_APP_ID`
- `STRIPE_SECRET_KEY` (opcional, para futuro)
- `STRIPE_WEBHOOK_SECRET` (opcional, para futuro)

## Fluxos de Pagamento

### PIX (OpenPix)
```
Usuário → Formulário → API /donate → OpenPix → Webhook → TTS → Overlay
```

### Lightning (Coinsnap)
```
Usuário → Formulário → Converte BRL→USD → Coinsnap → BOLT11 → Wallet → Webhook → TTS → Overlay
```

### Cripto On-Chain (WarPay)
```
Usuário → Formulário → WarPay API → Endereço Crypto → Monitor → TTS → Overlay
```

## Tecnologias

- **Framework**: Next.js 14 (App Router)
- **Linguagem**: TypeScript
- **Auth**: Clerk
- **Database**: Supabase
- **Pagamentos**: OpenPix, Coinsnap, WarPay
- **Storage**: Bunny CDN
- **Deploy**: Vercel
