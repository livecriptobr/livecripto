# Prompt: Setup do Projeto Next.js TSX

## Objetivo
Criar a estrutura base do projeto LiveCripto em Next.js com TypeScript.

## Instruções

### 1. Criar projeto Next.js
```bash
cd C:\Users\Pichau\livecripto
npx create-next-app@latest livecripto-app --typescript --tailwind --eslint --app --src-dir --use-pnpm
cd livecripto-app
```

### 2. Instalar dependências
```bash
# Auth
pnpm add @clerk/nextjs

# Database
pnpm add @supabase/supabase-js

# Utils
pnpm add zod framer-motion lucide-react
```

### 3. Criar arquivo `.env.local`

Copiar as ENVs do plano em `001-rebuild-plan.md` seção "Fase 2: Configuração de Environment Variables"

### 4. Configurar Clerk

Criar `src/middleware.ts`:
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/cadastro(.*)",
  "/api/config",
  "/api/donate(.*)",
  "/api/webhooks/(.*)",
  "/:username",           // Página de doação pública
  "/overlay/:username",   // Overlay público
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

Atualizar `src/app/layout.tsx`:
```typescript
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR">
        <body className="bg-[#0b0b0f] text-white antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

### 5. Criar estrutura de pastas

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/[[...login]]/page.tsx
│   │   └── cadastro/[[...cadastro]]/page.tsx
│   ├── (dashboard)/
│   │   ├── panel/page.tsx
│   │   ├── wallet/page.tsx
│   │   ├── widgets/page.tsx
│   │   └── layout.tsx
│   ├── (public)/
│   │   ├── [username]/page.tsx
│   │   └── overlay/[username]/page.tsx
│   ├── api/
│   │   ├── config/route.ts
│   │   ├── donate/route.ts
│   │   ├── donate/test/route.ts
│   │   ├── stats/route.ts
│   │   ├── overlays/route.ts
│   │   ├── wallet/route.ts
│   │   └── webhooks/
│   │       ├── openpix/route.ts
│   │       └── coinsnap/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── coinsnap.ts
│   ├── openpix.ts
│   └── tts.ts
├── components/
│   ├── dashboard/
│   ├── donate/
│   ├── overlay/
│   └── ui/
└── types/
    └── database.ts
```

### 6. Criar lib Supabase

`src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

`src/lib/supabase/server.ts`:
```typescript
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {}
        },
      },
    }
  );
}
```

`src/lib/supabase/admin.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

### 7. Verificar se funciona

```bash
pnpm dev
```

Abrir http://localhost:3000 - deve mostrar página inicial do Next.js

## Output Esperado
- Projeto Next.js funcionando
- Clerk configurado
- Supabase clients criados
- Estrutura de pastas pronta
