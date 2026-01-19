# Prompt: Database Schema e Deploy

## Objetivo
Criar o schema do banco de dados no Supabase e fazer deploy.

## Instruções

### 1. Executar no Supabase SQL Editor

```sql
-- ========================================
-- TABELA: profiles
-- ========================================
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,                    -- Clerk user ID
  username TEXT UNIQUE NOT NULL,
  warpay_apikey TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid()::text = id);

CREATE POLICY "Service role can do anything"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- TABELA: donations
-- ========================================
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT,
  donor_name TEXT DEFAULT 'Anônimo',
  message TEXT,
  amount_brl DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending, complete, expired
  crypto_currency TEXT,                   -- PIX, BTC, ETH, USDT, BTC-LN, etc
  payment_provider TEXT,                  -- openpix, coinsnap, stripe, warpay, test
  provider_invoice_id TEXT,
  audio_url TEXT,
  played_in_overlay BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_donations_user_id ON donations(user_id);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_provider_invoice ON donations(provider_invoice_id);

-- RLS
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert donations"
  ON donations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own donations"
  ON donations FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()::text));

CREATE POLICY "Users can update own donations"
  ON donations FOR UPDATE
  USING (user_id IN (SELECT id FROM profiles WHERE id = auth.uid()::text));

CREATE POLICY "Service role can do anything"
  ON donations FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- TABELA: webhook_events (Idempotência)
-- ========================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,                 -- stripe, coinsnap, openpix
  event_type TEXT,
  data JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_provider ON webhook_events(provider);

-- RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON webhook_events FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- REALTIME
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE donations;
```

### 2. Configurar Webhooks nos Providers

#### OpenPix
1. Acessar https://app.openpix.com.br
2. Ir em Configurações → Webhooks
3. Adicionar URL: `https://livecripto.net/api/webhooks/openpix`
4. Eventos: `OPENPIX:CHARGE_COMPLETED`

#### Coinsnap
1. Acessar https://app.coinsnap.io
2. Ir em Store → Settings → Webhooks
3. Adicionar URL: `https://livecripto.net/api/webhooks/coinsnap`
4. Copiar Webhook Secret para `COINSNAP_WEBHOOK_SECRET`

### 3. Deploy no Vercel

```bash
cd livecripto-app

# Instalar Vercel CLI
pnpm add -g vercel

# Login
vercel login

# Deploy
vercel deploy --prod
```

### 4. Configurar ENVs no Vercel

No dashboard do Vercel, ir em Settings → Environment Variables e adicionar:

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_BASE_URL` | https://livecripto.net |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | pk_live_... |
| `CLERK_SECRET_KEY` | sk_live_... |
| `NEXT_PUBLIC_SUPABASE_URL` | https://lgsdiaqgfelqahshjljl.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sb_publishable_... |
| `SUPABASE_SERVICE_ROLE_KEY` | sb_secret_... |
| `COINSNAP_API_KEY` | (obter do Coinsnap) |
| `COINSNAP_STORE_ID` | (obter do Coinsnap) |
| `COINSNAP_WEBHOOK_SECRET` | (obter do Coinsnap) |
| `OPENPIX_APP_ID` | (obter do OpenPix) |
| `BUNNY_STORAGE_HOST` | br.storage.bunnycdn.com |
| `BUNNY_STORAGE_ZONE_NAME` | tts-livecripto |
| `BUNNY_STORAGE_KEY` | (chave do Bunny) |
| `BUNNY_CDN_HOST` | tts-livecripto.b-cdn.net |
| `WARPAY_API_URL` | https://warpay.livecripto.net/api/invoices |

### 5. Configurar Domínio

1. No Vercel, ir em Settings → Domains
2. Adicionar `livecripto.net`
3. Configurar DNS no provedor do domínio

### 6. Testar

1. Acessar https://livecripto.net
2. Fazer login/cadastro
3. Ir em `/panel` para ver dashboard
4. Ir em `/widgets` para pegar links
5. Testar doação em `/{username}`
6. Testar overlay em `/overlay/{username}`

## Checklist Final

- [ ] Schema do banco criado
- [ ] RLS configurado
- [ ] Realtime habilitado para donations
- [ ] Webhook OpenPix configurado
- [ ] Webhook Coinsnap configurado
- [ ] Deploy no Vercel feito
- [ ] ENVs configuradas
- [ ] Domínio configurado
- [ ] Teste de doação PIX funcionando
- [ ] Teste de doação Lightning funcionando
- [ ] Overlay funcionando com TTS
