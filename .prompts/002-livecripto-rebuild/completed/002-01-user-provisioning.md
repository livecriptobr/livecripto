<objective>
FASE 1: Provisionamento de Usuário (Clerk → Supabase)

Purpose: Sincronizar usuários do Clerk com banco Supabase, gerando username e overlayToken
Output: Sistema robusto de provisionamento com webhook do Clerk + fallback on-demand
</objective>

<context>
Depende de: @.prompts/002-livecripto-rebuild/002-00-setup.md (Fase 0 completa)
Schema Prisma: User model já criado

Estratégia: Implementar AMBOS os fluxos para robustez:
1. Webhook do Clerk (user.created, user.updated) - primário
2. On-demand provisioning - fallback quando webhook falha
</context>

<requirements>
1. Webhook do Clerk em /api/webhooks/clerk
   - Validar assinatura com Svix
   - Evento user.created: criar User no DB
   - Evento user.updated: atualizar email/nome
   - Evento user.deleted: soft delete ou cleanup

2. Geração de username automático:
   - Base: parte do email antes do @ OU nome
   - Normalizar: lowercase, remover acentos, só alfanuméricos e hífens
   - Se já existe: adicionar sufixo randômico (4 chars)
   - Garantir unicidade com retry

3. Geração de overlayToken:
   - Token forte (32 bytes, hex)
   - crypto.randomBytes() server-side
   - Salvar overlayTokenUpdatedAt

4. On-demand provisioning (fallback):
   - Criar função ensureUserExists(clerkUserId)
   - Usar em todas as rotas autenticadas do dashboard
   - Transação para evitar race conditions
   - Se já existe, retornar sem criar

5. Service de usuário:
   - getOrCreateUser(clerkUserId, email, name)
   - getUserByUsername(username)
   - updateUsername(userId, newUsername)
   - rotateOverlayToken(userId)
   - updatePayoutSettings(userId, pixKey, lightningAddress)
   - updateAlertSettings(userId, settings)
</requirements>

<implementation>
Webhook Clerk (/api/webhooks/clerk/route.ts):
```typescript
// Validar com Svix headers: svix-id, svix-timestamp, svix-signature
// Usar Webhook class do @clerk/nextjs/webhooks
// Processar eventos: user.created, user.updated, user.deleted
```

Geração de username:
```typescript
function generateUsername(email: string, name?: string): string {
  // 1. Tentar parte do email antes do @
  // 2. Fallback para nome normalizado
  // 3. Normalizar: lowercase, remover acentos (normalize NFD), só [a-z0-9-]
  // 4. Truncar para max 20 chars
  // 5. Se vazio, usar "user"
}

async function ensureUniqueUsername(baseUsername: string): Promise<string> {
  // Tentar base primeiro
  // Se existe, adicionar sufixo randômico
  // Retry até encontrar único (max 5 tentativas)
}
```

Overlay token:
```typescript
import crypto from 'crypto';
const overlayToken = crypto.randomBytes(32).toString('hex');
```

Service pattern:
```typescript
// src/services/user.service.ts
export const userService = {
  async getOrCreateUser(clerkUserId: string, email: string, name?: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { clerkUserId } });
      if (existing) return existing;

      const username = await ensureUniqueUsername(generateUsername(email, name));
      const overlayToken = crypto.randomBytes(32).toString('hex');

      return tx.user.create({
        data: {
          clerkUserId,
          email,
          displayName: name || username,
          username,
          overlayToken,
          overlayTokenUpdatedAt: new Date(),
          alertSettings: {
            minAmountCents: 100, // R$ 1,00
            ttsEnabled: true,
            ttsVoice: 'pt-BR-Standard-A',
            ttsTemplate: '{nome} doou {valor}. {mensagem}',
            durationMs: 8000,
            blockedWords: [],
          },
        },
      });
    });
  },
  // ... outros métodos
};
```

Dashboard layout com provisioning:
```typescript
// src/app/(dashboard)/dashboard/layout.tsx
import { auth, currentUser } from '@clerk/nextjs/server';
import { userService } from '@/services/user.service';

export default async function DashboardLayout({ children }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const clerkUser = await currentUser();
  const user = await userService.getOrCreateUser(
    userId,
    clerkUser?.emailAddresses[0]?.emailAddress || '',
    clerkUser?.firstName || undefined
  );

  return (
    <div>
      {/* Pass user to children via context or props */}
      {children}
    </div>
  );
}
```
</implementation>

<output>
Criar/modificar arquivos:
- src/app/api/webhooks/clerk/route.ts (webhook handler)
- src/services/user.service.ts (user service completo)
- src/lib/username.ts (funções de geração/validação)
- src/app/(dashboard)/dashboard/layout.tsx (atualizar com provisioning)
- src/app/(dashboard)/dashboard/page.tsx (dashboard básico mostrando links)
- src/components/dashboard/UserLinks.tsx (exibir link público e overlay URL)
</output>

<verification>
1. Webhook do Clerk processa user.created corretamente (testar com Clerk dashboard)
2. Username gerado é único e válido (slug format)
3. overlayToken gerado com 64 chars hex
4. On-demand provisioning funciona quando webhook falha
5. Dashboard exibe corretamente link público e overlay URL
6. Não há race conditions na criação (testar requests simultâneos)
</verification>

<summary_requirements>
Criar `.prompts/002-livecripto-rebuild/SUMMARY-01.md`

Incluir:
- One-liner sobre sistema de provisionamento
- Arquivos criados
- Próximo passo: Executar Fase 2 (página pública de doação)
</summary_requirements>

<success_criteria>
- Webhook Clerk funcional com validação de assinatura
- Username automático único gerado
- overlayToken forte gerado
- On-demand provisioning como fallback
- Dashboard mostra links do usuário
- SUMMARY-01.md criado
</success_criteria>
