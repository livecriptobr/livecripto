# Phase 4 — Advanced Moderation

## Context

LivePix offers robust moderation: blocked words list, GPT-powered content filter for offensive/inappropriate text, music moderation, noise/sound detection for voice messages, and pornographic content detection for media uploads. LiveCripto currently has a basic blocked words system in the donation flow but lacks AI-powered moderation, media analysis, and comprehensive moderation controls. Existing alert controls are at `src/app/(dashboard)/dashboard/controls/page.tsx`.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), Google Cloud APIs.

## Objective

Implement a multi-layered moderation system that automatically filters offensive text, inappropriate audio, and prohibited visual content, with a settings page and moderation log for streamers.

## Tasks

### 1. Schema Updates

Add to `prisma/schema.prisma`:

```prisma
model ModerationSettings {
  id                      String  @id @default(cuid())
  userId                  String  @unique
  user                    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  blockedWordsEnabled     Boolean @default(true)
  blockedWords            Json    @default("[]") // string[]
  blockedWordsRegex       Json    @default("[]") // string[] of regex patterns
  useDefaultProfanityList Boolean @default(true)
  gptModerationEnabled    Boolean @default(false)
  gptBlockHate            Boolean @default(true)
  gptBlockSexual          Boolean @default(true)
  gptBlockViolence        Boolean @default(true)
  gptBlockSelfHarm        Boolean @default(true)
  gptBlockThreatening     Boolean @default(true)
  gptBlockHarassment      Boolean @default(true)
  gptSensitivity          Float   @default(0.7) // 0.0-1.0 threshold
  audioModerationEnabled  Boolean @default(false)
  imageModerationEnabled  Boolean @default(false)
  autoBlockRepeatOffenders Boolean @default(false)
  repeatOffenderThreshold  Int     @default(3)
}

model ModerationLog {
  id          String   @id @default(cuid())
  userId      String
  donationId  String?
  donorName   String
  donorIpHash String?
  content     String   @db.Text // the blocked content
  contentType String   // "text" | "voice" | "image" | "gif"
  reason      String   // "blocked_word" | "gpt_moderation" | "audio_analysis" | "image_moderation" | "repeat_offender"
  category    String?  // "hate" | "sexual" | "violence" | "self-harm" | "threatening" | "harassment"
  action      String   // "blocked" | "flagged" | "auto_banned"
  details     Json?    // { matchedWord?, gptScores?, etc }
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([userId, createdAt])
  @@index([donorIpHash])
}

model BlockedDonor {
  id          String   @id @default(cuid())
  userId      String
  donorIpHash String
  donorName   String?
  reason      String?
  blockedAt   DateTime @default(now())

  @@unique([userId, donorIpHash])
  @@index([userId])
}
```

Run `npx prisma migrate dev --name add_moderation`.

### 2. Moderation Service

Create `src/services/moderation.ts`:

```typescript
import crypto from 'crypto';

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  category?: string;
  details?: Record<string, unknown>;
}

// Hash IP for privacy
export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.IP_HASH_SALT).digest('hex');
}

// Main moderation pipeline
export async function moderateDonation(params: {
  userId: string;
  donorIp: string;
  donorName: string;
  message: string;
  voiceMessageUrl?: string;
  mediaUrl?: string;
}): Promise<ModerationResult> {
  const settings = await getModerationSettings(params.userId);
  const ipHash = hashIp(params.donorIp);

  // 1. Check blocked donor
  if (await isDonorBlocked(params.userId, ipHash)) {
    return { allowed: false, reason: 'blocked_donor' };
  }

  // 2. Text moderation
  if (settings.blockedWordsEnabled) {
    const textResult = await moderateText(params.message, settings);
    if (!textResult.allowed) return textResult;
  }

  // 3. GPT moderation
  if (settings.gptModerationEnabled) {
    const gptResult = await moderateWithGpt(params.message, settings);
    if (!gptResult.allowed) return gptResult;
  }

  // 4. Audio moderation
  if (settings.audioModerationEnabled && params.voiceMessageUrl) {
    const audioResult = await moderateAudio(params.voiceMessageUrl, settings);
    if (!audioResult.allowed) return audioResult;
  }

  // 5. Image moderation
  if (settings.imageModerationEnabled && params.mediaUrl) {
    const imageResult = await moderateImage(params.mediaUrl);
    if (!imageResult.allowed) return imageResult;
  }

  return { allowed: true };
}
```

### 3. Blocked Words Engine

Implement in `src/services/moderation.ts`:

