<objective>
FASE 2: Página Pública de Doação

Purpose: Criar a experiência do doador (P2C) com formulário e seleção de método de pagamento
Output: Página /[username] funcional com validação, UI moderna e API de início de doação (mock)
</objective>

<context>
Depende de: @.prompts/002-livecripto-rebuild/002-01-user-provisioning.md (Fase 1 completa)
Usuários já existem no banco com username público
</context>

<requirements>
1. Página /[username] (public):
   - Buscar usuário pelo username
   - Se não existe, 404
   - Exibir formulário de doação

2. Formulário de doação:
   - Valor (BRL) com máscara de moeda + validação mínimo
   - Nome do doador (obrigatório, max 50 chars)
   - Mensagem (obrigatória, max 400 chars com contador visual)
   - Seleção de método: PIX / Cartão / Lightning

3. Validações (client + server):
   - Valor mínimo do criador (do alertSettings)
   - Nome: não vazio, sem caracteres perigosos
   - Mensagem: sanitizar XSS, respeitar limite
   - Rate limit: max 5 tentativas por IP+username em 1 min

4. API POST /api/public/donate/init:
   - Input: { username, amountCents, donorName, message, method }
   - Validação forte server-side
   - Sanitização de mensagem (DOMPurify ou similar approach)
   - Criar Donation com status CREATED
   - Por agora: retornar mock data para cada método
   - Rate limit middleware

5. API GET /api/public/donate/status:
   - Input: { provider, id }
   - Retornar status atual da doação (polling)

6. UI/UX:
   - Design dark mode, moderno
   - Estados de loading, erro, sucesso
   - Animações suaves (Tailwind transitions)
   - Mobile-first responsive
</requirements>

<implementation>
Página de doação:
```typescript
// src/app/(public)/[username]/page.tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import DonationForm from '@/components/donate/DonationForm';

export default async function DonatePage({ params }) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: {
      id: true,
      username: true,
      displayName: true,
      alertSettings: true,
    },
  });

  if (!user) notFound();

  const minAmount = (user.alertSettings as any)?.minAmountCents || 100;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <DonationForm
        username={user.username}
        displayName={user.displayName}
        minAmountCents={minAmount}
      />
    </div>
  );
}
```

Componente de formulário:
```typescript
// src/components/donate/DonationForm.tsx
'use client';

interface Props {
  username: string;
  displayName: string;
  minAmountCents: number;
}

// Estados: idle -> loading -> paymentPending -> success/error
// Campos: valor (masked), nome, mensagem (com contador)
// Métodos: tabs ou radio buttons (PIX, Cartão, Lightning)
// Submit: chama /api/public/donate/init
// Após retorno: exibir modal de pagamento específico
```

Máscara de valor:
```typescript
// Usar react-number-format ou implementar custom
// Format: R$ 0,00
// Min: minAmountCents / 100
// Max: R$ 10.000,00 (sanity check)
```

Sanitização de mensagem:
```typescript
// src/lib/sanitize.ts
// 1. Trim
// 2. Remover caracteres de controle
// 3. Escapar HTML entities
// 4. Remover URLs suspeitas (opcional)
// 5. Verificar contra blacklist do criador (server-side)
```

Rate limit:
```typescript
// src/lib/rate-limit.ts
// Usar Map em memória para dev (OK para MVP)
// Key: IP + username
// Limit: 5 requests / 60 segundos
// Retornar 429 se exceder
```

API init:
```typescript
// src/app/api/public/donate/init/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sanitizeMessage } from '@/lib/sanitize';
import { checkRateLimit } from '@/lib/rate-limit';

const schema = z.object({
  username: z.string().min(1).max(30),
  amountCents: z.number().int().min(100).max(1000000),
  donorName: z.string().min(1).max(50),
  message: z.string().min(1).max(400),
  method: z.enum(['pix', 'card', 'lightning']),
});

export async function POST(req: NextRequest) {
  // 1. Rate limit check
  // 2. Parse and validate body
  // 3. Find user by username
  // 4. Check minAmount
  // 5. Sanitize message
  // 6. Check blacklist
  // 7. Create Donation with status CREATED
  // 8. Por agora: return mock payment data
  // 9. Na Fase 3: integrar providers reais
}
```
</implementation>

<output>
Criar arquivos:
- src/app/(public)/[username]/page.tsx
- src/app/(public)/[username]/not-found.tsx
- src/components/donate/DonationForm.tsx
- src/components/donate/PaymentMethodTabs.tsx
- src/components/donate/AmountInput.tsx
- src/components/donate/MessageInput.tsx (com contador)
- src/components/donate/PaymentModal.tsx (wrapper para modais de pagamento)
- src/components/donate/PixPayment.tsx (exibir QR mock)
- src/components/donate/CardPayment.tsx (redirect mock)
- src/components/donate/LightningPayment.tsx (invoice mock)
- src/app/api/public/donate/init/route.ts
- src/app/api/public/donate/status/route.ts
- src/lib/sanitize.ts
- src/lib/rate-limit.ts
- src/lib/validation.ts (schemas Zod compartilhados)
</output>

<verification>
1. Página /[username] carrega para usuário existente
2. Página 404 para username inexistente
3. Formulário valida todos os campos
4. Contador de caracteres funciona (0/400)
5. API rejeita valores abaixo do mínimo
6. API sanitiza mensagem corretamente
7. Rate limit bloqueia após 5 tentativas rápidas
8. UI responsiva em mobile
9. Estados de loading funcionam
</verification>

<summary_requirements>
Criar `.prompts/002-livecripto-rebuild/SUMMARY-02.md`

Incluir:
- One-liner sobre página de doação
- Arquivos criados
- Próximo passo: Executar Fase 3 (integração de pagamentos)
</summary_requirements>

<success_criteria>
- Página de doação funcional e bonita
- Validação client e server-side
- Sanitização de mensagem implementada
- Rate limiting ativo
- Modais de pagamento (mock) exibindo
- SUMMARY-02.md criado
</success_criteria>
