# LiveCripto — Guia Completo de Setup

## Variáveis de Ambiente

### Já configuradas (.env.local)

| Variável | Status | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | OK | Supabase PostgreSQL pooler |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | OK | Clerk auth (live) |
| `CLERK_SECRET_KEY` | OK | Clerk auth (live) |
| `NEXT_PUBLIC_APP_URL` | MUDAR para produção | URL base da aplicação |
| `OPENPIX_APP_ID` | OK | OpenPix (PIX) |
| `COINSNAP_API_KEY` | OK | Coinsnap (Lightning) |
| `COINSNAP_STORE_ID` | OK | Coinsnap (Lightning) |
| `NOWPAYMENTS_API_KEY` | OK | NOWPayments (Crypto) |
| `NOWPAYMENTS_IPN_SECRET` | OK | NOWPayments webhook secret |
| `INTERNAL_API_SECRET` | OK | Segredo interno para TTS |
| `CRON_SECRET` | OK | Segredo para cron jobs |

### Precisam ser preenchidas (VAZIAS no .env.local)

| Variável | Onde obter | Para que serve |
|----------|-----------|----------------|
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard > Webhooks | Validação de webhooks do Clerk |
| `MERCADOPAGO_ACCESS_TOKEN` | [MercadoPago Developers](https://www.mercadopago.com.br/developers) | Pagamentos com cartão |
| `GOOGLE_TTS_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) > Cloud Text-to-Speech API | Leitura de mensagens por voz |
| `BUNNY_STORAGE_ZONE` | [bunny.net](https://bunny.net) > Storage Zones | Upload de arquivos (TTS, mídia) |
| `BUNNY_STORAGE_KEY` | bunny.net > Storage Zone > API Key | Autenticação Bunny CDN |
| `BUNNY_CDN_HOST` | bunny.net > Pull Zone hostname | URL pública dos arquivos |

### Precisam ser adicionadas ao .env.local (NÃO existem ainda)

| Variável | Onde obter | Para que serve |
|----------|-----------|----------------|
| `TENOR_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) > Tenor API v2 | Busca de GIFs nas doações |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Moderação IA de conteúdo |
| `IP_HASH_SALT` | Gere com: `openssl rand -hex 32` | Salt para hash de IP (privacidade) |
| `TWITCH_CLIENT_ID` | [dev.twitch.tv/console](https://dev.twitch.tv/console) | Verificação via Twitch |
| `TWITCH_CLIENT_SECRET` | dev.twitch.tv/console | Verificação via Twitch |
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com) > OAuth 2.0 | Verificação via YouTube |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console > OAuth 2.0 | Verificação via YouTube |

---

## Trabalho Manual Necessário

### 1. Domínio e URL de Produção

Alterar `NEXT_PUBLIC_APP_URL` de `http://localhost:3000` para o domínio de produção (ex: `https://livecripto.net`).

### 2. Webhooks para Configurar em Serviços Externos

| Serviço | URL do Webhook | Onde configurar |
|---------|---------------|-----------------|
| **Clerk** | `{APP_URL}/api/webhooks/clerk` | Clerk Dashboard > Webhooks > Add Endpoint |
| **OpenPix** | `{APP_URL}/api/webhooks/openpix` | Painel OpenPix > Configurações > Webhooks |
| **Coinsnap** | `{APP_URL}/api/webhooks/coinsnap` | Painel Coinsnap > Store Settings > Webhooks |
| **NOWPayments** | `{APP_URL}/api/webhooks/nowpayments` | NOWPayments Dashboard > IPN Settings |
| **MercadoPago** | Automático (enviado na criação do pagamento) | Nenhuma ação manual |

### 3. OAuth Redirect URIs

Configurar nos respectivos painéis de desenvolvedor:

| Serviço | Redirect URI |
|---------|-------------|
| **Twitch** | `{APP_URL}/api/verification/social/twitch/callback` |
| **Google/YouTube** | `{APP_URL}/api/verification/social/youtube/callback` |

### 4. Bunny CDN

