<objective>
FASE 5: TTS + Bunny CDN

Purpose: Gerar áudio TTS das doações e fazer upload para Bunny CDN
Output: Pipeline completo de TTS → Upload → URL pública + limpeza automática
</objective>

<context>
Depende de: @.prompts/002-livecripto-rebuild/002-04-alerts-overlay.md (Fase 4 completa)
Alerts são criados com status QUEUED
Overlay já suporta reproduzir audioUrl
User.alertSettings contém configurações de TTS
</context>

<requirements>
1. Google TTS:
   - Usar Google Cloud Text-to-Speech API
   - Voz configurável pelo criador (pt-BR padrão)
   - Template configurável: "{nome} doou {valor}. {mensagem}"
   - Limitar texto a 5000 chars (limite API)
   - Retornar audio/mp3

2. Bunny Storage:
   - Upload via API REST
   - Path: tts/{userId}/{alertId}.mp3
   - Retornar URL pública: https://{zone}.b-cdn.net/tts/{userId}/{alertId}.mp3

3. Pipeline TTS:
   - Disparado após Alert criado
   - 1. Buscar donation + user settings
   - 2. Montar texto com template
   - 3. Gerar áudio (Google TTS)
   - 4. Upload para Bunny
   - 5. Atualizar alert.audioUrl + status = READY
   - Se erro: alert.lastError = mensagem, status = READY (exibir sem áudio)

4. API interna:
   - POST /api/internal/tts/build
   - Protegido por INTERNAL_API_SECRET
   - Body: { alertId }
   - Síncrono (para MVP) - pode virar async depois

5. TTL + Cleanup:
   - Áudios expiram após 6 horas (configurável)
   - Cron: POST /api/cron/cleanup
   - Protegido por CRON_SECRET
   - Delete do Bunny + limpa audioUrl no DB
   - Rodar a cada hora via external scheduler (Vercel cron, etc)

6. Blacklist de palavras:
   - Antes de gerar TTS, verificar blockedWords do criador
   - Opção: remover palavras ou bloquear totalmente
   - Por padrão: substituir por "[censurado]"
</requirements>

<implementation>
Google TTS client:
```typescript
// src/lib/tts.ts
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Se usando API key simples:
const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export async function generateTTS(params: {
  text: string;
  voice?: string; // ex: 'pt-BR-Standard-A'
  languageCode?: string;
}): Promise<Buffer> {
  const { text, voice = 'pt-BR-Standard-A', languageCode = 'pt-BR' } = params;

  // Limitar texto
  const truncatedText = text.slice(0, 5000);

  const response = await fetch(`${TTS_ENDPOINT}?key=${process.env.GOOGLE_TTS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: truncatedText },
      voice: {
        languageCode,
        name: voice,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0,
      },
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`TTS Error: ${data.error.message}`);
  }

  // audioContent é base64
  return Buffer.from(data.audioContent, 'base64');
}

export function buildTTSText(
  template: string,
  donation: { donorName: string; amountCents: number; message: string }
): string {
  const valor = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(donation.amountCents / 100);

  return template
    .replace('{nome}', donation.donorName)
    .replace('{valor}', valor)
    .replace('{mensagem}', donation.message);
}

export function applyBlacklist(text: string, blockedWords: string[]): string {
  if (!blockedWords || blockedWords.length === 0) return text;

  let result = text;
  for (const word of blockedWords) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    result = result.replace(regex, '[censurado]');
  }
  return result;
}
```

Bunny Storage client:
```typescript
// src/lib/bunny.ts
const BUNNY_STORAGE_URL = `https://${process.env.BUNNY_STORAGE_HOST}/${process.env.BUNNY_STORAGE_ZONE}`;

