# Phase 5 — Complete Wallet System

## Context

LivePix has a comprehensive wallet: full history with date, transaction ID, value, fee, running balance; receivables (pending card payments); withdrawals list with status tracking; daily/monthly limits; and CSV export. LiveCripto currently has a basic history page at `src/app/(dashboard)/dashboard/history/page.tsx` and a payouts page at `src/app/(dashboard)/dashboard/payouts/page.tsx` with simple listings. There is no fee tracking, running balance, receivables view, limits display, or CSV export.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), OpenPix (PIX), MercadoPago (Card).

## Objective

Build a complete wallet system with detailed transaction history, fee calculations, running balances, receivables tracking, withdrawal management, configurable limits, and data export.

## Tasks

### 1. Schema Updates

Add to `prisma/schema.prisma`:

```prisma
model Transaction {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type            String   // "donation_received" | "withdrawal" | "fee" | "refund" | "adjustment"
  status          String   @default("completed") // "pending" | "completed" | "failed" | "cancelled"
  amountCents     Int      // gross amount
  feeCents        Int      @default(0)
  netCents        Int      // amountCents - feeCents
  balanceCents    Int      // running balance AFTER this transaction
  description     String?
  referenceId     String?  // donationId or withdrawalId
  referenceType   String?  // "donation" | "withdrawal"
  paymentMethod   String?  // "pix" | "card" | "crypto" | "lightning"
  metadata        Json?
  createdAt       DateTime @default(now())

  @@index([userId])
  @@index([userId, createdAt])
  @@index([userId, type])
}

model Withdrawal {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  amountCents     Int
  feeCents        Int       @default(0)
  netCents        Int
  status          String    @default("pending") // "pending" | "processing" | "completed" | "failed" | "cancelled"
  pixKeyType      String    // "cpf" | "cnpj" | "email" | "phone" | "random"
  pixKey          String
  bankInfo        Json?
  processedAt     DateTime?
  failureReason   String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
  @@index([userId, status])
}

model Receivable {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  donationId      String
  amountCents     Int
  feeCents        Int       @default(0)
  netCents        Int
  status          String    @default("pending") // "pending" | "available" | "settled"
  expectedDate    DateTime
  settledAt       DateTime?
  paymentMethod   String    // "card"
  createdAt       DateTime  @default(now())

  @@index([userId])
  @@index([userId, status])
}

model WalletLimits {
  id                   String @id @default(cuid())
  userId               String @unique
  user                 User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  dailyWithdrawLimit   Int    @default(500000)  // R$5.000,00
  monthlyWithdrawLimit Int    @default(5000000) // R$50.000,00
  minWithdrawAmount    Int    @default(1000)    // R$10,00
}

model BankAccount {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  pixKeyType String   // "cpf" | "cnpj" | "email" | "phone" | "random"
  pixKey     String
  label      String?  // "Pessoal", "Empresa"
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@index([userId])
}
```

Run `npx prisma migrate dev --name add_wallet_system`.

### 2. Fee Calculation Service

Create `src/services/fees.ts`:

```typescript
export interface FeeCalculation {
  grossCents: number;
  feeCents: number;
  netCents: number;
  feePercentage: number;
}

const FEE_RATES: Record<string, number> = {
  pix: 0.0299,       // 2.99%
  card: 0.0499,      // 4.99%
  crypto: 0.0199,    // 1.99%
  lightning: 0.0149, // 1.49%
};

export function calculateFee(amountCents: number, paymentMethod: string): FeeCalculation {
  const rate = FEE_RATES[paymentMethod] ?? 0.0299;
  const feeCents = Math.round(amountCents * rate);
  return {
    grossCents: amountCents,
    feeCents,
    netCents: amountCents - feeCents,
    feePercentage: rate * 100,
  };
}
```

### 3. Transaction Ledger Service