1. Criar conta em [bunny.net](https://bunny.net)
2. Criar uma **Storage Zone** (região: São Paulo se disponível)
3. Criar um **Pull Zone** conectado à Storage Zone
4. Copiar: zona de storage, API key, hostname do pull zone
5. Preencher: `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_KEY`, `BUNNY_CDN_HOST`

### 5. Google Cloud

Habilitar estas APIs no Google Cloud Console:
- **Cloud Text-to-Speech API** (para TTS)
- **Tenor API** (para GIFs)
- **YouTube Data API v3** (para verificação YouTube)

Criar:
- 1 API Key (para TTS e Tenor)
- 1 OAuth 2.0 Client ID (para YouTube verification)

### 6. Arquivos de Som

Os sons de alerta padrão precisam ser adicionados manualmente. Opções:
- **Via Dashboard**: O streamer pode fazer upload de sons customizados em Configurações > Incentivos > Tiers de Alerta
- **Arquivos padrão**: Adicionar MP3s em Bunny CDN e referenciar nas configurações padrão

### 7. Primeiro Admin

Para acessar o painel de aprovação de verificações (`/admin/verifications`):
1. No Clerk Dashboard, encontre o usuário admin
2. Em "Public Metadata", adicione: `{ "role": "admin" }`

---

## Prioridade de Setup

### Crítico (app não funciona sem):
1. `NEXT_PUBLIC_APP_URL` → domínio de produção
2. `CLERK_WEBHOOK_SECRET` → registrar webhook no Clerk
3. Bunny CDN configurado → TTS precisa para armazenar áudio
4. `GOOGLE_TTS_API_KEY` → leitura de doações

### Importante (features ficam desabilitadas):
5. `MERCADOPAGO_ACCESS_TOKEN` → pagamentos com cartão
6. `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` → verificação Twitch
7. `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` → verificação YouTube
8. `TENOR_API_KEY` → busca de GIFs
9. `OPENAI_API_KEY` → moderação IA

### Recomendado (segurança):
10. `IP_HASH_SALT` → gerar com `openssl rand -hex 32`
11. `OPENPIX_WEBHOOK_SECRET` → validação de assinatura webhook OpenPix
12. `COINSNAP_WEBHOOK_SECRET` → validação de assinatura webhook Coinsnap

---

## TODOs no Código

| Arquivo | Linha | Descrição |
|---------|-------|-----------|
| `src/services/moderation.ts` | ~254 | Integrar Google Cloud Speech-to-Text para transcrição de áudio |
| `src/services/moderation.ts` | ~264 | Integrar Google Cloud Vision para moderação de imagem |

Estes são stubs que retornam `allowed: true`. Para ativar:
- Instalar: `npm install @google-cloud/speech @google-cloud/vision`
- Configurar credenciais do Google Cloud (service account JSON)
- Implementar a lógica de transcrição/análise

---

## Variáveis que NÃO são usadas (podem ser removidas do .env.local)

| Variável | Motivo |
|----------|--------|
| `MERCADOPAGO_PUBLIC_KEY` | Não referenciada no código |
| `MERCADOPAGO_WEBHOOK_SECRET` | Não referenciada no código |

---

## Template .env.local Completo

```bash
# === DATABASE ===
DATABASE_URL="postgresql://..."

# === CLERK AUTH ===
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
CLERK_WEBHOOK_SECRET=""  # PREENCHER
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

# === APP ===
NEXT_PUBLIC_APP_URL="https://livecripto.net"  # MUDAR para produção
INTERNAL_API_SECRET="..."
CRON_SECRET="..."

# === PAYMENTS ===
OPENPIX_APP_ID="..."
OPENPIX_WEBHOOK_SECRET=""  # PREENCHER (opcional, segurança)
COINSNAP_API_KEY="..."
COINSNAP_STORE_ID="..."
COINSNAP_WEBHOOK_SECRET=""  # PREENCHER (opcional, segurança)
MERCADOPAGO_ACCESS_TOKEN=""  # PREENCHER
NOWPAYMENTS_API_KEY="..."
NOWPAYMENTS_IPN_SECRET="..."

# === STORAGE ===
BUNNY_STORAGE_HOST="storage.bunnycdn.com"
BUNNY_STORAGE_ZONE=""  # PREENCHER
BUNNY_STORAGE_KEY=""  # PREENCHER
BUNNY_CDN_HOST=""  # PREENCHER

# === GOOGLE CLOUD ===
GOOGLE_TTS_API_KEY=""  # PREENCHER
GOOGLE_CLIENT_ID=""  # PREENCHER (YouTube OAuth)
GOOGLE_CLIENT_SECRET=""  # PREENCHER (YouTube OAuth)

# === TWITCH ===
TWITCH_CLIENT_ID=""  # PREENCHER
TWITCH_CLIENT_SECRET=""  # PREENCHER

# === OPTIONAL ===
TENOR_API_KEY=""  # Para busca de GIFs
OPENAI_API_KEY=""  # Para moderação IA
IP_HASH_SALT=""  # Gerar com: openssl rand -hex 32
```