```typescript
// Default Portuguese profanity list
const DEFAULT_PROFANITY: string[] = [
  // Common Portuguese profanity - populate with standard list
  // This should be a comprehensive but reasonable default
];

export function moderateText(text: string, settings: ModerationSettings): ModerationResult {
  const normalizedText = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase();

  // Check custom blocked words
  const blockedWords: string[] = settings.blockedWords as string[];
  for (const word of blockedWords) {
    const normalizedWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalizedText.includes(normalizedWord)) {
      return { allowed: false, reason: 'blocked_word', details: { matchedWord: word } };
    }
  }

  // Check regex patterns
  const regexPatterns: string[] = settings.blockedWordsRegex as string[];
  for (const pattern of regexPatterns) {
    try {
      if (new RegExp(pattern, 'i').test(normalizedText)) {
        return { allowed: false, reason: 'blocked_word', details: { matchedPattern: pattern } };
      }
    } catch { /* invalid regex, skip */ }
  }

  // Check default profanity list
  if (settings.useDefaultProfanityList) {
    for (const word of DEFAULT_PROFANITY) {
      if (normalizedText.includes(word)) {
        return { allowed: false, reason: 'blocked_word', details: { matchedWord: '[default list]' } };
      }
    }
  }

  return { allowed: true };
}
```

### 4. GPT Moderation Integration

```typescript
export async function moderateWithGpt(text: string, settings: ModerationSettings): Promise<ModerationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text }),
    });

    const data = await response.json();
    const result = data.results[0];

    const categoryMap: Record<string, string> = {
      'hate': 'gptBlockHate',
      'sexual': 'gptBlockSexual',
      'violence': 'gptBlockViolence',
      'self-harm': 'gptBlockSelfHarm',
      'threatening': 'gptBlockThreatening',
      'harassment': 'gptBlockHarassment',
    };

    for (const [category, settingKey] of Object.entries(categoryMap)) {
      if (settings[settingKey] && result.category_scores[category] > settings.gptSensitivity) {
        return {
          allowed: false,
          reason: 'gpt_moderation',
          category,
          details: { score: result.category_scores[category] },
        };
      }
    }

    return { allowed: true };
  } catch {
    // API failure - allow through (fail open)
    console.error('OpenAI Moderation API failed, allowing through');
    return { allowed: true };
  }
}
```

Env var needed: `OPENAI_API_KEY`.

### 5. Audio Moderation

```typescript
export async function moderateAudio(audioUrl: string, settings: ModerationSettings): Promise<ModerationResult> {
  // 1. Download audio from Bunny CDN
  const audioBuffer = await fetch(audioUrl).then(r => r.arrayBuffer());

  // 2. Transcribe using Google Cloud Speech-to-Text
  const { SpeechClient } = await import('@google-cloud/speech');
  const speechClient = new SpeechClient();

  const [response] = await speechClient.recognize({
    audio: { content: Buffer.from(audioBuffer).toString('base64') },
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: 'pt-BR',
    },
  });

  const transcript = response.results
    ?.map(r => r.alternatives?.[0]?.transcript)
    .join(' ') || '';

  // 3. Run transcript through text moderation
  if (transcript) {
    const textResult = moderateText(transcript, settings);
    if (!textResult.allowed) {
      return { ...textResult, contentType: 'voice', details: { ...textResult.details, transcript } };
    }

    if (settings.gptModerationEnabled) {
      const gptResult = await moderateWithGpt(transcript, settings);
      if (!gptResult.allowed) {
        return { ...gptResult, contentType: 'voice', details: { ...gptResult.details, transcript } };
      }
    }
  }

  return { allowed: true };
}
```

Package needed: `npm install @google-cloud/speech`.

### 6. Image Moderation

```typescript
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  const { ImageAnnotatorClient } = await import('@google-cloud/vision');
  const visionClient = new ImageAnnotatorClient();

  const [result] = await visionClient.safeSearchDetection(imageUrl);
  const safe = result.safeSearchAnnotation;

  if (!safe) return { allowed: true };

  const blocked = ['LIKELY', 'VERY_LIKELY'];
  if (blocked.includes(safe.adult || '') || blocked.includes(safe.violence || '') || blocked.includes(safe.racy || '')) {
    return {
      allowed: false,
      reason: 'image_moderation',
      category: safe.adult && blocked.includes(safe.adult) ? 'sexual' : 'violence',
      details: { adult: safe.adult, violence: safe.violence, racy: safe.racy },
    };
  }

  return { allowed: true };
}
```

Package needed: `npm install @google-cloud/vision`.

### 7. Integrate into Donation Flow

Update donation creation logic (e.g., `src/app/api/donations/route.ts` or the relevant payment webhook handler):

