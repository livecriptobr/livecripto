# Prompt: Criar API Routes

## Objetivo
Criar todas as API routes do backend.

## Instruções

### 1. `src/app/api/config/route.ts`

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
```

### 2. `src/app/api/donate/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { openpix, generateCorrelationID } from "@/lib/openpix";
import { coinsnap, convertBrlToUsd } from "@/lib/coinsnap";

export async function POST(req: NextRequest) {
  try {
    const { username, amount, message, payer_name, asset, chain } = await req.json();

    if (!username || !amount) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Buscar profile do streamer
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, warpay_apikey")
      .eq("username", username)
      .single();

    if (!profile) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const amountBRL = parseFloat(amount) || 0;

    // PIX via OpenPix
    if (asset === "PIX") {
      const correlationID = generateCorrelationID();
      const valueInCents = Math.round(amountBRL * 100);

      const charge = await openpix.createCharge({
        value: valueInCents,
        correlationID,
        comment: message || "Doação via LiveCripto",
      });

      await supabase.from("donations").insert({
        id: correlationID,
        user_id: profile.id,
        username: profile.username,
        donor_name: payer_name || "Anônimo",
        message: message || "",
        amount_brl: amountBRL,
        status: "pending",
        crypto_currency: "PIX",
        payment_provider: "openpix",
      });

      return NextResponse.json({ ok: true, checkoutLink: charge.charge.paymentLinkUrl });
    }

    // Lightning via Coinsnap
    if (asset === "BTC" && chain === "lightning") {
      const amountUSD = await convertBrlToUsd(amountBRL);
      const orderId = `livecripto_${Date.now()}`;

      const invoice = await coinsnap.createInvoice({
        amount: amountUSD,
        currency: "USD",
        orderId,
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/${username}?status=success`,
        metadata: {
          username,
          donor_name: payer_name || "Anônimo",
          message: message || "",
          amount_brl: amountBRL.toString(),
        },
      });

      await supabase.from("donations").insert({
        id: orderId,
        user_id: profile.id,
        username: profile.username,
        donor_name: payer_name || "Anônimo",
        message: message || "",
        amount_brl: amountBRL,
        status: "pending",
        crypto_currency: "BTC-LN",
        payment_provider: "coinsnap",
        provider_invoice_id: invoice.id,
      });

      return NextResponse.json({
        ok: true,
        checkoutLink: invoice.checkoutLink,
        lightningInvoice: invoice.lightningInvoice,
      });
    }

    // Outras criptos via WarPay (legacy)
    if (!profile.warpay_apikey) {
      return NextResponse.json({ ok: false, error: "Streamer has not configured WarPay" }, { status: 400 });
    }

    // Chamar WarPay API (manter lógica existente)
    const warpayRes = await fetch(`${process.env.WARPAY_API_URL}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${profile.warpay_apikey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset,
        chain,
        amount_crypto: amountBRL, // WarPay faz a conversão
        metadata: {
          livecripto_user_id: profile.id,
          livecripto_username: profile.username,
          message: message || "",
          donor_name: payer_name || "Anônimo",
        },
      }),
    });

    const warpayData = await warpayRes.json();

    await supabase.from("donations").insert({
      id: warpayData.id,
      user_id: profile.id,
      username: profile.username,
      donor_name: payer_name || "Anônimo",
      message: message || "",
      amount_brl: amountBRL,
      status: "pending",
      crypto_currency: asset,
      payment_provider: "warpay",
    });

    return NextResponse.json({ ok: true, checkoutLink: warpayData.payment_url });

  } catch (e: any) {
    console.error("Donate Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
```

### 3. `src/app/api/donate/test/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndUploadTTS } from "@/lib/tts";

export async function POST(req: NextRequest) {
  try {
    const { username, amount, message, payer_name } = await req.json();

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();

    if (!profile) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const invoiceId = `test_${Date.now()}`;
    const amountBRL = parseFloat(amount) || 1;

    // Inserir doação de teste
    const { data: donation } = await supabase
      .from("donations")
      .insert({
        id: invoiceId,
        user_id: profile.id,
        donor_name: payer_name || "Teste",
        message: message || "Doação de teste",
        amount_brl: amountBRL,
        status: "pending",
        crypto_currency: "TEST",
        payment_provider: "test",
      })
      .select()
      .single();

    // Gerar TTS
    let audioUrl = null;
    try {
      const nome = payer_name || "Teste";
      const valor = amountBRL.toFixed(2).replace(".", ",");
      const ttsText = `${nome} mandou R$ ${valor}: ${message || "Doação de teste"}`;

      const result = await generateAndUploadTTS(ttsText, `tts-${invoiceId}.mp3`);
      audioUrl = result.publicUrl;
    } catch (e) {
      console.error("TTS Error:", e);
    }

    // Atualizar para complete
    await supabase
      .from("donations")
      .update({ status: "complete", audio_url: audioUrl })
      .eq("id", invoiceId);

    return NextResponse.json({ ok: true, donation: { ...donation, status: "complete", audio_url: audioUrl } });

  } catch (e: any) {
    console.error("Test Donate Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
```

### 4. `src/app/api/webhooks/openpix/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateOpenPixSignature } from "@/lib/openpix";
import { generateAndUploadTTS } from "@/lib/tts";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature") || "";

  // Validar assinatura em produção
  if (process.env.NODE_ENV === "production") {
    if (!validateOpenPixSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(rawBody);
  const supabase = createAdminClient();

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

### 5. `src/app/api/webhooks/coinsnap/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCoinsnapSignature } from "@/lib/coinsnap";
import { generateAndUploadTTS } from "@/lib/tts";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-coinsnap-sig") || "";

  if (!validateCoinsnapSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const supabase = createAdminClient();

  // Idempotência
  const eventId = `coinsnap_${payload.invoiceId}_${payload.type}`;
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("id", eventId)
    .single();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  if (payload.type === "Settled") {
    const { data: donation } = await supabase
      .from("donations")
      .select("*")
      .eq("provider_invoice_id", payload.invoiceId)
      .single();

    if (donation && donation.status !== "complete") {
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

  // Salvar evento
  await supabase.from("webhook_events").insert({
    id: eventId,
    provider: "coinsnap",
    event_type: payload.type,
    data: payload,
  });

  return NextResponse.json({ received: true });
}
```

### 6. `src/app/api/stats/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const days = 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: donations } = await supabase
    .from("donations")
    .select("created_at, amount_brl")
    .eq("user_id", userId)
    .eq("status", "complete")
    .gte("created_at", startDate.toISOString());

  const totalMsgs = donations?.length || 0;
  const totalVal = donations?.reduce((acc, cur) => acc + (cur.amount_brl || 0), 0) || 0;

  return NextResponse.json({ ok: true, messages: totalMsgs, amountBRL: totalVal });
}
```

### 7. `src/app/api/overlays/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") || "";

  return NextResponse.json({
    ok: true,
    overlays: {
      overlay: `${base}/overlay/${profile.username}`,
      donorPage: `${base}/${profile.username}`,
    },
  });
}
```

### 8. `src/app/api/wallet/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data } = await supabase
    .from("profiles")
    .select("warpay_apikey")
    .eq("id", userId)
    .single();

  return NextResponse.json({ ok: true, warpay_apikey: data?.warpay_apikey || "" });
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { warpay_apikey } = await req.json();

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("profiles")
    .update({ warpay_apikey })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

## Output Esperado
- Todas as API routes funcionando
- Webhooks configurados para OpenPix e Coinsnap
