<objective>
FASE 7: Hardening + README Final

Purpose: Garantir segurança, robustez e documentação completa do projeto
Output: Projeto production-ready com README detalhado
</objective>

<context>
Depende de: @.prompts/002-livecripto-rebuild/002-06-payout-ledger.md (Fase 6 completa)
Todas as features principais implementadas
Foco agora é segurança, logs e documentação
</context>

<requirements>
1. Segurança de Webhooks:
   - Revisar todas as validações de assinatura
   - Garantir que webhooks não expõem dados sensíveis em logs
   - Double-check idempotência em todos os webhooks

2. Rate Limiting:
   - /api/public/donate/init: 5/min por IP+username
   - /api/public/donate/status: 60/min por IP
   - /api/overlay/next: 120/min por token
   - Webhooks: sem limit (mas com signature validation)

3. Sanitização:
   - Revisar todos os inputs de usuário
   - Garantir escape XSS no overlay
   - Validar e sanitizar mensagens

4. Logs estruturados:
   - Adicionar requestId a todos os logs
   - Log de eventos importantes (pagamentos, erros)
   - Não logar dados sensíveis (tokens, keys)

5. Tratamento de erros:
   - Error boundaries no React
   - Respostas de erro consistentes na API
   - Retry automático em falhas recuperáveis

6. Dashboard melhorias finais:
   - /dashboard/profile: editar username e displayName
   - /dashboard/alerts: configurar TTS settings
   - Rotate overlay token funcional
   - Preview do overlay

7. README completo:
   - Visão geral do projeto
   - Setup local (passo a passo)
   - Configuração Clerk
   - Configuração Supabase
   - Configuração dos providers de pagamento
   - Configuração webhooks em cada provider
   - Como usar no OBS
   - Deploy (Vercel)
   - Variáveis de ambiente documentadas
   - Troubleshooting comum
</requirements>

<implementation>
Rate limiter melhorado:
```typescript
// src/lib/rate-limit.ts
import { LRUCache } from 'lru-cache';

interface RateLimitOptions {
  interval: number; // ms
  limit: number;
}

const caches = new Map<string, LRUCache<string, number[]>>();

export function rateLimit(namespace: string, options: RateLimitOptions) {
  if (!caches.has(namespace)) {
    caches.set(namespace, new LRUCache<string, number[]>({
      max: 10000,
      ttl: options.interval,
    }));
  }

  const cache = caches.get(namespace)!;

  return {
    check(key: string): { allowed: boolean; remaining: number } {
      const now = Date.now();
      const timestamps = cache.get(key) || [];

      // Filtrar timestamps dentro do intervalo
      const recent = timestamps.filter(t => now - t < options.interval);

      if (recent.length >= options.limit) {
        return { allowed: false, remaining: 0 };
      }

      recent.push(now);
      cache.set(key, recent);

      return { allowed: true, remaining: options.limit - recent.length };
    },
  };
}

// Uso:
const donateLimit = rateLimit('donate', { interval: 60000, limit: 5 });
// if (!donateLimit.check(`${ip}:${username}`).allowed) return 429;
```

Logger estruturado:
```typescript
// src/lib/logger.ts
import { nanoid } from 'nanoid';

interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  [key: string]: any;
}

export function createLogger(baseContext: LogContext = {}) {
  const requestId = baseContext.requestId || nanoid(10);

  const log = (level: string, message: string, extra: object = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      ...baseContext,
      message,
      ...extra,
    };

    // Remover dados sensíveis
    const sanitized = sanitizeLogEntry(entry);

    console[level === 'error' ? 'error' : 'log'](JSON.stringify(sanitized));
  };

  return {
    info: (msg: string, extra?: object) => log('info', msg, extra),
    warn: (msg: string, extra?: object) => log('warn', msg, extra),
    error: (msg: string, extra?: object) => log('error', msg, extra),
    requestId,
  };
}

function sanitizeLogEntry(entry: any): any {
  const sensitiveKeys = ['token', 'key', 'secret', 'password', 'accessToken'];
  const result = { ...entry };

  for (const key of Object.keys(result)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      result[key] = '[REDACTED]';
    }
  }

  return result;
}
```

Error handling middleware:
```typescript
// src/lib/api-error.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error('Unhandled error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

Dashboard profile page:
```typescript
// src/app/(dashboard)/dashboard/profile/page.tsx
'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';

export default function ProfilePage() {
  const { user, updateUser } = useUser();
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      await fetch('/api/private/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName }),
      });
      // Refresh user data
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Perfil</h1>

      <div className="bg-zinc-900 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full bg-zinc-800 rounded-lg px-4 py-2"
            placeholder="seu-username"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Sua página: livecripto.net/{username}
          </p>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Nome de exibição</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-zinc-800 rounded-lg px-4 py-2"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
```

Dashboard alerts settings:
```typescript
// src/app/(dashboard)/dashboard/alerts/page.tsx
// Configurar: ttsEnabled, ttsVoice, ttsTemplate, durationMs, minAmountCents, blockedWords
// Preview inline do overlay
```

README.md:
```markdown
# LiveCripto