```typescript
import { moderateDonation, hashIp, logModeration, checkRepeatOffender } from '@/services/moderation';

// Before saving donation:
const moderationResult = await moderateDonation({
  userId: streamer.id,
  donorIp: request.headers.get('x-forwarded-for') || 'unknown',
  donorName: body.name,
  message: body.message,
  voiceMessageUrl: body.voiceMessageUrl,
  mediaUrl: body.mediaUrl,
});

if (!moderationResult.allowed) {
  // Log the moderation event
  await prisma.moderationLog.create({
    data: {
      userId: streamer.id,
      donorName: body.name,
      donorIpHash: hashIp(donorIp),
      content: body.message,
      contentType: moderationResult.details?.contentType || 'text',
      reason: moderationResult.reason!,
      category: moderationResult.category,
      action: 'blocked',
      details: moderationResult.details,
    },
  });

  // Check repeat offender
  const settings = await getModerationSettings(streamer.id);
  if (settings.autoBlockRepeatOffenders) {
    const ipHash = hashIp(donorIp);
    const violationCount = await prisma.moderationLog.count({
      where: { userId: streamer.id, donorIpHash: ipHash },
    });
    if (violationCount >= settings.repeatOffenderThreshold) {
      await prisma.blockedDonor.upsert({
        where: { userId_donorIpHash: { userId: streamer.id, donorIpHash: ipHash } },
        create: { userId: streamer.id, donorIpHash: ipHash, donorName: body.name, reason: 'repeat_offender' },
        update: {},
      });
    }
  }

  return NextResponse.json(
    { error: 'Sua mensagem não pôde ser enviada. Por favor, revise o conteúdo.' },
    { status: 400 }
  );
}
```

### 8. Moderation Settings Page

Create `src/app/(dashboard)/dashboard/settings/moderation/page.tsx`:

- **Blocked words section**:
  - Textarea for blocked words (one per line).
  - Textarea for regex patterns (one per line) with syntax help tooltip.
  - Toggle: "Usar lista padrão de palavrões em português".
- **AI moderation section**:
  - Enable/disable toggle.
  - Category checkboxes: Ódio, Sexual, Violência, Autolesão, Ameaça, Assédio.
  - Sensitivity slider (0.3 = leniente, 0.7 = moderado, 0.9 = rigoroso).
- **Audio moderation section**: Enable/disable toggle. Note: "Mensagens de voz serão transcritas e analisadas."
- **Image moderation section**: Enable/disable toggle. Note: "GIFs e imagens serão analisados antes de exibir."
- **Auto-block section**: Enable/disable toggle, threshold number input.
- Save via `PATCH /api/settings/moderation`.

### 9. Moderation Log Page

Create `src/app/(dashboard)/dashboard/moderation/page.tsx`:

- **Table columns**: Data/Hora, Doador, Conteúdo (truncated 50 chars), Tipo (badge), Motivo (badge), Categoria, Ação.
- **Filters**: content type dropdown, reason dropdown, date range picker.
- Click row to expand: full content text, all details JSON formatted, transcript (if voice).
- **Pagination**: 20 per page.
- **Blocked donors tab**: separate tab/section listing all blocked donors with: name, IP hash (truncated), reason, date blocked, "Desbloquear" button.
- **Export**: "Exportar CSV" button for the moderation log.

### 10. Blocked Donor Management API

Create `src/app/api/moderation/blocked-donors/route.ts`:

- `GET` — list blocked donors for authenticated user. Returns `[{ id, donorName, donorIpHash, reason, blockedAt }]`.
- `POST { donorIpHash, donorName?, reason? }` — manually block a donor.
- `DELETE` body `{ id }` — unblock a donor.

Create `src/app/api/settings/moderation/route.ts`:

- `GET` — get moderation settings for authenticated user.
- `PATCH` — update moderation settings.

## Dependencies

- `openai` — or just use `fetch` to the OpenAI Moderation API endpoint (no SDK needed).
- `@google-cloud/speech` — for voice transcription: `npm install @google-cloud/speech`
- `@google-cloud/vision` — for image SafeSearch: `npm install @google-cloud/vision`
- `OPENAI_API_KEY` env var.
- `IP_HASH_SALT` env var (random string for IP hashing).
- Google Cloud credentials already configured for TTS.

## Acceptance Criteria

- [ ] Blocked words filter catches exact matches (accent-insensitive, case-insensitive)
- [ ] Regex patterns are supported for advanced blocking rules
- [ ] Default Portuguese profanity list can be toggled on/off
- [ ] GPT moderation blocks content in enabled categories with configurable sensitivity
- [ ] Voice messages are transcribed via Google Speech-to-Text and text-moderated
- [ ] Image/GIF uploads are checked via Google Vision SafeSearch API
- [ ] Blocked donations are logged with full details in the moderation log
- [ ] Repeat offenders are auto-blocked after configurable threshold
- [ ] Streamer can view and filter the moderation log with pagination
- [ ] Streamer can manually block and unblock donors
- [ ] Moderation settings page has clear toggles for each moderation layer
- [ ] Blocked donors cannot submit new donations (checked by IP hash)
- [ ] Donor sees a generic "content not allowed" error (no specific reason leaked)
- [ ] System fails open if external APIs (OpenAI, Google) are unavailable