Create `src/services/wallet.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { calculateFee } from './fees';

export async function recordTransaction(data: {
  userId: string;
  type: 'donation_received' | 'withdrawal' | 'fee' | 'refund' | 'adjustment';
  amountCents: number;
  feeCents?: number;
  description?: string;
  referenceId?: string;
  referenceType?: string;
  paymentMethod?: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Get current balance from last transaction
    const lastTx = await tx.transaction.findFirst({
      where: { userId: data.userId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { balanceCents: true },
    });

    const currentBalance = lastTx?.balanceCents ?? 0;
    const feeCents = data.feeCents ?? 0;
    const netCents = data.amountCents - feeCents;

    // Credits increase balance, debits decrease
    const isCredit = ['donation_received', 'refund', 'adjustment'].includes(data.type);
    const balanceChange = isCredit ? netCents : -data.amountCents;
    const newBalance = currentBalance + balanceChange;

    return tx.transaction.create({
      data: {
        userId: data.userId,
        type: data.type,
        amountCents: data.amountCents,
        feeCents,
        netCents,
        balanceCents: newBalance,
        description: data.description,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
        paymentMethod: data.paymentMethod,
      },
    });
  });
}

export async function getBalance(userId: string): Promise<number> {
  const lastTx = await prisma.transaction.findFirst({
    where: { userId, status: 'completed' },
    orderBy: { createdAt: 'desc' },
    select: { balanceCents: true },
  });
  return lastTx?.balanceCents ?? 0;
}

export async function getDailyWithdrawn(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const result = await prisma.withdrawal.aggregate({
    where: { userId, status: { in: ['pending', 'processing', 'completed'] }, createdAt: { gte: startOfDay } },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}

export async function getMonthlyWithdrawn(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const result = await prisma.withdrawal.aggregate({
    where: { userId, status: { in: ['pending', 'processing', 'completed'] }, createdAt: { gte: startOfMonth } },
    _sum: { amountCents: true },
  });
  return result._sum.amountCents ?? 0;
}
```

**Integration point**: In the donation confirmation webhook (when payment is confirmed), call:
```typescript
const fee = calculateFee(donation.amountCents, donation.paymentMethod);
await recordTransaction({
  userId: donation.userId,
  type: 'donation_received',
  amountCents: donation.amountCents,
  feeCents: fee.feeCents,
  description: `Doação de ${donation.donorName}`,
  referenceId: donation.id,
  referenceType: 'donation',
  paymentMethod: donation.paymentMethod,
});
```

### 4. Enhanced History Page

Redesign `src/app/(dashboard)/dashboard/history/page.tsx`:

- **Summary bar** at top:
  - Total recebido (all time gross).
  - Total taxas (all time fees).
  - Total sacado (all time withdrawals).
  - Saldo atual (current balance) — prominently displayed.
- **Filters bar**: date range picker (start/end), type dropdown (all/donation/withdrawal/fee/refund), payment method dropdown (all/pix/card/crypto/lightning).
- **Table columns**:
  | Data/Hora | ID | Tipo | Descrição | Método | Bruto | Taxa | Líquido | Saldo |
  |---|---|---|---|---|---|---|---|---|
  - Date: formatted `dd/MM/yyyy HH:mm`.
  - ID: truncated cuid with copy-on-click tooltip.
  - Type: colored badge (green=donation, red=withdrawal, yellow=fee, blue=refund).
  - Description: donor name or withdrawal target.
  - Method: payment method icon.
  - Bruto/Taxa/Líquido: formatted as `R$ X,XX`. Green for credits, red for debits.
  - Saldo: running balance.
- **Pagination**: 20 per page, page numbers.
- **API**: `GET /api/wallet/history?page=1&limit=20&type=&method=&from=&to=`.

### 5. Receivables Page

Create `src/app/(dashboard)/dashboard/wallet/receivables/page.tsx`:

- **Summary cards**: Total pendente, Previsto esta semana, Previsto este mês.
- **Table**: Data, ID Doação, Valor, Taxa, Líquido, Data Prevista, Status (badge: pendente/disponível/liquidado).
- Only card payments generate receivables (PIX/crypto are instant).
- **API**: `GET /api/wallet/receivables?status=pending`.

When MercadoPago settles a card payment (via webhook), update receivable status to `"settled"` and record a transaction.

### 6. Withdrawals Page Redesign

Redesign `src/app/(dashboard)/dashboard/payouts/page.tsx`:

- **Request withdrawal section** (top card):
  - Amount input (min R$10, max = available balance).
  - Bank account selector dropdown (saved PIX keys). "Adicionar conta" link.
  - Fee preview (if any withdrawal fee exists).
  - "Solicitar Saque" button.
  - Confirmation modal: "Sacar R$ X,XX para PIX [key]? Taxa: R$ Y,YY. Valor líquido: R$ Z,ZZ."
