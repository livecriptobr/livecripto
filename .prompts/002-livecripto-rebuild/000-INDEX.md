# LiveCripto Rebuild - Índice de Prompts

## Resumo
Reconstrução completa do LiveCripto em Next.js 14 (App Router) com Clerk, Supabase, e três métodos de pagamento (PIX/OpenPix, Cartão/MercadoPago, Lightning/Coinsnap).

## Prompts de Execução

| Fase | Arquivo | Descrição | Dependências |
|------|---------|-----------|--------------|
| 0 | `002-00-setup.md` | Setup do projeto (Next.js, Prisma, Clerk, estrutura) | Nenhuma |
| 1 | `002-01-user-provisioning.md` | Provisionamento de usuário (Clerk → Supabase) | Fase 0 |
| 2 | `002-02-donation-page.md` | Página pública de doação + API init (mock) | Fase 1 |
| 3 | `002-03-payments.md` | Integração real dos 3 providers + webhooks | Fase 2 |
| 4 | `002-04-alerts-overlay.md` | Sistema de alertas + Overlay OBS | Fase 3 |
| 5 | `002-05-tts-bunny.md` | Pipeline TTS + Upload Bunny + Cleanup | Fase 4 |
| 6 | `002-06-payout-ledger.md` | Ledger de saldo + Solicitação de saques | Fase 5 |
| 7 | `002-07-hardening.md` | Segurança, logs, dashboard final, README | Fase 6 |

## Ordem de Execução

**SEQUENCIAL** - Cada fase depende da anterior.

```
Fase 0 (Setup)
    ↓
Fase 1 (User Provisioning)
    ↓
Fase 2 (Donation Page)
    ↓
Fase 3 (Payments)
    ↓
Fase 4 (Alerts + Overlay)
    ↓
Fase 5 (TTS + Bunny)
    ↓
Fase 6 (Payout + Ledger)
    ↓
Fase 7 (Hardening + README)
```

## Stack Tecnológica

- **Framework**: Next.js 14 (App Router)
- **Linguagem**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Clerk
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Pagamentos**: OpenPix (PIX), MercadoPago (Cartão), Coinsnap (Lightning)
- **TTS**: Google Cloud Text-to-Speech
- **Storage**: Bunny CDN

## Modelos de Dados

- **User**: Criador/streamer com Clerk auth
- **Donation**: Doações recebidas
- **Alert**: Alertas para overlay
- **Ledger**: Registro de créditos/débitos
- **WithdrawRequest**: Solicitações de saque
- **WebhookEvent**: Idempotência de webhooks

## Definition of Done

- [ ] Criador faz login com Clerk
- [ ] Registro no Supabase com username e overlayToken
- [ ] Página pública de doação funcional
- [ ] PIX via OpenPix funcionando
- [ ] Cartão via MercadoPago funcionando
- [ ] Lightning via Coinsnap funcionando
- [ ] Webhooks com idempotência
- [ ] Alertas aparecem no overlay
- [ ] TTS gera áudio e faz upload para Bunny
- [ ] Overlay não duplica alertas (lock/ack)
- [ ] Skip/replay funcionam
- [ ] Rotate token funciona
- [ ] Áudios expiram automaticamente
- [ ] Dashboard com saldo e histórico
- [ ] Solicitação de saque funcional
- [ ] README completo
