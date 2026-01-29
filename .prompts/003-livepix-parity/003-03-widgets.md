# Phase 3 — Full Widgets System

## Context

LivePix offers 8+ widget types that streamers add as browser sources in OBS: Alerts, Ranking (top donors), QR Code, Recent donations, Marathon timer, Poll results, Video (YouTube from audience), Music (audience requests). LiveCripto currently only has an alerts overlay at `src/app/(public)/overlay/[userId]/page.tsx`. There is no widget management system.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), Framer Motion, Bunny CDN.

## Objective

Build a full widget management system where streamers can create, configure, and embed multiple widget types as OBS browser sources, each with a unique secure URL and token-based authentication.

## Tasks

### 1. Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model Widget {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  type          String         // "alerts" | "ranking" | "qrcode" | "recent" | "marathon" | "poll" | "video" | "music"
  name          String         // user-given name, e.g. "Meu Alerta Principal"
  token         String         @unique @default(cuid()) // secure access token
  config        Json           @default("{}")
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  marathonTimer MarathonTimer?

  @@index([userId])
  @@index([token])
}

model MarathonTimer {
  id               String    @id @default(cuid())
  widgetId         String    @unique
  widget           Widget    @relation(fields: [widgetId], references: [id], onDelete: Cascade)
  userId           String
  endsAt           DateTime
  baseMinutes      Int       @default(60)
  addMinutesPer    Int       @default(1)    // minutes added per threshold
  addThreshold     Int       @default(500)  // cents threshold
  maxHours         Int       @default(24)
  isPaused         Boolean   @default(false)
  pausedAt         DateTime?
  remainingOnPause Int?      // seconds remaining when paused

  @@index([userId])
}
```

Run `npx prisma migrate dev --name add_widgets`.

### 2. Widget CRUD API

Create `src/app/api/widgets/route.ts`:

- `GET /api/widgets` — list all widgets for authenticated user. Returns `[{ id, type, name, token, isActive, config, createdAt }]`.
- `POST /api/widgets` — create widget. Body: `{ type, name, config? }`. Auto-generates `token` via `cuid()`. Validate `type` is one of the 8 allowed types.

Create `src/app/api/widgets/[widgetId]/route.ts`:

- `GET /api/widgets/[widgetId]` — get widget details (auth required, owner only).
- `PATCH /api/widgets/[widgetId]` — update `name`, `config`, `isActive`.
- `DELETE /api/widgets/[widgetId]` — delete widget.

Create `src/app/api/widgets/[widgetId]/rotate-token/route.ts`:

- `POST` — generate new `cuid()` token, update widget. Return `{ token: string }`. Old URL stops working.

### 3. Widget Management Dashboard

Create `src/app/(dashboard)/dashboard/widgets/page.tsx`:

- **Grid layout** of widget cards. Each card shows:
  - Widget type icon (use emoji or custom SVG per type).
  - Name (editable inline or via modal).
  - Status badge: Active (green) / Inactive (gray).
  - Preview thumbnail (static image per type or live mini-preview).
- **"Adicionar Widget" button**: opens modal with 8 widget type cards:
  | Type | Icon | Description |
  |------|------|-------------|
  | Alertas | Bell | Exibe alertas de doações na tela |
  | Ranking | Trophy | Top doadores por período |
  | QR Code | QR | QR code da página de doação |
  | Recentes | List | Lista de doações recentes |
  | Maratona | Timer | Cronômetro de maratona |
  | Enquete | Chart | Resultados de enquetes |
  | Vídeo | Play | Vídeos do YouTube da audiência |
  | Música | Music | Pedidos de música |
- **Card actions** (dropdown menu):
  - "Editar configuração" — opens config form specific to widget type.
  - "Copiar URL" — copies `https://livecripto.com/widget/{id}?token={token}` to clipboard.
  - "Visualizar" — opens widget in new tab.
  - "Ativar/Desativar" toggle.
  - "Trocar Token" — rotate token with confirmation dialog.
  - "Excluir" — delete with confirmation.
