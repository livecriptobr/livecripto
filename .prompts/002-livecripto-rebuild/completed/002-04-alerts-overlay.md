<objective>
FASE 4: Alerts + Overlay OBS

Purpose: Criar sistema de alertas com overlay para OBS Studio (Browser Source)
Output: Overlay funcional com lock/ack pattern, controles skip/replay, e animações
</objective>

<context>
Depende de: @.prompts/002-livecripto-rebuild/002-03-payments.md (Fase 3 completa)
Alerts já são criados com status QUEUED quando doação é confirmada
Model Alert já existe no Prisma
</context>

<requirements>
1. Overlay page (/overlay/[username]):
   - Validar token via query param
   - Background transparente (para OBS)
   - Polling rápido buscando próximo alert
   - Exibir animação + áudio quando há alert
   - Ack após exibição

2. API Overlay:
   - GET /api/overlay/next?username=...&token=...
     - Validar token do usuário
     - Buscar próximo Alert READY (ou QUEUED se TTS desativado)
     - Lock com TTL (60 segundos)
     - Retornar dados do alert
   - POST /api/overlay/ack
     - Marcar alert como DONE
   - POST /api/overlay/skip (chamado do dashboard)
     - Marcar alert atual como SKIPPED
   - POST /api/overlay/replay-last (chamado do dashboard)
     - Criar novo alert QUEUED baseado no último DONE

3. Lock pattern (crítico para evitar duplicação):
   - Ao buscar próximo alert: UPDATE ... SET status='LOCKED', lockExpiresAt=NOW()+60s WHERE status IN ('READY', 'QUEUED')
   - Se lockExpiresAt expirou: volta a ficar disponível
   - Ack: SET status='DONE', consumedAt=NOW()
   - Job de limpeza: voltar LOCKED expirados para READY

4. Visual do alert:
   - Card com gradiente/glow
   - Nome do doador (grande)
   - Valor formatado (R$ X,XX)
   - Mensagem (scrollable se longa)
   - Fadeout após durationMs do criador
   - Áudio reproduz automaticamente

5. Controles do dashboard:
   - Botão "Pular alerta atual"
   - Botão "Reexibir último alerta"
   - Ambos requerem autenticação Clerk
   - Verificar ownership do alert
</requirements>

<implementation>
Overlay page:
```typescript
// src/app/(public)/overlay/[username]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import AlertBox from '@/components/overlay/AlertBox';

interface Alert {
  id: string;
  donorName: string;
  amountCents: number;
  message: string;
  audioUrl?: string;
  durationMs: number;
}

export default function OverlayPage({ params, searchParams }) {
  const { username } = params;
  const token = searchParams.token;

  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!token) {
      setError('Token required');
      return;
    }

    const pollInterval = 1000; // 1 segundo
    let timeoutId: NodeJS.Timeout;

    const fetchNextAlert = async () => {
      try {
        const res = await fetch(
          `/api/overlay/next?username=${username}&token=${token}`
        );

        if (res.status === 401) {
          setError('Invalid token');
          return;
        }

        const data = await res.json();

        if (data.alert) {
          setCurrentAlert(data.alert);
        } else {
          timeoutId = setTimeout(fetchNextAlert, pollInterval);
        }
      } catch (e) {
        console.error('Poll error:', e);
        timeoutId = setTimeout(fetchNextAlert, pollInterval * 2);
      }
    };

    fetchNextAlert();

    return () => clearTimeout(timeoutId);
  }, [username, token]);

  const handleAlertFinish = async () => {
    if (!currentAlert) return;

    await fetch('/api/overlay/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId: currentAlert.id, token }),
    });

    setCurrentAlert(null);
    // Resume polling
  };

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-transparent">
      {currentAlert && (
        <AlertBox
          alert={currentAlert}
          onFinish={handleAlertFinish}
          audioRef={audioRef}
        />
      )}
      <audio ref={audioRef} />
    </div>
  );
}
```

