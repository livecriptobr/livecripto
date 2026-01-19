<objective>
FASE 3: Integração de Pagamentos (OpenPix, Coinsnap, MercadoPago)

Purpose: Implementar os três métodos de pagamento com webhooks seguros e idempotentes
Output: Fluxo completo de pagamento real para PIX, Lightning e Cartão
</objective>

<context>
Depende de: @.prompts/002-livecripto-rebuild/002-02-donation-page.md (Fase 2 completa)
API /api/public/donate/init já existe (mock)
Model Donation e WebhookEvent já existem no Prisma
</context>

<requirements>
1. OpenPix (PIX):
   - Criar charge com expiração (15 min)
   - Retornar QR code (base64), copia-e-cola, chargeId
   - Webhook recebe OPENPIX:CHARGE_COMPLETED
   - Validar assinatura (x-webhook-signature)

2. Coinsnap (Lightning):
   - Criar invoice em USD (converter BRL → USD)
   - Retornar BOLT11 invoice, QR code
   - Webhook recebe evento "Settled"
   - Validar assinatura HMAC

3. MercadoPago (Cartão):
   - Criar checkout preference
   - Redirecionar para checkout MP
   - Webhook payment.created / payment.updated
   - Consultar payment para confirmar status

4. Idempotência (CRÍTICO):
   - Tabela WebhookEvent com eventKey único
   - Antes de processar: verificar se já processado
   - Se já existe: retornar 200 OK sem reprocessar
   - Salvar hash do payload para auditoria

5. Fluxo comum após PAID:
   a) Atualizar Donation.status = PAID, paidAt = now()
   b) Criar Ledger entry (CREDIT, source=DONATION)
   c) Criar Alert com status QUEUED
   d) Disparar TTS build (será implementado na Fase 5)

6. Polling de status:
   - GET /api/public/donate/status?provider=...&id=...
   - Retornar status atual do banco
   - Rate limit: 1 req/seg por id
</requirements>

<implementation>
OpenPix client:
```typescript
// src/lib/payments/openpix.ts
const OPENPIX_URL = 'https://api.openpix.com.br/api/v1';

export async function createPixCharge(params: {
  correlationID: string; // donation.id
  value: number; // centavos
  comment?: string;
  expiresIn?: number; // segundos, default 900 (15min)
}) {
  const response = await fetch(`${OPENPIX_URL}/charge`, {
    method: 'POST',
    headers: {
      Authorization: process.env.OPENPIX_APP_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      correlationID: params.correlationID,
      value: params.value,
      comment: params.comment,
      expiresIn: params.expiresIn || 900,
    }),
  });

  const data = await response.json();
  return {
    chargeId: data.charge.correlationID,
    qrCode: data.charge.qrCodeImage, // base64
    copyPaste: data.charge.brCode,
    expiresAt: data.charge.expiresDate,
  };
}

export function validateOpenPixSignature(
  payload: string,
  signature: string
): boolean {
  // HMAC-SHA256 usando OPENPIX_WEBHOOK_SECRET
}
```

Coinsnap client:
```typescript
// src/lib/payments/coinsnap.ts
const COINSNAP_URL = 'https://app.coinsnap.io/api/v1';

export async function createLightningInvoice(params: {
  storeId: string;
  amount: number; // USD cents
  currency: 'USD';
  orderId: string; // donation.id
  metadata?: Record<string, string>;
}) {
  const response = await fetch(
    `${COINSNAP_URL}/stores/${params.storeId}/invoices`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${process.env.COINSNAP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount / 100, // USD dollars
        currency: 'USD',
        orderId: params.orderId,
        metadata: params.metadata,
      }),
    }
  );

  const data = await response.json();
  return {
    invoiceId: data.id,
    bolt11: data.lightning,
    qrCode: data.qrCodeData, // ou gerar do bolt11
    expiresAt: data.expirationTime,
  };
}

export async function convertBrlToUsd(brlCents: number): Promise<number> {
  // Usar AwesomeAPI ou similar
  const response = await fetch(
    'https://economia.awesomeapi.com.br/json/last/USD-BRL'
  );
  const data = await response.json();
  const rate = parseFloat(data.USDBRL.bid);
  return Math.round((brlCents / 100) / rate * 100); // USD cents
}
```