- **OBS instructions** tooltip: "Adicione como Fonte > Navegador no OBS. Largura: 800, Altura: 600."

### 4. Widget Renderer Route

Create `src/app/(public)/widget/[widgetId]/page.tsx`:

```typescript
// Server component
export default async function WidgetPage({ params, searchParams }) {
  const widget = await prisma.widget.findUnique({
    where: { id: params.widgetId },
    include: { user: true, marathonTimer: true },
  });

  if (!widget || searchParams.token !== widget.token) {
    return <div className="bg-transparent text-white p-4">Widget não encontrado</div>;
  }

  if (!widget.isActive) {
    return <div className="bg-transparent" />;
  }

  // Render appropriate widget component based on type
  switch (widget.type) {
    case 'alerts': return <AlertsWidget widget={widget} />;
    case 'ranking': return <RankingWidget widget={widget} />;
    case 'qrcode': return <QrCodeWidget widget={widget} />;
    case 'recent': return <RecentWidget widget={widget} />;
    case 'marathon': return <MarathonWidget widget={widget} />;
    case 'video': return <VideoWidget widget={widget} />;
    case 'music': return <MusicWidget widget={widget} />;
    default: return null;
  }
}
```

All widgets: `body { background: transparent; overflow: hidden; }`.

### 5. Alerts Widget

Create `src/components/widgets/AlertsWidget.tsx`:

- Migrate existing logic from `src/app/(public)/overlay/[userId]/page.tsx`.
- Config schema:
  ```json
  {
    "layout": "standard",
    "fontSize": 24,
    "fontFamily": "Inter",
    "textColor": "#FFFFFF",
    "accentColor": "#8B5CF6",
    "showAmount": true,
    "showMessage": true,
    "animationIn": "fadeIn",
    "animationOut": "fadeOut",
    "duration": 5000
  }
  ```
- Polls for new donations via `GET /api/widgets/{widgetId}/data?token={token}&since={lastDonationId}`.

### 6. Ranking Widget

Create `src/components/widgets/RankingWidget.tsx`:

- Config: `{ period: "today"|"week"|"month"|"alltime", limit: 10, showAmount: true, title: "Top Doadores", textColor: "#FFFFFF", accentColor: "#8B5CF6", backgroundColor: "rgba(0,0,0,0.7)" }`.
- Fetches from `GET /api/widgets/{widgetId}/data?token={token}` which returns:
  ```json
  { "ranking": [{ "name": "Donor", "totalCents": 5000, "count": 3 }] }
  ```
- UI: numbered list with gold/silver/bronze icons for top 3, donor name, formatted amount.
- Auto-refresh every 30 seconds.
- Framer Motion staggered list animation on update.

### 7. QR Code Widget

Create `src/components/widgets/QrCodeWidget.tsx`:

- Config: `{ size: 300, fgColor: "#FFFFFF", bgColor: "transparent", showLabel: true, label: "Doe aqui!" }`.
- Generate QR code pointing to `https://livecripto.com/{username}`.
- Use `qrcode` package: `npm install qrcode @types/qrcode`.
- Render as canvas or SVG. Label text below QR code.
- Static render — no polling needed.

### 8. Recent Donations Widget

Create `src/components/widgets/RecentWidget.tsx`:

- Config: `{ limit: 10, showMessage: true, showAmount: true, scrollSpeed: "normal", textColor: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.5)" }`.
- Scrolling list of recent donations (name, amount, message snippet max 50 chars).
- Auto-refresh every 10 seconds.
- Framer Motion: new items slide in from top with `AnimatePresence`.

### 9. Marathon Timer Widget

Create `src/components/widgets/MarathonWidget.tsx`:

