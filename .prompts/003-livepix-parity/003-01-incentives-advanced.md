# Phase 1 — Advanced Incentives

## Context

LivePix offers advanced incentive features: AI-generated voice for reading donations (TTS with different voice styles), voice messages recorded by donors, media/GIF attachments on donations, custom alert sounds per tier, and amount-based tiers with different colors and sounds. LiveCripto currently has basic TTS via Google Cloud and a simple alert overlay at `src/app/(public)/overlay/[userId]/page.tsx`. The donation form at `src/app/(public)/[username]/page.tsx` only collects name, message, and amount.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), Google Cloud TTS, Bunny CDN, Framer Motion.

## Objective

Enhance the donation flow and alert system with voice messages from donors, media/GIF attachments, tiered alerts with custom colors and sounds, and an incentives settings page for streamers to configure these features.

## Tasks

### 1. Schema Updates

Add to `prisma/schema.prisma`:

```prisma
model Donation {
  // ... existing fields
  voiceMessageUrl String?   // recorded voice from donor
  mediaUrl        String?   // GIF/image URL attached by donor
  mediaType       String?   // "gif" | "image" | "video"
}

model AlertTier {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  minAmountCents  Int      // minimum amount for this tier
  name            String   // e.g. "Bronze", "Prata", "Ouro"
  color           String   @default("#8B5CF6") // hex color for alert border/glow
  soundUrl        String?  // custom alert sound URL (Bunny CDN)
  animationType   String   @default("fadeIn") // "fadeIn" | "slideUp" | "bounce" | "shake" | "zoom"
  duration        Int      @default(5000) // display duration in ms
  ttsVoice        String?  // Google Cloud TTS voice name override
  ttsSpeed        Float    @default(1.0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@unique([userId, minAmountCents])
}

model IncentiveSettings {
  id                    String  @id @default(cuid())
  userId                String  @unique
  user                  User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  voiceMessagesEnabled  Boolean @default(false)
  voiceMessageMaxSecs   Int     @default(15)
  mediaEnabled          Boolean @default(false)
  mediaGifsOnly         Boolean @default(true)
  ttsEnabled            Boolean @default(true)
  ttsDefaultVoice       String  @default("pt-BR-Standard-A")
  ttsDefaultSpeed       Float   @default(1.0)
  minAmountForVoice     Int     @default(500)  // 5.00 BRL
  minAmountForMedia     Int     @default(1000) // 10.00 BRL
  minAmountForTts       Int     @default(200)  // 2.00 BRL
}
```

Run `npx prisma migrate dev --name add_incentives`.

### 2. Voice Message Upload API

Create `src/app/api/upload/voice-message/route.ts`:

- Accept `POST` with audio blob (WebM/OGG from browser MediaRecorder API).
- Validate: max 15 seconds, max 2MB, audio MIME types only (`audio/webm`, `audio/ogg`).
- Upload to Bunny CDN (`/voice-messages/{donationId}.webm`).
- Return `{ url: string }`.

### 3. Media/GIF Selection API

Create `src/app/api/gifs/search/route.ts`:

- Proxy to Tenor API: `GET https://tenor.googleapis.com/v2/search?q={query}&key={TENOR_API_KEY}&limit=20&media_filter=gif`.
- Accept query param `?q=searchterm&limit=20`.
- Return array of `{ id, url, previewUrl, width, height }`.
- Rate limit: 30 req/min per IP.
- Env var: `TENOR_API_KEY`.

### 4. Enhanced Donation Form

Update `src/app/(public)/[username]/page.tsx` donation form:

- **Voice recorder component** (`src/components/donation/VoiceRecorder.tsx`):
  - Button to start/stop recording using `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder`.
  - Show waveform visualization during recording (canvas or CSS bars).
  - Playback recorded audio, re-record, delete buttons.
  - Timer showing recording duration (max from settings).
  - Only visible if `incentiveSettings.voiceMessagesEnabled && amount >= minAmountForVoice`.

- **GIF selector component** (`src/components/donation/GifSelector.tsx`):
  - Button opens modal with search input.
  - Grid of GIF results from Tenor API.
  - Click to select, show selected GIF preview with remove button.
  - Only visible if `incentiveSettings.mediaEnabled && amount >= minAmountForMedia`.