MercadoPago client:
```typescript
// src/lib/payments/mercadopago.ts
import MercadoPago from 'mercadopago';

export async function createCheckoutPreference(params: {
  donationId: string;
  title: string;
  amountBrl: number; // reais (ex: 10.50)
  payerEmail?: string;
}) {
  const mp = new MercadoPago({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });

  const preference = await mp.preferences.create({
    body: {
      items: [{
        id: params.donationId,
        title: params.title,
        quantity: 1,
        unit_price: params.amountBrl,
        currency_id: 'BRL',
      }],
      external_reference: params.donationId,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/return?status=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/return?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/return?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
    },
  });

  return {
    preferenceId: preference.id,
    redirectUrl: preference.init_point,
  };
}
```

Webhooks com idempotência:
```typescript
// src/lib/webhook-idempotency.ts
export async function processWebhookOnce(
  provider: string,
  eventKey: string,
  payload: any,
  handler: () => Promise<void>
): Promise<{ alreadyProcessed: boolean }> {
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

  // Tentar inserir - falha se já existe (unique constraint)
  try {
    await prisma.webhookEvent.create({
      data: {
        id: `${provider}_${eventKey}`,
        provider,
        eventKey,
        payloadHash,
        status: 'PROCESSING',
        receivedAt: new Date(),
      },
    });
  } catch (e) {
    // Já existe, foi processado
    return { alreadyProcessed: true };
  }

  try {
    await handler();
    await prisma.webhookEvent.update({
      where: { id: `${provider}_${eventKey}` },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
    return { alreadyProcessed: false };
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: `${provider}_${eventKey}` },
      data: { status: 'FAILED', error: String(error) },
    });
    throw error;
  }
}
```

Webhook OpenPix:
```typescript
// src/app/api/webhooks/openpix/route.ts
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-webhook-signature') || '';

  if (!validateOpenPixSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event !== 'OPENPIX:CHARGE_COMPLETED') {
    return NextResponse.json({ received: true });
  }

  const eventKey = payload.charge.correlationID;

  const result = await processWebhookOnce('openpix', eventKey, payload, async () => {
    await handleDonationPaid(payload.charge.correlationID);
  });

  return NextResponse.json({ received: true });
}
```

Handler comum de pagamento confirmado:
```typescript
// src/services/donation.service.ts
export async function handleDonationPaid(donationId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. Atualizar Donation
    const donation = await tx.donation.update({
      where: { id: donationId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    // 2. Criar Ledger entry
    await tx.ledger.create({
      data: {
        userId: donation.userId,
        type: 'CREDIT',
        source: 'DONATION',
        amountCents: donation.amountCents,
        referenceId: donation.id,
      },
    });

    // 3. Criar Alert
    await tx.alert.create({
      data: {
        userId: donation.userId,
        donationId: donation.id,
        status: 'QUEUED',
      },
    });
  });

  // 4. Disparar TTS build (async, será implementado na Fase 5)
  // await queueTTSBuild(donationId);
}
```
</implementation>

<output>
Criar/modificar arquivos:
- src/lib/payments/openpix.ts
- src/lib/payments/coinsnap.ts
- src/lib/payments/mercadopago.ts
- src/lib/payments/currency.ts (conversão BRL → USD)
- src/lib/webhook-idempotency.ts
- src/app/api/webhooks/openpix/route.ts
- src/app/api/webhooks/coinsnap/route.ts
- src/app/api/webhooks/mercadopago/route.ts
- src/app/api/public/donate/init/route.ts (atualizar com providers reais)
- src/app/api/public/donate/status/route.ts (atualizar)
- src/app/checkout/return/page.tsx (retorno do MercadoPago)
- src/services/donation.service.ts (handlers)
- src/components/donate/PixPayment.tsx (atualizar com QR real)
- src/components/donate/LightningPayment.tsx (atualizar com invoice real)
</output>

<verification>
1. OpenPix: criar charge e receber webhook funciona
2. Coinsnap: criar invoice e receber webhook funciona
3. MercadoPago: redirect para checkout e webhook funciona
4. Idempotência: mesmo webhook 2x não processa 2x
5. Donation atualiza para PAID corretamente
6. Ledger entry criada
7. Alert criado com status QUEUED
8. Polling de status retorna estado correto
9. Assinaturas de webhook validadas
</verification>

<summary_requirements>
Criar `.prompts/002-livecripto-rebuild/SUMMARY-03.md`

Incluir:
- One-liner sobre integração de pagamentos
- Arquivos criados
- Próximo passo: Executar Fase 4 (Alerts + Overlay OBS)
</summary_requirements>

<success_criteria>
- Três providers de pagamento funcionando
- Webhooks com verificação de assinatura
- Idempotência garantida
- Fluxo Donation → Ledger → Alert funcional
- Polling de status funcional
- SUMMARY-03.md criado
</success_criteria>