- Displays large countdown: `HH:MM:SS` format, centered.
- Config: `{ fontSize: 72, textColor: "#FFFFFF", bgColor: "rgba(0,0,0,0.5)", showLabel: true, label: "MARATONA" }`.
- Client-side countdown using `setInterval(1000)`.
- Fetches marathon state every 10s from data API to sync.
- When donation arrives, backend extends `endsAt` by `addMinutesPer` minutes per `addThreshold` cents in the donation amount (e.g. R$15 donation with threshold R$5 adds 3 minutes).
- Show "+X min" floating animation when time is added.
- When timer hits 0: show "MARATONA ENCERRADA!" with celebration.

Marathon control API:
- `POST /api/widgets/[widgetId]/marathon/start` — set `endsAt = now + baseMinutes`.
- `POST /api/widgets/[widgetId]/marathon/pause` — store remaining seconds, set `isPaused=true`.
- `POST /api/widgets/[widgetId]/marathon/resume` — set `endsAt = now + remainingSeconds`, `isPaused=false`.
- `POST /api/widgets/[widgetId]/marathon/add-time` — body `{ minutes: number }`, extend `endsAt`.

### 10. Video Widget

Create `src/components/widgets/VideoWidget.tsx`:

- Config: `{ maxDuration: 300, minAmountCents: 2000, autoPlay: true }`.
- Donors submit YouTube URLs with donations (add `videoUrl` field to donation form when streamer has video widget).
- Widget loads YouTube IFrame Player API (`<script src="https://www.youtube.com/iframe_api">`).
- Queue of video requests. Plays one at a time.
- Shows: current video title, requester name, queue count.
- Skip/remove via remote controls (Phase 8).

### 11. Music Widget

Create `src/components/widgets/MusicWidget.tsx`:

- Config: `{ maxDuration: 240, minAmountCents: 1000, autoPlay: true, showQueue: true }`.
- Similar to video but audio-only display.
- "Now playing" bar: song title, artist (from YouTube title parsing), requester name, progress bar.
- Queue list below (optional via config).
- Uses YouTube IFrame API with `playerVars: { controls: 0 }` and small/hidden video.

### 12. Widget Data API

Create `src/app/api/widgets/[widgetId]/data/route.ts`:

- `GET` with `?token={token}` for authentication.
- Returns data based on widget type:
  - **alerts**: `{ donations: Donation[] }` (new since last fetch, using `?since=` cursor).
  - **ranking**: `{ ranking: { name, totalCents, count }[] }` aggregated by period.
  - **recent**: `{ donations: { name, amountCents, message, createdAt }[] }`.
  - **marathon**: `{ endsAt, isPaused, remainingOnPause }`.
  - **video/music**: `{ queue: { videoUrl, donorName, amountCents }[] }`.

## Dependencies

- `qrcode` — QR code generation: `npm install qrcode @types/qrcode`
- YouTube IFrame API — loaded via script tag in video/music widgets, no package needed.
- Framer Motion — already installed.
- All other deps already in project.

## Acceptance Criteria

- [ ] Streamer can create and manage multiple widgets of different types
- [ ] Each widget has a unique URL with token-based authentication
- [ ] Invalid or missing token shows "Widget nao encontrado" on transparent bg
- [ ] Alerts widget renders donation alerts with configurable styling and animations
- [ ] Ranking widget shows top donors by period (today/week/month/alltime) with auto-refresh
- [ ] QR code widget generates scannable QR code linking to donation page
- [ ] Recent donations widget shows scrolling list with Framer Motion animations
- [ ] Marathon timer extends with qualifying donations and shows countdown
- [ ] Marathon can be started, paused, resumed, and manually adjusted
- [ ] Video widget plays YouTube videos submitted by donors in queue
- [ ] Music widget plays song requests with "now playing" display
- [ ] All widgets have transparent backgrounds suitable for OBS browser source
- [ ] Token rotation generates new token and invalidates old widget URL
- [ ] Widget config can be customized per widget instance
- [ ] Dashboard shows all widgets in a grid with quick actions