- **Withdrawals list**:
  - Table: Data, Valor, Taxa, Líquido, Chave PIX (masked: `***@email.com`), Status, Data Processamento.
  - Status badges: Pendente (yellow), Processando (blue), Concluído (green), Falhou (red).
  - Expand row: failure reason if failed.

### 7. Limits Page

Create `src/app/(dashboard)/dashboard/wallet/limits/page.tsx`:

- **Daily limit card**: Progress bar, "R$ X de R$ Y utilizados hoje".
- **Monthly limit card**: Progress bar, "R$ X de R$ Y utilizados este mês".
- **Minimum withdrawal**: "Valor mínimo: R$ 10,00".
- **Note**: "Para aumentar seus limites, complete a verificação de identidade." (link to `/dashboard/settings/verifications`).
- API: `GET /api/wallet/limits` — returns limits + current usage.

### 8. CSV Export API

Create `src/app/api/wallet/export/route.ts`:

```typescript
export async function GET(req: Request) {
  // Auth check
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from'); // ISO date
  const to = searchParams.get('to');     // ISO date
  const type = searchParams.get('type'); // optional filter

  // Validate: max 1 year range, max 10000 rows
  // Fetch transactions
  // Generate CSV string:
  // "Data","ID","Tipo","Descrição","Método","Bruto (BRL)","Taxa (BRL)","Líquido (BRL)","Saldo (BRL)"
  // Format amounts as "10.50" (decimal, not cents)

  return new Response(csvString, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=historico-livecripto-${from}-${to}.csv`,
    },
  });
}
```

Add "Exportar CSV" button on history page that opens date range picker modal, then downloads.

### 9. Bank Account Management API

Create `src/app/api/bank-accounts/route.ts`:

- `GET` — list saved bank accounts for authenticated user.
- `POST { pixKeyType, pixKey, label? }` — add bank account.
  - Validate PIX key format:
    - `cpf`: 11 digits, valid CPF checksum.
    - `cnpj`: 14 digits, valid CNPJ checksum.
    - `email`: valid email format.
    - `phone`: `+55` followed by 10-11 digits.
    - `random`: UUID v4 format.
  - If first account, set as default.

Create `src/app/api/bank-accounts/[id]/route.ts`:

- `PATCH { isDefault: true }` — set as default (unset previous default).
- `DELETE` — remove bank account (cannot delete if it's the only one and has pending withdrawals).

### 10. Withdrawal Request API

Create `src/app/api/withdrawals/route.ts`:

- `GET` — list withdrawals for authenticated user, paginated.
- `POST { amountCents, bankAccountId }`:
  1. Validate `amountCents >= minWithdrawAmount`.
  2. Check `getBalance(userId) >= amountCents`.
  3. Check `getDailyWithdrawn(userId) + amountCents <= dailyWithdrawLimit`.
  4. Check `getMonthlyWithdrawn(userId) + amountCents <= monthlyWithdrawLimit`.
  5. Fetch bank account, verify ownership.
  6. In Prisma transaction: create `Withdrawal`, call `recordTransaction` with type `"withdrawal"`.
  7. Trigger PIX transfer via OpenPix API: `POST /api/openpix/transfer` (implement OpenPix payout integration).
  8. Return `{ withdrawalId, status: "pending" }`.

## Dependencies

- OpenPix API — for PIX payout transfers. Endpoint: `POST https://api.openpix.com.br/api/v1/transfer` (check OpenPix docs for payout API).
- MercadoPago webhook — for card payment settlement notifications.
- No new npm packages needed.

## Acceptance Criteria

- [ ] Transaction history displays date, ID, type, description, payment method, gross, fee, net, and running balance
- [ ] Fees are automatically calculated per payment method when donations are confirmed
- [ ] Running balance is maintained atomically across all transactions
- [ ] Receivables page shows pending card payment settlements with expected dates
- [ ] Streamer can save multiple PIX keys (CPF, CNPJ, email, phone, random) with format validation
- [ ] Streamer can request withdrawals to saved PIX keys with amount validation
- [ ] Withdrawals validate against daily limit, monthly limit, minimum amount, and available balance
- [ ] Withdrawal status tracks from pending through processing to completed/failed
- [ ] Limits page shows daily/monthly usage with visual progress bars
- [ ] CSV export generates downloadable file with filtered transaction history
- [ ] Current balance is prominently displayed on wallet pages
- [ ] All monetary values are stored in cents and displayed formatted as BRL (R$ X.XXX,XX)
