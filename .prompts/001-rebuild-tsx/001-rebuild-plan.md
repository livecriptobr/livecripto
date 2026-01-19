# Plano de Reconstrução: LiveCripto TSX

## Objetivo
Recriar o aplicativo LiveCripto em TypeScript/Next.js usando as ENVs atuais do livecripto e integrando os métodos de pagamento do wbtv (Stripe, Coinsnap/Lightning, OpenPix/PIX).

---

## Fase 1: Setup do Projeto Next.js

### 1.1 Inicialização
```bash
npx create-next-app@latest livecripto-tsx --typescript --tailwind --eslint --app --src-dir
cd livecripto-tsx
```

### 1.2 Dependências
```bash
# Auth
pnpm add @clerk/nextjs

# Database
pnpm add @supabase/supabase-js

# Payments
pnpm add stripe

# UI/UX
pnpm add framer-motion lucide-react

# Utils
pnpm add zod
```

---

## Fase 2: Configuração de Environment Variables

### 2.1 Arquivo `.env.local`

```env
# ========================================
# APP CONFIGURATION
# ========================================
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=https://livecripto.net

# ========================================
# CLERK AUTH
# ========================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsubGl2ZWNyaXB0by5uZXQk
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/cadastro

# ========================================
# SUPABASE DATABASE
# ========================================
NEXT_PUBLIC_SUPABASE_URL=https://lgsdiaqgfelqahshjljl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# ========================================
# STRIPE (Cartão de Crédito)
# ========================================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ========================================
# COINSNAP (Lightning Network / Bitcoin)
# ========================================
COINSNAP_API_KEY=
COINSNAP_STORE_ID=
COINSNAP_WEBHOOK_SECRET=

# ========================================
# OPENPIX / WOOVI (PIX)
# ========================================
OPENPIX_APP_ID=

# ========================================
# BUNNY CDN (TTS Storage)
# ========================================
BUNNY_STORAGE_HOST=br.storage.bunnycdn.com
BUNNY_STORAGE_ZONE_NAME=tts-livecripto
BUNNY_STORAGE_KEY=
BUNNY_CDN_HOST=tts-livecripto.b-cdn.net

# ========================================
# WARPAY (Legacy - opcional)
# ========================================
WARPAY_API_URL=https://warpay.livecripto.net/api/invoices
```

---

## Fase 3: Estrutura de Pastas

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/[[...login]]/page.tsx
│   │   └── cadastro/[[...cadastro]]/page.tsx
│   ├── (dashboard)/
│   │   ├── panel/page.tsx
│   │   └── layout.tsx
│   ├── (public)/
│   │   ├── [username]/page.tsx          # Página de doação
│   │   └── overlay/[username]/page.tsx  # Overlay OBS
│   ├── api/
│   │   ├── config/route.ts
│   │   ├── donate/route.ts
│   │   ├── donate/test/route.ts
│   │   └── webhooks/
│   │       ├── stripe/route.ts
│   │       ├── coinsnap/route.ts
│   │       └── openpix/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── actions/
│   ├── donate.ts
│   ├── profile.ts
│   └── wallet.ts
├── components/
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── StatsCards.tsx
│   │   ├── DonationsList.tsx
│   │   └── WalletConfig.tsx
│   ├── donate/
│   │   ├── DonationForm.tsx
│   │   ├── PaymentMethodSelector.tsx
│   │   ├── CryptoPaymentModal.tsx
│   │   └── PixPaymentModal.tsx
│   ├── overlay/
│   │   └── AlertBox.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Card.tsx
├── lib/
│   ├── coinsnap.ts           # Client Coinsnap (do wbtv)
│   ├── openpix.ts            # Client OpenPix (do wbtv)
│   ├── stripe.ts             # Client Stripe
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   └── tts.ts                # Google TTS + Bunny Upload
├── services/
│   ├── donationService.ts
│   ├── paymentService.ts
│   └── ttsService.ts
└── types/
    ├── database.ts
    └── payments.ts
```

---

## Fase 4: Database Schema (Supabase)

### 4.1 Tabela `profiles`
```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,                    -- Clerk user ID
  username TEXT UNIQUE NOT NULL,
  warpay_apikey TEXT,                     -- Legacy WarPay key
  stripe_customer_id TEXT,                -- Stripe Customer ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Tabela `donations`
