# Prompt: Criar Libraries de Pagamento

## Objetivo
Criar os clients de pagamento (Coinsnap, OpenPix) baseados no wbtv.

## Instruções

### 1. Criar `src/lib/coinsnap.ts`

Copiar e adaptar de `C:\Users\Pichau\wbtv\src\lib\coinsnap.ts`:

```typescript
/**
 * Coinsnap API Client - Lightning Network Payments
 */

const COINSNAP_API_URL = "https://app.coinsnap.io/api/v1";

export type CoinsnapInvoiceStatus =
  | "New" | "Processing" | "Settled" | "Expired" | "Invalid";

export interface CreateCoinsnapInvoiceParams {
  amount: number;
  currency: "EUR" | "USD" | "SATS" | "BTC";
  orderId?: string;
  buyerEmail?: string;
  redirectUrl?: string;
  redirectAutomatically?: boolean;
  metadata?: Record<string, string>;
}

export interface CoinsnapInvoice {
  id: string;
  storeId: string;
  amount: string;
  currency: string;
  status: CoinsnapInvoiceStatus;
  checkoutLink: string;
  createdAt: string;
  expiresAt?: string;
  lightningInvoice?: string;
  onchainAddress?: string;
  metadata?: Record<string, string>;
}

class CoinsnapClient {
  private apiKey: string;
  private storeId: string;

  constructor() {
    this.apiKey = process.env.COINSNAP_API_KEY || "";
    this.storeId = process.env.COINSNAP_STORE_ID || "";
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${COINSNAP_API_URL}${endpoint}`, {
      ...options,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Coinsnap API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async createInvoice(params: CreateCoinsnapInvoiceParams): Promise<CoinsnapInvoice> {
    return this.request(`/stores/${this.storeId}/invoices`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getInvoice(invoiceId: string): Promise<CoinsnapInvoice> {
    return this.request(`/stores/${this.storeId}/invoices/${invoiceId}`);
  }
}

export const coinsnap = new CoinsnapClient();

export function validateCoinsnapSignature(payload: string, signature: string): boolean {
  const crypto = require("crypto");
  const webhookSecret = process.env.COINSNAP_WEBHOOK_SECRET || "";
  const hmac = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
  return hmac === signature;
}

// Conversão BRL → USD
export async function convertBrlToUsd(amountBrl: number): Promise<number> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
    const data = await res.json();
    const rate = parseFloat(data.USDBRL.bid);

    if (rate < 4 || rate > 10) return amountBrl / 6.0; // Fallback

    return Math.round((amountBrl / rate) * 100) / 100;
  } catch {
    return Math.round((amountBrl / 6.0) * 100) / 100; // Fallback
  }
}
```

### 2. Criar `src/lib/openpix.ts`

Copiar e adaptar de `C:\Users\Pichau\wbtv\src\lib\openpix.ts`:

```typescript
/**
 * OpenPix/Woovi API Client - PIX Payments
 */

import crypto from "crypto";

const OPENPIX_API_URL = "https://api.openpix.com.br/api/v1";

const OPENPIX_PUBLIC_KEY_BASE64 = "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlHZk1BMEdDU3FHU0liM0RRRUJBUVVBQTRHTkFEQ0JpUUtCZ1FDLytOdElranpldnZxRCtJM01NdjNiTFhEdApwdnhCalk0QnNSclNkY2EzcnRBd01jUllZdnhTbmQ3amFnVkxwY3RNaU94UU84aWVVQ0tMU1dIcHNNQWpPL3paCldNS2Jxb0c4TU5waS91M2ZwNnp6MG1jSENPU3FZc1BVVUcxOWJ1VzhiaXM1WloySVpnQk9iV1NwVHZKMGNuajYKSEtCQUE4MkpsbitsR3dTMU13SURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo=";

export type OpenPixChargeStatus = "ACTIVE" | "COMPLETED" | "EXPIRED";

export interface CreateOpenPixChargeParams {
  value: number;              // Valor em CENTAVOS
  correlationID: string;
  comment?: string;
  expiresIn?: number;
}

export interface OpenPixCharge {
  charge: {
    status: OpenPixChargeStatus;
    value: number;
    correlationID: string;
    paymentLinkUrl: string;
    qrCodeImage: string;
    brCode: string;
  };
}

class OpenPixClient {
  private appId: string;

  constructor() {
    this.appId = process.env.OPENPIX_APP_ID || "";
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${OPENPIX_API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": this.appId,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenPix API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async createCharge(params: CreateOpenPixChargeParams): Promise<OpenPixCharge> {
    return this.request("/charge", {
      method: "POST",
      body: JSON.stringify({
        ...params,
        expiresIn: params.expiresIn || 86400,
      }),
    });
  }

  async getCharge(correlationID: string): Promise<OpenPixCharge> {
    return this.request(`/charge/${correlationID}`);
  }
}

export const openpix = new OpenPixClient();

export function validateOpenPixSignature(payload: string, signature: string): boolean {
  try {
    const publicKey = Buffer.from(OPENPIX_PUBLIC_KEY_BASE64, "base64").toString("utf-8");
    const verify = crypto.createVerify("sha256WithRSAEncryption");
    verify.update(payload);
    verify.end();
    return verify.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}

export function generateCorrelationID(prefix = "livecripto"): string {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().split("-")[0]}`;
}
```

### 3. Criar `src/lib/tts.ts`

Adaptar de `C:\Users\Pichau\livecripto\livecripto\src\services\tts.js`:

```typescript
/**
 * TTS Service - Google TTS + Bunny CDN Upload
 */

import https from "https";

const GOOGLE_TTS_URL = "https://translate.google.com/translate_tts";

export async function generateAndUploadTTS(text: string, filename: string): Promise<{ publicUrl: string }> {
  // 1. Gerar áudio do Google TTS
  const ttsUrl = `${GOOGLE_TTS_URL}?ie=UTF-8&q=${encodeURIComponent(text)}&tl=pt&client=tw-ob`;

  const audioBuffer = await fetch(ttsUrl).then(r => r.arrayBuffer()).then(Buffer.from);

  // 2. Upload para Bunny CDN
  const HOSTNAME = process.env.BUNNY_STORAGE_HOST || "br.storage.bunnycdn.com";
  const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME!;
  const ACCESS_KEY = process.env.BUNNY_STORAGE_KEY!;
  const CDN_HOST = process.env.BUNNY_CDN_HOST!;

  const remotePath = `/${STORAGE_ZONE}/tts/${filename}`;

  await new Promise<void>((resolve, reject) => {
    const req = https.request({
      method: "PUT",
      host: HOSTNAME,
      path: remotePath,
      headers: {
        AccessKey: ACCESS_KEY,
        "Content-Type": "application/octet-stream",
        "Content-Length": audioBuffer.length,
      },
    }, (res) => {
      if (res.statusCode! >= 200 && res.statusCode! < 300) {
        resolve();
      } else {
        reject(new Error(`Bunny upload failed: ${res.statusCode}`));
      }
    });
    req.on("error", reject);
    req.write(audioBuffer);
    req.end();
  });

  return { publicUrl: `https://${CDN_HOST}/tts/${encodeURIComponent(filename)}` };
}
```

## Output Esperado
- `src/lib/coinsnap.ts` funcionando
- `src/lib/openpix.ts` funcionando
- `src/lib/tts.ts` funcionando