AlertBox component:
```typescript
// src/components/overlay/AlertBox.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  alert: {
    id: string;
    donorName: string;
    amountCents: number;
    message: string;
    audioUrl?: string;
    durationMs: number;
  };
  onFinish: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export default function AlertBox({ alert, onFinish, audioRef }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Tocar áudio se existir
    if (alert.audioUrl && audioRef.current) {
      audioRef.current.src = alert.audioUrl;
      audioRef.current.play().catch(console.error);
    }

    // Timer para fadeout
    const timer = setTimeout(() => {
      setVisible(false);
    }, alert.durationMs);

    return () => clearTimeout(timer);
  }, [alert]);

  useEffect(() => {
    if (!visible) {
      // Dar tempo para animação de saída
      const exitTimer = setTimeout(onFinish, 500);
      return () => clearTimeout(exitTimer);
    }
  }, [visible, onFinish]);

  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(alert.amountCents / 100);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -50 }}
          className="fixed top-8 left-1/2 -translate-x-1/2 w-[400px] max-w-[90vw]"
        >
          <div className="bg-gradient-to-br from-purple-600/90 to-violet-800/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-white/20">
            <div className="text-center">
              <p className="text-white/80 text-sm uppercase tracking-wider mb-1">
                Nova doação!
              </p>
              <h2 className="text-2xl font-bold text-white mb-2">
                {alert.donorName}
              </h2>
              <p className="text-4xl font-extrabold text-yellow-300 mb-4">
                {formattedAmount}
              </p>
              <p className="text-white text-lg max-h-24 overflow-y-auto">
                {alert.message}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

API next com lock:
```typescript
// src/app/api/overlay/next/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  const token = req.nextUrl.searchParams.get('token');

  if (!username || !token) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  // Validar token
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, overlayToken: true, alertSettings: true },
  });

  if (!user || user.overlayToken !== token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const lockDuration = 60; // segundos
  const now = new Date();

  // Atomic lock: buscar e travar em uma operação
  const alert = await prisma.$queryRaw`
    UPDATE "Alert"
    SET
      status = 'LOCKED',
      "lockExpiresAt" = ${new Date(now.getTime() + lockDuration * 1000)}
    WHERE id = (
      SELECT id FROM "Alert"
      WHERE "userId" = ${user.id}
        AND (
          status = 'READY'
          OR (status = 'LOCKED' AND "lockExpiresAt" < ${now})
        )
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;

  if (!alert || (alert as any[]).length === 0) {
    return NextResponse.json({ alert: null });
  }

  const alertData = (alert as any[])[0];
  const donation = await prisma.donation.findUnique({
    where: { id: alertData.donationId },
    select: { donorName: true, amountCents: true, message: true },
  });

  const settings = user.alertSettings as any;

  return NextResponse.json({
    alert: {
      id: alertData.id,
      donorName: donation?.donorName,
      amountCents: donation?.amountCents,
      message: donation?.message,
      audioUrl: alertData.audioUrl,
      durationMs: settings?.durationMs || 8000,
    },
  });
}
```

API ack:
```typescript
// src/app/api/overlay/ack/route.ts
export async function POST(req: NextRequest) {
  const { alertId, token } = await req.json();

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: { user: { select: { overlayToken: true } } },
  });

  if (!alert || alert.user.overlayToken !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.alert.update({
    where: { id: alertId },
    data: { status: 'DONE', consumedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
```

Dashboard controls:
```typescript
// src/app/api/private/alerts/skip/route.ts
// Requer Clerk auth, verifica ownership, atualiza alert para SKIPPED

// src/app/api/private/alerts/replay/route.ts
// Requer Clerk auth, cria novo Alert baseado no último DONE
```
</implementation>

<output>
Criar arquivos:
- src/app/(public)/overlay/[username]/page.tsx
- src/components/overlay/AlertBox.tsx
- src/components/overlay/AlertStyles.css (animações customizadas)
- src/app/api/overlay/next/route.ts
- src/app/api/overlay/ack/route.ts
- src/app/api/private/alerts/skip/route.ts
- src/app/api/private/alerts/replay/route.ts
- src/app/(dashboard)/dashboard/controls/page.tsx
- src/components/dashboard/AlertControls.tsx
</output>

<verification>
1. Overlay carrega com token válido
2. Overlay rejeita token inválido (401)
3. Alert aparece com animação quando disponível
4. Áudio toca automaticamente
5. Alert some após durationMs
6. Ack marca como DONE
7. Mesmo alert não aparece 2x (lock funciona)
8. Skip funciona do dashboard
9. Replay cria novo alert
10. Locks expirados voltam a ficar disponíveis
</verification>

<summary_requirements>
Criar `.prompts/002-livecripto-rebuild/SUMMARY-04.md`

Incluir:
- One-liner sobre sistema de overlay
- Arquivos criados
- Próximo passo: Executar Fase 5 (TTS + Bunny)
</summary_requirements>

<success_criteria>
- Overlay funcional e bonito
- Lock pattern previne duplicação
- Animações suaves
- Áudio reproduz corretamente
- Controles skip/replay funcionam
- Token validation funciona
- SUMMARY-04.md criado
</success_criteria>