```sql
CREATE TABLE donations (
  id TEXT PRIMARY KEY,                    -- Invoice ID ou UUID
  user_id TEXT REFERENCES profiles(id),
  username TEXT,
  donor_name TEXT DEFAULT 'Anônimo',
  message TEXT,
  amount_brl DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending, complete, expired
  crypto_currency TEXT,                   -- PIX, BTC, ETH, USDT, etc
  payment_provider TEXT,                  -- openpix, coinsnap, stripe, warpay
  provider_invoice_id TEXT,               -- ID no provider externo
  audio_url TEXT,                         -- URL do TTS no Bunny CDN
  played_in_overlay BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_donations_user_id ON donations(user_id);
CREATE INDEX idx_donations_status ON donations(status);
```

### 4.3 Tabela `webhook_events` (Idempotência)
```sql
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,                    -- Event ID do provider
  provider TEXT NOT NULL,                 -- stripe, coinsnap, openpix
  event_type TEXT,
  data JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Fase 5: Implementação dos Componentes

### 5.1 Página de Doação (`/[username]`)

```tsx
// src/app/(public)/[username]/page.tsx
import { DonationForm } from "@/components/donate/DonationForm";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function DonatePage({ params }: { params: { username: string } }) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-[#0b0b0f] flex items-center justify-center p-6">
      <DonationForm username={params.username} />
    </div>
  );
}
```

### 5.2 Formulário de Doação

```tsx
// src/components/donate/DonationForm.tsx
"use client";

import { useState } from "react";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { CryptoPaymentModal } from "./CryptoPaymentModal";
import { PixPaymentModal } from "./PixPaymentModal";

interface Props {
  username: string;
}

type PaymentMethod = "pix" | "crypto" | "test";