- **Amount tier indicator**: As user changes amount, show which tier they unlock (e.g. "Ouro - alerta especial!").
- Pass `voiceMessageUrl` and `mediaUrl` with the donation creation request body.

### 5. Enhanced AlertBox Overlay

Update `src/app/(public)/overlay/[userId]/page.tsx`:

- Fetch the user's `AlertTier[]` on page load.
- On new donation:
  1. Determine matching tier: find the tier with highest `minAmountCents` that `donation.amountCents >= tier.minAmountCents`.
  2. Apply tier's `color` as CSS `border-color` and `box-shadow` glow.
  3. Apply tier's `animationType` via Framer Motion variants:
     ```typescript
     const animations = {
       fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 } },
       slideUp: { initial: { y: 100, opacity: 0 }, animate: { y: 0, opacity: 1 } },
       bounce: { initial: { scale: 0 }, animate: { scale: [0, 1.2, 1] } },
       shake: { initial: { x: -20 }, animate: { x: [−20, 20, −10, 10, 0] } },
       zoom: { initial: { scale: 3, opacity: 0 }, animate: { scale: 1, opacity: 1 } },
     };
     ```
  4. Set display `duration` from tier.
  5. If `donation.voiceMessageUrl`: play audio element after TTS finishes (or instead of TTS).
  6. If `donation.mediaUrl`: display GIF/image in alert card (max 300x300px, centered below message).
  7. Use tier's `ttsVoice` and `ttsSpeed` for Google Cloud TTS, falling back to defaults.
- **Queue system**: array of pending donations, play one at a time, advance on completion.

### 6. Incentives Settings Page

Create `src/app/(dashboard)/dashboard/settings/incentives/page.tsx`:

- **TTS section**: Enable/disable toggle, default voice dropdown (Google Cloud TTS pt-BR voices: Standard-A through D, Wavenet-A through D), speed slider (0.5x - 2.0x), minimum amount input.
- **Voice messages section**: Enable/disable toggle, max duration slider (5-30 sec), minimum amount input.
- **Media section**: Enable/disable toggle, "GIFs only" checkbox, minimum amount input.
- **Alert tiers section**: List of tiers sortable by `minAmountCents`. Each tier card: name input, min amount input, color picker, sound upload button with playback, animation type dropdown, duration slider (2000-15000ms), TTS voice override dropdown. Add tier / delete tier buttons.
- Save all via `PATCH /api/settings/incentives`.

### 7. Alert Sound Upload & Defaults

Create `src/app/api/upload/alert-sound/route.ts`:

- Accept `.mp3` / `.wav`, max 5MB, duration <= 10 seconds.
- Upload to Bunny CDN (`/alert-sounds/{userId}/{tierId}.mp3`).
- Return `{ url: string, duration: number }`.

Bundle default sounds in `public/sounds/`:
- `public/sounds/default.mp3` — standard notification chime
- `public/sounds/coin.mp3` — coin drop
- `public/sounds/celebration.mp3` — fanfare
- `public/sounds/level-up.mp3` — gaming level-up

## Dependencies

- Tenor API key (`TENOR_API_KEY` env var) — for GIF search. Free tier: 50 req/min.
- `MediaRecorder` API — browser-native, no package needed.
- Google Cloud TTS — already integrated in `src/services/`.
- Bunny CDN — already configured.
- Framer Motion — already installed.

## Acceptance Criteria

- [ ] Donors can record a voice message (up to configurable max seconds) when donating above the minimum amount
- [ ] Donors can search and attach a GIF from Tenor when donating above the minimum amount
- [ ] Streamer can create alert tiers with custom colors, sounds, and animations
- [ ] AlertBox overlay displays the correct tier styling based on donation amount
- [ ] AlertBox plays voice messages and shows GIFs/images when present on the donation
- [ ] TTS voice and speed can be configured globally and per tier
- [ ] Incentives settings page allows full configuration of all features
- [ ] Custom alert sounds can be uploaded (max 10s) and previewed in settings
- [ ] Queue system ensures alerts play sequentially, one at a time
- [ ] All features respect the minimum amount thresholds set by the streamer
- [ ] Default alert sounds are available as fallbacks