Plataforma de doações para streamers com PIX, Cartão e Lightning Network.

## Features

- Doações via PIX (OpenPix), Cartão (MercadoPago) e Lightning (Coinsnap)
- Overlay para OBS com alertas animados
- TTS (Text-to-Speech) das mensagens
- Dashboard para gerenciar doações e saques
- Sistema de saldo interno (ledger)

## Setup Local

### 1. Pré-requisitos
- Node.js 18+
- pnpm
- Conta Clerk
- Projeto Supabase
- Contas nos providers de pagamento

### 2. Clonar e instalar
\`\`\`bash
git clone https://github.com/seu-usuario/livecripto.git
cd livecripto
pnpm install
\`\`\`

### 3. Configurar variáveis de ambiente
\`\`\`bash
cp .env.example .env.local
# Editar .env.local com suas credenciais
\`\`\`

### 4. Configurar banco de dados
\`\`\`bash
pnpm prisma generate
pnpm prisma db push
\`\`\`

### 5. Rodar localmente
\`\`\`bash
pnpm dev
\`\`\`

## Configuração Clerk

1. Criar application em clerk.com
2. Copiar Publishable Key e Secret Key
3. Configurar URLs de callback
4. Configurar webhook para user.created (se usar)

## Configuração Supabase

1. Criar projeto em supabase.com
2. Copiar Database URL
3. Usar Service Role Key apenas no server

## Configuração Webhooks

### OpenPix
- URL: https://seu-dominio.com/api/webhooks/openpix
- Evento: OPENPIX:CHARGE_COMPLETED

### Coinsnap
- URL: https://seu-dominio.com/api/webhooks/coinsnap
- Secret para validação HMAC

### MercadoPago
- URL: https://seu-dominio.com/api/webhooks/mercadopago
- Eventos: payment.created, payment.updated

## Configuração OBS

1. Adicionar Browser Source
2. URL: https://livecripto.net/overlay/seu-username?token=seu-token
3. Largura: 800, Altura: 600
4. Marcar "Shutdown source when not visible"

## Deploy

### Vercel
\`\`\`bash
vercel deploy
\`\`\`

Configurar todas as variáveis de ambiente no dashboard do Vercel.

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| NEXT_PUBLIC_APP_URL | URL pública do app |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk publishable key |
| CLERK_SECRET_KEY | Clerk secret key |
| DATABASE_URL | URL do Postgres (Supabase) |
| MERCADOPAGO_ACCESS_TOKEN | Token de acesso MP |
| OPENPIX_APP_ID | App ID do OpenPix |
| COINSNAP_API_KEY | API key do Coinsnap |
| COINSNAP_STORE_ID | Store ID do Coinsnap |
| BUNNY_STORAGE_HOST | Host do Bunny Storage |
| BUNNY_STORAGE_ZONE | Zone name do Storage |
| BUNNY_STORAGE_KEY | Access key do Storage |
| BUNNY_CDN_HOST | Host do CDN público |
| GOOGLE_TTS_API_KEY | API key do Google TTS |
| INTERNAL_API_SECRET | Secret para APIs internas |
| CRON_SECRET | Secret para cron jobs |

## Troubleshooting

### Webhook não está sendo processado
- Verificar URL correta
- Verificar assinatura/secret
- Checar logs de erro

### Overlay não exibe alertas
- Verificar token correto
- Verificar se alert está com status READY
- Checar console do browser

### TTS não está gerando áudio
- Verificar API key do Google TTS
- Verificar credenciais do Bunny
- Checar logs de erro na API
\`\`\`
</implementation>

<output>
Criar/modificar arquivos:
- src/lib/rate-limit.ts (melhorar)
- src/lib/logger.ts
- src/lib/api-error.ts
- src/app/(dashboard)/dashboard/profile/page.tsx
- src/app/(dashboard)/dashboard/alerts/page.tsx
- src/app/api/private/profile/route.ts
- src/app/api/private/alert-settings/route.ts
- src/app/api/private/rotate-token/route.ts
- src/components/dashboard/Sidebar.tsx (melhorar navegação)
- src/components/dashboard/AlertSettings.tsx
- src/components/dashboard/OverlayPreview.tsx
- README.md
- .env.example (revisar e completar)
</output>

<verification>
1. Rate limiting funciona em todas as rotas públicas
2. Logs estruturados sem dados sensíveis
3. Erros retornam respostas consistentes
4. Dashboard profile atualiza username corretamente
5. Dashboard alerts configura TTS settings
6. Rotate token invalida token antigo
7. README cobre todos os passos de setup
8. .env.example lista todas as variáveis
</verification>

<summary_requirements>
Criar `.prompts/002-livecripto-rebuild/SUMMARY-07.md`

Incluir:
- One-liner sobre hardening e documentação
- Arquivos criados
- Status: Projeto completo e production-ready
- Checklist de Definition of Done
</summary_requirements>

<success_criteria>
- Segurança revisada e hardened
- Rate limiting ativo
- Logs estruturados
- Dashboard completo
- README abrangente
- Projeto pronto para deploy
- SUMMARY-07.md criado
- Definition of Done completo
</success_criteria>