export async function uploadToBunny(params: {
  path: string; // ex: tts/user123/alert456.mp3
  content: Buffer;
  contentType?: string;
}): Promise<string> {
  const { path, content, contentType = 'audio/mpeg' } = params;

  const response = await fetch(`${BUNNY_STORAGE_URL}/${path}`, {
    method: 'PUT',
    headers: {
      AccessKey: process.env.BUNNY_STORAGE_KEY!,
      'Content-Type': contentType,
    },
    body: content,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bunny upload failed: ${error}`);
  }

  // URL pública
  return `https://${process.env.BUNNY_CDN_HOST}/${path}`;
}

export async function deleteFromBunny(path: string): Promise<void> {
  const response = await fetch(`${BUNNY_STORAGE_URL}/${path}`, {
    method: 'DELETE',
    headers: {
      AccessKey: process.env.BUNNY_STORAGE_KEY!,
    },
  });

  // 404 é OK (já foi deletado)
  if (!response.ok && response.status !== 404) {
    throw new Error(`Bunny delete failed: ${response.status}`);
  }
}
```

TTS Build API:
```typescript
// src/app/api/internal/tts/build/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateTTS, buildTTSText, applyBlacklist } from '@/lib/tts';
import { uploadToBunny } from '@/lib/bunny';

export async function POST(req: NextRequest) {
  // Verificar secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { alertId } = await req.json();

  try {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        donation: true,
        user: { select: { id: true, alertSettings: true } },
      },
    });

    if (!alert || !alert.donation) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const settings = alert.user.alertSettings as any;

    if (!settings?.ttsEnabled) {
      // TTS desativado, marcar como READY sem áudio
      await prisma.alert.update({
        where: { id: alertId },
        data: { status: 'READY', readyAt: new Date() },
      });
      return NextResponse.json({ success: true, audioUrl: null });
    }

    // Montar texto
    let text = buildTTSText(
      settings.ttsTemplate || '{nome} doou {valor}. {mensagem}',
      alert.donation
    );

    // Aplicar blacklist
    text = applyBlacklist(text, settings.blockedWords || []);

    // Gerar áudio
    const audioBuffer = await generateTTS({
      text,
      voice: settings.ttsVoice || 'pt-BR-Standard-A',
    });

    // Upload para Bunny
    const path = `tts/${alert.user.id}/${alert.id}.mp3`;
    const audioUrl = await uploadToBunny({ path, content: audioBuffer });

    // Atualizar alert
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        audioUrl,
        status: 'READY',
        readyAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, audioUrl });
  } catch (error) {
    console.error('TTS build error:', error);

    // Marcar como READY mas com erro (exibir sem áudio)
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'READY',
        readyAt: new Date(),
        lastError: String(error),
      },
    });

    return NextResponse.json({ success: true, audioUrl: null, error: String(error) });
  }
}
```

Cleanup cron:
```typescript
// src/app/api/cron/cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deleteFromBunny } from '@/lib/bunny';

export async function POST(req: NextRequest) {
  // Verificar secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const TTL_HOURS = 6;
  const cutoff = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000);

  // Buscar alerts com áudio expirado
  const expiredAlerts = await prisma.alert.findMany({
    where: {
      audioUrl: { not: null },
      status: 'DONE',
      consumedAt: { lt: cutoff },
    },
    select: {
      id: true,
      audioUrl: true,
      user: { select: { id: true } },
    },
  });

  let deleted = 0;
  let errors = 0;

  for (const alert of expiredAlerts) {
    try {
      const path = `tts/${alert.user.id}/${alert.id}.mp3`;
      await deleteFromBunny(path);

      await prisma.alert.update({
        where: { id: alert.id },
        data: { audioUrl: null },
      });

      deleted++;
    } catch (e) {
      console.error(`Failed to delete audio for alert ${alert.id}:`, e);
      errors++;
    }
  }

  return NextResponse.json({ deleted, errors, total: expiredAlerts.length });
}
```

Disparar TTS após pagamento confirmado:
```typescript
// Atualizar src/services/donation.service.ts
export async function handleDonationPaid(donationId: string) {
  await prisma.$transaction(async (tx) => {
    // ... código existente ...

    // Criar Alert
    const alert = await tx.alert.create({
      data: {
        userId: donation.userId,
        donationId: donation.id,
        status: 'QUEUED',
      },
    });

    return alert;
  }).then(async (alert) => {
    // Disparar TTS build (fora da transaction)
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/tts/build`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify({ alertId: alert.id }),
    });
  });
}
```
</implementation>

<output>
Criar/modificar arquivos:
- src/lib/tts.ts
- src/lib/bunny.ts
- src/app/api/internal/tts/build/route.ts
- src/app/api/cron/cleanup/route.ts
- src/services/donation.service.ts (atualizar para disparar TTS)
- vercel.json (configurar cron) OU documentar scheduler externo
</output>

<verification>
1. TTS gera áudio MP3 corretamente
2. Upload para Bunny funciona
3. URL pública do áudio é acessível
4. Alert atualizado com audioUrl e status READY
5. Blacklist substitui palavras corretamente
6. Erro de TTS não quebra fluxo (alert fica READY sem áudio)
7. Cleanup deleta arquivos expirados
8. Cleanup limpa audioUrl no DB
</verification>

<summary_requirements>
Criar `.prompts/002-livecripto-rebuild/SUMMARY-05.md`

Incluir:
- One-liner sobre pipeline TTS + Bunny
- Arquivos criados
- Próximo passo: Executar Fase 6 (Payout + Ledger)
</summary_requirements>

<success_criteria>
- Google TTS integrado e funcionando
- Bunny upload e delete funcionando
- Pipeline completo: doação → TTS → upload → alert ready
- Cleanup cron funcional
- Blacklist aplicada
- Fallback gracioso em caso de erro
- SUMMARY-05.md criado
</success_criteria>
