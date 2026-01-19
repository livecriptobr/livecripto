# FASE 3 - Integracao de Pagamentos

## Resumo
Implementacao completa dos clientes de pagamento para OpenPix (PIX), Coinsnap (Lightning Network) e MercadoPago (Cartao), incluindo webhooks para processamento assincrono de confirmacoes de pagamento.

## Arquivos Criados

### Clientes de Pagamento (src/lib/payments/)

- **openpix.ts** - Cliente OpenPix para pagamentos PIX:
  - `createPixCharge()` - Cria cobranca PIX com QR Code
  - `validateOpenPixSignature()` - Valida assinatura HMAC-SHA256 dos webhooks
  - Retorna: chargeId, qrCode, copyPaste, expiresAt

- **coinsnap.ts** - Cliente Coinsnap para Lightning Network:
  - `createLightningInvoice()` - Cria invoice Lightning
  - `validateCoinsnapSignature()` - Valida assinatura dos webhooks
  - Retorna: invoiceId, bolt11, qrCode, expiresAt

- **mercadopago.ts** - Cliente MercadoPago para cartao:
  - `createCheckoutPreference()` - Cria preferencia de checkout
  - `getPaymentStatus()` - Consulta status de pagamento
  - `getPaymentByExternalReference()` - Busca pagamento por referencia
  - Retorna: preferenceId, redirectUrl

- **currency.ts** - Conversao de moeda em tempo real:
  - `convertBrlToUsd()` - Converte BRL para USD (para Coinsnap)
  - `convertUsdToBrl()` - Converte USD para BRL
  - `getCurrentUsdBrlRate()` - Obtem taxa de cambio atual
  - Usa API awesomeapi.com.br com fallback para taxa fixa

### Webhook Idempotency (src/lib/)

- **webhook-idempotency.ts** - Garante processamento unico de webhooks:
  - `processWebhookOnce()` - Executa handler apenas uma vez por evento
  - `isWebhookProcessed()` - Verifica se evento ja foi processado
  - `markWebhookFailed()` - Marca evento como falho para retry
  - Usa tabela WebhookEvent com constraint unique em eventKey

### Servicos (src/services/)

- **donation.service.ts** - Servico de doacoes:
  - `handleDonationPaid()` - Processa pagamento confirmado (transacao):
    - Atualiza status para PAID
    - Cria entrada no Ledger (credito)
    - Cria Alert para overlay
  - `handleDonationFailed()` - Marca doacao como falha
  - `handleDonationExpired()` - Marca doacao como expirada
  - `updateDonationProviderId()` - Atualiza ID do provedor
  - `getDonationByProviderId()` - Busca por ID do provedor
  - `getDonationWithUser()` - Busca com dados do usuario
  - `getPendingDonationsOlderThan()` - Para limpeza/expiracao

### Webhooks (src/app/api/webhooks/)

- **openpix/route.ts** - Webhook OpenPix:
  - Valida assinatura x-webhook-signature
  - Processa evento OPENPIX:CHARGE_COMPLETED
  - Usa correlationID como chave de idempotencia

- **coinsnap/route.ts** - Webhook Coinsnap:
  - Valida assinatura btcpay-sig
  - Processa eventos InvoiceSettled e InvoiceExpired
  - Usa orderId como chave de idempotencia

- **mercadopago/route.ts** - Webhook MercadoPago:
  - Processa notificacoes tipo payment
  - Consulta API para obter status real
  - Associa pagamento via external_reference
  - Processa approved, rejected, cancelled

### API Atualizada

- **api/public/donate/init/route.ts** - Endpoint de inicio de doacao:
  - Detecta automaticamente se providers estao configurados
  - Usa provider real se env vars existem
  - Fallback para mock em desenvolvimento
  - Flags: USE_REAL_OPENPIX, USE_REAL_COINSNAP, USE_REAL_MERCADOPAGO

## Variaveis de Ambiente Necessarias

```env
# OpenPix (PIX)
OPENPIX_APP_ID=sua_app_id
OPENPIX_WEBHOOK_SECRET=seu_webhook_secret

# Coinsnap (Lightning)
COINSNAP_API_KEY=sua_api_key
COINSNAP_STORE_ID=seu_store_id
COINSNAP_WEBHOOK_SECRET=seu_webhook_secret

# MercadoPago (Cartao)
MERCADOPAGO_ACCESS_TOKEN=seu_access_token

# App URL (para callbacks)
NEXT_PUBLIC_APP_URL=https://seusite.com
```

## Fluxo de Pagamento

1. Usuario inicia doacao via `/api/public/donate/init`
2. API cria registro no banco e chama provider
3. Provider retorna QR Code/Invoice/RedirectURL
4. Usuario realiza pagamento
5. Provider envia webhook para `/api/webhooks/{provider}`
6. Webhook valida assinatura e processa idempotentemente
7. `handleDonationPaid()` executa em transacao:
   - Atualiza status da doacao
   - Credita saldo do streamer
   - Cria alerta para overlay

## Funcionalidades Implementadas

- [x] Cliente OpenPix com criacao de cobranca PIX
- [x] Cliente Coinsnap com criacao de invoice Lightning
- [x] Cliente MercadoPago com preferencia de checkout
- [x] Conversao de moeda BRL/USD em tempo real
- [x] Webhook idempotente para evitar duplicacao
- [x] Validacao de assinatura em todos os webhooks
- [x] Processamento transacional de pagamentos
- [x] Credito automatico no Ledger
- [x] Criacao automatica de Alert para overlay
- [x] Fallback para mock em desenvolvimento
- [x] Tratamento de erros e logging

## Proximos Passos (Fase 4)

- Sistema de alertas e overlay em tempo real
- Conexao WebSocket/SSE para updates
- Player de alertas com TTS
- Fila de reproducao de alertas

## Dependencias

- crypto (nativo Node.js, para HMAC)
- @prisma/client (banco de dados)