export function DonationForm({ username }: Props) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [payerName, setPayerName] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePixPayment = async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          amount: parseFloat(amount.replace(",", ".")),
          message,
          payer_name: payerName || "Anônimo",
          asset: "PIX"
        })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      // Redirect to PIX checkout
      window.location.href = data.checkoutLink;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[#12121a] border border-[#1f1f2a] rounded-2xl p-7">
      <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent mb-6">
        Enviar doação para {username}
      </h1>

      {/* Form fields */}
      <div className="space-y-4">
        <Input label="Seu Nome (Opcional)" value={payerName} onChange={setPayerName} placeholder="Anônimo" />
        <Input label="Valor (BRL)" value={amount} onChange={setAmount} placeholder="10,00" />
        <Textarea label="Mensagem" value={message} onChange={setMessage} placeholder="Sua mensagem!" />
      </div>

      {/* Payment buttons */}
      <div className="mt-6 space-y-3">
        <Button onClick={handlePixPayment} variant="pix" loading={isLoading}>
          Pagar com Pix
        </Button>
        <Button onClick={() => setSelectedMethod("crypto")} variant="primary">
          Pagar com Cripto
        </Button>
        <Button onClick={handleTestDonation} variant="secondary">
          ★ Doação Teste ★
        </Button>
      </div>

      {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}

      {/* Modals */}
      <CryptoPaymentModal
        isOpen={selectedMethod === "crypto"}
        onClose={() => setSelectedMethod(null)}
        username={username}
        amount={amount}
        message={message}
        payerName={payerName}
      />
    </div>
  );
}
```

### 5.3 Client Coinsnap (Lightning)

```tsx
// src/lib/coinsnap.ts
// Copiar do wbtv: C:\Users\Pichau\wbtv\src\lib\coinsnap.ts
// ENVs necessárias:
// - COINSNAP_API_KEY
// - COINSNAP_STORE_ID
// - COINSNAP_WEBHOOK_SECRET
```

### 5.4 Client OpenPix (PIX)

```tsx
// src/lib/openpix.ts
// Copiar do wbtv: C:\Users\Pichau\wbtv\src\lib\openpix.ts
// ENVs necessárias:
// - OPENPIX_APP_ID
```

---

## Fase 6: API Routes

### 6.1 Webhook Coinsnap

```tsx
// src/app/api/webhooks/coinsnap/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateCoinsnapSignature } from "@/lib/coinsnap";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndUploadTTS } from "@/lib/tts";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-coinsnap-sig") || "";

  // 1. Validar assinatura HMAC
  if (!validateCoinsnapSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const supabase = createAdminClient();

  // 2. Idempotência
  const eventId = `coinsnap_${payload.invoiceId}_${payload.type}`;
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("id", eventId)
    .single();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  // 3. Processar apenas "Settled"
  if (payload.type === "Settled") {
    const { data: donation } = await supabase
      .from("donations")
      .select("*")
      .eq("provider_invoice_id", payload.invoiceId)
      .single();

    if (donation) {
      // Gerar TTS
      let audioUrl = null;
      try {
        const text = `${donation.donor_name} mandou R$ ${donation.amount_brl}: ${donation.message}`;
        const result = await generateAndUploadTTS(text, `tts-${donation.id}.mp3`);
        audioUrl = result.publicUrl;
      } catch (e) {
        console.error("TTS Error:", e);
      }

      // Atualizar doação
      await supabase
        .from("donations")
        .update({ status: "complete", audio_url: audioUrl })
        .eq("id", donation.id);
    }
  }

  // 4. Salvar evento para idempotência
  await supabase.from("webhook_events").insert({
    id: eventId,
    provider: "coinsnap",
    event_type: payload.type,
    data: payload
  });

  return NextResponse.json({ received: true });
}
```

### 6.2 Webhook OpenPix

```tsx
// src/app/api/webhooks/openpix/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateOpenPixSignature } from "@/lib/openpix";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndUploadTTS } from "@/lib/tts";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature") || "";

  // Validar assinatura (produção)
  if (process.env.NODE_ENV === "production") {
    if (!validateOpenPixSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody);
  const supabase = createAdminClient();

  // Processar apenas CHARGE_COMPLETED
  if (payload.event === "OPENPIX:CHARGE_COMPLETED") {
    const correlationID = payload.charge?.correlationID;

    const { data: donation } = await supabase
      .from("donations")
      .select("*")
      .eq("id", correlationID)
      .single();

    if (donation && donation.status !== "complete") {
      // Gerar TTS
      let audioUrl = null;
      try {
        const text = `${donation.donor_name} mandou R$ ${donation.amount_brl}: ${donation.message}`;
        const result = await generateAndUploadTTS(text, `tts-${donation.id}.mp3`);
        audioUrl = result.publicUrl;
      } catch (e) {
        console.error("TTS Error:", e);
      }

      await supabase
        .from("donations")
        .update({ status: "complete", audio_url: audioUrl })
        .eq("id", donation.id);
    }
  }

  return NextResponse.json({ received: true });
}
```

---

## Fase 7: Overlay para OBS

### 7.1 Página do Overlay

```tsx
// src/app/(public)/overlay/[username]/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertBox } from "@/components/overlay/AlertBox";

interface Donation {
  id: string;
  donor_name: string;
  amount_brl: number;
  message: string;
  audio_url?: string;
}

