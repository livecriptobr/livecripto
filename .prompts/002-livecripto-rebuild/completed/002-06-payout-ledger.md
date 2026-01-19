<objective>
FASE 6: Payout Requests + Ledger

Purpose: Implementar sistema de saldo interno e solicitações de saque
Output: Dashboard com saldo, histórico e funcionalidade de solicitar saque
</objective>

<context>
Depende de: @.prompts/002-livecripto-rebuild/002-05-tts-bunny.md (Fase 5 completa)
Ledger entries são criadas quando doação é confirmada
User tem campos pixKey e lightningAddress
</context>

<requirements>
1. Ledger service:
   - Calcular saldo: SUM(CREDIT) - SUM(DEBIT) WHERE userId
   - Listar transações com paginação
   - Tipos: CREDIT (doação), DEBIT (saque), ADJUSTMENT (manual)

2. Withdraw request:
   - Criar solicitação com método (PIX ou Lightning)
   - Snapshot do destino no momento (pixKey ou lightningAddress)
   - Status: REQUESTED → PROCESSING → PAID/REJECTED
   - Validar saldo suficiente antes de criar
   - Criar Ledger DEBIT ao criar request (reserva)
   - Se rejeitado: criar CREDIT de estorno

3. Dashboard pages:
   - /dashboard/history: histórico de doações
   - /dashboard/payouts: configurar pixKey/lightningAddress + solicitar saque + histórico

4. APIs privadas:
   - GET /api/private/balance: retorna saldo atual
   - GET /api/private/ledger: lista transações
   - GET /api/private/donations: lista doações
   - POST /api/private/payout-settings: atualizar pixKey/lightningAddress
   - POST /api/private/withdraw: criar solicitação de saque
   - GET /api/private/withdraws: listar solicitações

5. Validações:
   - Saldo >= valor solicitado
   - Valor mínimo de saque (ex: R$ 10,00)
   - Destino deve estar configurado
   - Rate limit: 1 saque por hora
</requirements>

<implementation>
Ledger service:
```typescript
// src/services/ledger.service.ts
import { prisma } from '@/lib/db';

export const ledgerService = {
  async getBalance(userId: string): Promise<number> {
    const result = await prisma.ledger.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amountCents: true },
    });

    const credits = result.find(r => r.type === 'CREDIT')?._sum.amountCents || 0;
    const debits = result.find(r => r.type === 'DEBIT')?._sum.amountCents || 0;

    return credits - debits;
  },

  async getTransactions(
    userId: string,
    options: { limit?: number; offset?: number }
  ) {
    return prisma.ledger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });
  },

  async createCredit(params: {
    userId: string;
    amountCents: number;
    source: 'DONATION' | 'ADJUSTMENT';
    referenceId: string;
  }) {
    return prisma.ledger.create({
      data: {
        userId: params.userId,
        type: 'CREDIT',
        source: params.source,
        amountCents: params.amountCents,
        referenceId: params.referenceId,
      },
    });
  },

  async createDebit(params: {
    userId: string;
    amountCents: number;
    source: 'WITHDRAW' | 'ADJUSTMENT';
    referenceId: string;
  }) {
    return prisma.ledger.create({
      data: {
        userId: params.userId,
        type: 'DEBIT',
        source: params.source,
        amountCents: params.amountCents,
        referenceId: params.referenceId,
      },
    });
  },
};
```

Withdraw service:
```typescript
// src/services/withdraw.service.ts
import { prisma } from '@/lib/db';
import { ledgerService } from './ledger.service';

const MIN_WITHDRAW_CENTS = 1000; // R$ 10,00
const WITHDRAW_COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

export const withdrawService = {
  async requestWithdraw(params: {
    userId: string;
    method: 'PIX' | 'LIGHTNING';
    amountCents: number;
  }) {
    const { userId, method, amountCents } = params;

    // Validar valor mínimo
    if (amountCents < MIN_WITHDRAW_CENTS) {
      throw new Error(`Valor mínimo: R$ ${MIN_WITHDRAW_CENTS / 100}`);
    }

    // Verificar saldo
    const balance = await ledgerService.getBalance(userId);
    if (balance < amountCents) {
      throw new Error('Saldo insuficiente');
    }

    // Verificar cooldown
    const lastWithdraw = await prisma.withdrawRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (lastWithdraw) {
      const cooldownEnd = new Date(lastWithdraw.createdAt.getTime() + WITHDRAW_COOLDOWN_MS);
      if (new Date() < cooldownEnd) {
        throw new Error('Aguarde 1 hora entre saques');
      }
    }

    // Buscar destino
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pixKey: true, lightningAddress: true },
    });

    const destination = method === 'PIX' ? user?.pixKey : user?.lightningAddress;
    if (!destination) {
      throw new Error(`Configure seu ${method === 'PIX' ? 'Pix' : 'Lightning Address'} primeiro`);
    }

    // Criar withdraw request + ledger debit em transação
    return prisma.$transaction(async (tx) => {
      const withdraw = await tx.withdrawRequest.create({
        data: {
          userId,
          method,
          amountCents,
          destinationSnapshot: destination,
          status: 'REQUESTED',
        },
      });

      await tx.ledger.create({
        data: {
          userId,
          type: 'DEBIT',
          source: 'WITHDRAW',
          amountCents,
          referenceId: withdraw.id,
        },
      });

      return withdraw;
    });
  },

  async getWithdraws(userId: string) {
    return prisma.withdrawRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
```