export default function OverlayPage({ params }: { params: { username: string } }) {
  const [queue, setQueue] = useState<Donation[]>([]);
  const [currentAlert, setCurrentAlert] = useState<Donation | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const supabase = createClient();

  useEffect(() => {
    // Buscar profile ID
    const init = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", params.username)
        .single();

      if (!profile) return;

      // Subscribe to realtime
      const channel = supabase
        .channel(`donations-overlay-${profile.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "donations", filter: `user_id=eq.${profile.id}` },
          (payload) => {
            const d = payload.new as Donation & { status: string; played_in_overlay: boolean };
            if (d.status === "complete" && !d.played_in_overlay) {
              setQueue(prev => [...prev, d]);
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    init();
  }, [params.username]);

  // Process queue
  useEffect(() => {
    if (currentAlert || queue.length === 0) return;

    const next = queue[0];
    setQueue(prev => prev.slice(1));
    setCurrentAlert(next);

    // Play audio or timeout
    if (next.audio_url && audioRef.current) {
      audioRef.current.src = next.audio_url;
      audioRef.current.play();
    } else {
      setTimeout(() => finishAlert(next.id), 6000);
    }
  }, [queue, currentAlert]);

  const finishAlert = async (id: string) => {
    await supabase.from("donations").update({ played_in_overlay: true }).eq("id", id);
    setCurrentAlert(null);
  };

  return (
    <div className="min-h-screen bg-transparent">
      {currentAlert && (
        <AlertBox
          donorName={currentAlert.donor_name}
          amount={currentAlert.amount_brl}
          message={currentAlert.message}
        />
      )}
      <audio
        ref={audioRef}
        onEnded={() => currentAlert && finishAlert(currentAlert.id)}
      />
    </div>
  );
}
```

---

## Fase 8: Dashboard do Streamer

### 8.1 Páginas Protegidas

```tsx
// src/app/(dashboard)/layout.tsx
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  if (!userId) redirect("/login");

  return (
    <div className="min-h-screen bg-[#0b0b0f] grid grid-cols-[240px_1fr]">
      <Sidebar />
      <main className="p-6">{children}</main>
    </div>
  );
}
```

### 8.2 Dashboard Principal

```tsx
// src/app/(dashboard)/panel/page.tsx
import { StatsCards } from "@/components/dashboard/StatsCards";
import { DonationsList } from "@/components/dashboard/DonationsList";

export default function PanelPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-violet-600 bg-clip-text text-transparent mb-6">
        Dashboard
      </h1>
      <StatsCards />
      <DonationsList />
    </div>
  );
}
```

---

## Fase 9: Fluxo de Pagamentos

### 9.1 PIX (OpenPix)
1. Usuário submete formulário com `asset: "PIX"`
2. Backend cria charge no OpenPix com correlationID
3. Insere donation com status `pending`
4. Redireciona para `paymentLinkUrl` do OpenPix
5. OpenPix envia webhook `OPENPIX:CHARGE_COMPLETED`
6. Backend atualiza donation para `complete` e gera TTS
7. Overlay recebe via Supabase Realtime e exibe alerta

### 9.2 Lightning (Coinsnap)
1. Usuário seleciona "Pagar com Cripto" → "Bitcoin Lightning"
2. Backend converte BRL → USD via AwesomeAPI
3. Cria invoice no Coinsnap com amount em USD
4. Insere donation com status `pending`
5. Exibe QR Code com BOLT11 invoice
6. Usuário paga com Lightning Wallet
7. Coinsnap envia webhook "Settled"
8. Backend atualiza donation e gera TTS
9. Overlay exibe alerta

### 9.3 Cripto On-Chain (WarPay Legacy)
1. Manter integração existente com WarPay para BTC, ETH, USDT on-chain
2. Usar o monitor.js para polling de status

---

## Fase 10: Deploy

### 10.1 Vercel
```bash
vercel deploy --prod
```

### 10.2 Variáveis no Vercel
Configurar todas as ENVs listadas na Fase 2

### 10.3 Webhooks
- Stripe: `https://livecripto.net/api/webhooks/stripe`
- Coinsnap: `https://livecripto.net/api/webhooks/coinsnap`
- OpenPix: `https://livecripto.net/api/webhooks/openpix`

---

## Resumo de ENVs Necessárias

| Categoria | Variável | Origem |
|-----------|----------|--------|
| **App** | `NEXT_PUBLIC_BASE_URL` | livecripto |
| **Clerk** | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | livecripto |
| **Clerk** | `CLERK_SECRET_KEY` | livecripto |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL` | livecripto |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | livecripto |
| **Supabase** | `SUPABASE_SERVICE_ROLE_KEY` | livecripto |
| **Stripe** | `STRIPE_SECRET_KEY` | wbtv |
| **Stripe** | `STRIPE_WEBHOOK_SECRET` | wbtv |
| **Coinsnap** | `COINSNAP_API_KEY` | wbtv |
| **Coinsnap** | `COINSNAP_STORE_ID` | wbtv |
| **Coinsnap** | `COINSNAP_WEBHOOK_SECRET` | wbtv |
| **OpenPix** | `OPENPIX_APP_ID` | wbtv |
| **Bunny** | `BUNNY_STORAGE_HOST` | livecripto |
| **Bunny** | `BUNNY_STORAGE_ZONE_NAME` | livecripto |
| **Bunny** | `BUNNY_STORAGE_KEY` | livecripto |
| **Bunny** | `BUNNY_CDN_HOST` | livecripto |