API balance:
```typescript
// src/app/api/private/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { ledgerService } from '@/services/ledger.service';

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const balance = await ledgerService.getBalance(user.id);

  return NextResponse.json({ balanceCents: balance });
}
```

API withdraw:
```typescript
// src/app/api/private/withdraw/route.ts
import { z } from 'zod';
import { withdrawService } from '@/services/withdraw.service';

const schema = z.object({
  method: z.enum(['PIX', 'LIGHTNING']),
  amountCents: z.number().int().min(1000),
});

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = schema.parse(await req.json());

  try {
    const withdraw = await withdrawService.requestWithdraw({
      userId: user.id,
      method: body.method,
      amountCents: body.amountCents,
    });

    return NextResponse.json({ success: true, withdraw });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

Dashboard payouts page:
```typescript
// src/app/(dashboard)/dashboard/payouts/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { PayoutSettings } from '@/components/dashboard/PayoutSettings';
import { WithdrawForm } from '@/components/dashboard/WithdrawForm';
import { WithdrawHistory } from '@/components/dashboard/WithdrawHistory';

export default function PayoutsPage() {
  const [balance, setBalance] = useState<number>(0);
  const [withdraws, setWithdraws] = useState([]);

  useEffect(() => {
    fetch('/api/private/balance')
      .then(r => r.json())
      .then(d => setBalance(d.balanceCents));

    fetch('/api/private/withdraws')
      .then(r => r.json())
      .then(d => setWithdraws(d.withdraws));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Saques</h1>

      <div className="bg-zinc-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">Saldo disponível</h2>
        <p className="text-3xl font-bold text-green-400">
          {new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(balance / 100)}
        </p>
      </div>

      <PayoutSettings />
      <WithdrawForm balance={balance} onSuccess={() => {/* refresh */}} />
      <WithdrawHistory withdraws={withdraws} />
    </div>
  );
}
```
</implementation>

<output>
Criar arquivos:
- src/services/ledger.service.ts
- src/services/withdraw.service.ts
- src/app/api/private/balance/route.ts
- src/app/api/private/ledger/route.ts
- src/app/api/private/donations/route.ts
- src/app/api/private/payout-settings/route.ts
- src/app/api/private/withdraw/route.ts
- src/app/api/private/withdraws/route.ts
- src/app/(dashboard)/dashboard/payouts/page.tsx
- src/app/(dashboard)/dashboard/history/page.tsx
- src/components/dashboard/PayoutSettings.tsx
- src/components/dashboard/WithdrawForm.tsx
- src/components/dashboard/WithdrawHistory.tsx
- src/components/dashboard/DonationsList.tsx
- src/components/dashboard/BalanceCard.tsx
</output>

<verification>
1. Saldo calculado corretamente
2. Não permite saque maior que saldo
3. Não permite saque abaixo do mínimo
4. Cooldown de 1 hora funciona
5. Snapshot do destino salvo corretamente
6. Ledger DEBIT criado junto com withdraw
7. Histórico de doações exibido
8. Histórico de saques exibido
9. Configuração de payout atualiza DB
</verification>

<summary_requirements>
Criar `.prompts/002-livecripto-rebuild/SUMMARY-06.md`

Incluir:
- One-liner sobre sistema de saldo e saques
- Arquivos criados
- Próximo passo: Executar Fase 7 (Hardening)
</summary_requirements>

<success_criteria>
- Ledger completo com credits/debits
- Withdraw request funcional
- Validações de saldo e cooldown
- Dashboard payouts funcional
- Dashboard history funcional
- SUMMARY-06.md criado
</success_criteria>
