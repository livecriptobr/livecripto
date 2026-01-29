# Phase 8 — Remote Controls / StreamDeck

## Context

LivePix has a remote controls page with 3 sections (Alerts, Videos, Music), each with hotkey-bindable actions: toggle autoplay, pause/resume, skip, replay, mute, volume up/down, clear queue. It also has a "Trocar Token" (rotate token) button. LiveCripto currently has a basic controls page at `src/app/(dashboard)/dashboard/controls/page.tsx` with limited functionality.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), Framer Motion.

## Objective

Build a full remote control system with three control sections (alerts, video, music), keyboard shortcuts, real-time communication to OBS overlay widgets via SSE, and StreamDeck-compatible HTTP endpoints.

## Tasks

### 1. Control Command Types

Create `src/lib/control-commands.ts`:

```typescript
export type ControlSection = 'alerts' | 'video' | 'music';

export type ControlAction =
  | 'toggle_autoplay'
  | 'pause'
  | 'resume'
  | 'skip'
  | 'replay'
  | 'mute'
  | 'unmute'
  | 'volume_up'
  | 'volume_down'
  | 'clear_queue';

export interface ControlCommand {
  section: ControlSection;
  action: ControlAction;
  value?: number; // e.g. volume level 0-100
  timestamp: number;
}

export interface ControlState {
  alerts: SectionState;
  video: SectionState;
  music: SectionState;
}

export interface SectionState {
  autoplay: boolean;
  paused: boolean;
  muted: boolean;
  volume: number; // 0-100
  queueSize: number;
}

export const DEFAULT_STATE: ControlState = {
  alerts: { autoplay: true, paused: false, muted: false, volume: 100, queueSize: 0 },
  video: { autoplay: true, paused: false, muted: false, volume: 80, queueSize: 0 },
  music: { autoplay: true, paused: false, muted: false, volume: 60, queueSize: 0 },
};
```

### 2. Real-Time Control Channel (SSE)

Create `src/app/api/controls/stream/route.ts`:

```typescript
// In-memory broadcast store (works for single-instance deployment)
const channels = new Map<string, Set<ReadableStreamDefaultController>>();

export function broadcastToUser(userId: string, command: ControlCommand) {
  const controllers = channels.get(userId);
  if (controllers) {
    const data = `data: ${JSON.stringify(command)}\n\n`;
    const encoded = new TextEncoder().encode(data);
    controllers.forEach(ctrl => {
      try { ctrl.enqueue(encoded); } catch { /* client disconnected */ }
    });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  // Validate token: find widget by token, get userId
  const widget = await prisma.widget.findUnique({ where: { token: token! } });
  if (!widget) return new Response('Unauthorized', { status: 401 });

  const userId = widget.userId;

  const stream = new ReadableStream({
    start(controller) {
      if (!channels.has(userId)) channels.set(userId, new Set());
      channels.get(userId)!.add(controller);

      // Send initial state
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'init', state: DEFAULT_STATE })}\n\n`));
    },
    cancel() {
      // Cleanup on disconnect
      const set = channels.get(userId);
      // Remove this controller from set
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

Note: For multi-instance deployment (e.g., Vercel serverless), replace in-memory Map with Redis pub/sub or Upstash Redis.

### 3. Control Command API

Create `src/app/api/controls/command/route.ts`:

```typescript
import { broadcastToUser } from '../stream/route';

export async function POST(req: Request) {
  // Auth: Clerk session OR API key header
  const userId = await getAuthenticatedUserId(req); // implement to check Clerk or API key
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const command: ControlCommand = {
    section: body.section,
    action: body.action,
    value: body.value,
    timestamp: Date.now(),
  };

  // Validate section and action
  const validSections = ['alerts', 'video', 'music'];
  const validActions = ['toggle_autoplay', 'pause', 'resume', 'skip', 'replay', 'mute', 'unmute', 'volume_up', 'volume_down', 'clear_queue'];
  if (!validSections.includes(command.section) || !validActions.includes(command.action)) {
    return NextResponse.json({ error: 'Invalid command' }, { status: 400 });
  }

  broadcastToUser(userId, command);
  return NextResponse.json({ success: true });
}
```

### 4. Overlay Integration

Update overlay widgets to listen for control commands.

In `src/components/widgets/AlertsWidget.tsx` (and VideoWidget, MusicWidget):

```typescript
useEffect(() => {
  const eventSource = new EventSource(`/api/controls/stream?token=${widgetToken}`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'init') {
      setState(data.state.alerts); // or video/music depending on widget
      return;
    }

    const command: ControlCommand = data;
    if (command.section !== 'alerts') return; // filter by section

    switch (command.action) {
      case 'toggle_autoplay': setAutoplay(prev => !prev); break;
      case 'pause': setPaused(true); break;
      case 'resume': setPaused(false); break;
      case 'skip': skipCurrent(); break;
      case 'replay': replayLast(); break;
      case 'mute': setMuted(true); break;
      case 'unmute': setMuted(false); break;
      case 'volume_up': setVolume(prev => Math.min(100, prev + 10)); break;
      case 'volume_down': setVolume(prev => Math.max(0, prev - 10)); break;
      case 'clear_queue': clearQueue(); break;
    }
  };

  return () => eventSource.close();
}, [widgetToken]);
```

### 5. Remote Controls Page Redesign

Redesign `src/app/(dashboard)/dashboard/controls/page.tsx`:

**Layout**: 3 sections side-by-side on desktop, tabs on mobile.

Each section has:
- Section header with icon and title.
- Status row: Autoplay (on/off badge), Volume (bar), Queue (count), Muted (badge).
- **Action buttons grid** (2 columns):

```tsx
const sectionActions = [
  { action: 'toggle_autoplay', label: 'Autoplay', icon: PlayCircle, activeIcon: PauseCircle },
  { action: 'pause', label: 'Pausar', icon: Pause },
  { action: 'resume', label: 'Continuar', icon: Play },
  { action: 'skip', label: 'Pular', icon: SkipForward },
  { action: 'replay', label: 'Repetir', icon: RotateCcw },
  { action: 'mute', label: 'Mutar', icon: VolumeX },
  { action: 'volume_up', label: 'Volume +', icon: Volume2 },
  { action: 'volume_down', label: 'Volume -', icon: Volume1 },
  { action: 'clear_queue', label: 'Limpar Fila', icon: Trash2, destructive: true },
];
```

Each button:
- Dark card style (`bg-slate-800 hover:bg-slate-700`).
- Icon + label.
- Click handler: `POST /api/controls/command` with `{ section, action }`.
- Framer Motion: `whileTap={{ scale: 0.95 }}` for feedback.
- Destructive actions (clear queue): red tint, confirmation before executing.

**Keyboard shortcut hints**: small gray text below each button showing the bound key.

**Token section** at bottom:
- "Trocar Token" button with confirmation: "Isso invalidará todas as URLs dos seus widgets. Você precisará reconfigurá-los no OBS."
- Calls `POST /api/widgets/rotate-all-tokens` which rotates tokens for all user's widgets.

### 6. Keyboard Shortcut System

Create `src/hooks/useKeyboardShortcuts.ts`:

```typescript
export interface ShortcutMap {
  [key: string]: { section: ControlSection; action: ControlAction };
}

const DEFAULT_SHORTCUTS: ShortcutMap = {
  '1': { section: 'alerts', action: 'toggle_autoplay' },
  'q': { section: 'alerts', action: 'pause' },
  'w': { section: 'alerts', action: 'resume' },
  'e': { section: 'alerts', action: 'skip' },
  'r': { section: 'alerts', action: 'replay' },
  'm': { section: 'alerts', action: 'mute' },
  '=': { section: 'alerts', action: 'volume_up' },
  '-': { section: 'alerts', action: 'volume_down' },
  // Shift+key for video section
  'Shift+1': { section: 'video', action: 'toggle_autoplay' },
  'Shift+q': { section: 'video', action: 'pause' },
  // ... etc
  // Ctrl+key for music section
  'Ctrl+1': { section: 'music', action: 'toggle_autoplay' },
  // ... etc
};

export function useKeyboardShortcuts(onCommand: (section: ControlSection, action: ControlAction) => void) {
  useEffect(() => {
    const shortcuts = JSON.parse(localStorage.getItem('keyboard-shortcuts') || 'null') || DEFAULT_SHORTCUTS;

    const handler = (e: KeyboardEvent) => {
      // Build key string: "Ctrl+Shift+k"
      const key = [
        e.ctrlKey && 'Ctrl',
        e.shiftKey && 'Shift',
        e.altKey && 'Alt',
        e.key.toLowerCase(),
      ].filter(Boolean).join('+');

      const mapping = shortcuts[key];
      if (mapping) {
        e.preventDefault();
        onCommand(mapping.section, mapping.action);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCommand]);
}
```

Show on controls page: "Atalhos de teclado ativos nesta página. Pressione uma tecla para ativar."

### 7. StreamDeck HTTP Webhook

Create `src/app/api/controls/webhook/route.ts`:

```typescript
export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return NextResponse.json({ error: 'API key required' }, { status: 401 });

  // Validate API key
  const hashedKey = await bcrypt.hash(apiKey, 10); // actually, lookup by comparing
  // Better: store key prefix for lookup, then compare hash
  const apiKeyRecord = await findApiKeyByValue(apiKey);
  if (!apiKeyRecord) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

  // Update last used
  await prisma.apiKey.update({ where: { id: apiKeyRecord.id }, data: { lastUsed: new Date() } });

  const body = await req.json();
  broadcastToUser(apiKeyRecord.userId, {
    section: body.section,
    action: body.action,
    value: body.value,
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true });
}
```

**Schema** for API keys:

```prisma
model ApiKey {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  keyHash   String    // bcrypt hash
  keyPrefix String    // first 8 chars for lookup: "lc_xxxx..."
  label     String    @default("StreamDeck")
  lastUsed  DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@index([keyPrefix])
}
```

Run `npx prisma migrate dev --name add_api_keys`.

**API key management** — Create `src/app/api/controls/api-key/route.ts`:

- `POST` — generate new API key. Generate random 32-byte hex string prefixed with `lc_`. Store bcrypt hash + prefix. Return plain key (show only once).
- `GET` — list API keys for user (id, label, prefix, lastUsed, createdAt). Never return the full key.
- `DELETE { id }` — revoke API key.

**Controls page section**: "API para StreamDeck" with:
- "Gerar chave API" button.
- Show key once in a modal with copy button: "Copie esta chave. Ela não será exibida novamente."
- List existing keys: label, prefix (`lc_xxxx...`), last used, delete button.
- StreamDeck setup instructions:
  ```
  URL: https://livecripto.com/api/controls/webhook
  Método: POST
  Headers: X-API-Key: {sua_chave}
  Body: {"section": "alerts", "action": "skip"}
  ```

### 8. Rotate All Tokens

Create `src/app/api/widgets/rotate-all-tokens/route.ts`:

- `POST` — rotate tokens for ALL widgets of the authenticated user.
- Generate new `cuid()` for each widget's token.
- Return `{ widgets: [{ id, type, name, newToken }] }`.
- Controls page shows new widget URLs after rotation for easy re-configuration.

## Dependencies

- `bcrypt` — for API key hashing: `npm install bcrypt @types/bcrypt` (or use `bcryptjs` for edge compatibility).
- No other new packages. Uses native SSE, Framer Motion (already installed).
- For production multi-instance: consider `@upstash/redis` for pub/sub SSE broadcast.

## Acceptance Criteria

- [ ] Controls page has 3 sections: Alertas, Videos, Musicas
- [ ] Each section has 8+ action buttons with icons and labels
- [ ] Clicking a button sends the command via API and overlay reacts within 1 second
- [ ] SSE connection delivers commands from dashboard to overlay widgets in real-time
- [ ] Keyboard shortcuts are active on the controls page and trigger commands
- [ ] Default keyboard shortcuts are documented on the page
- [ ] StreamDeck HTTP webhook accepts commands with X-API-Key authentication
- [ ] API keys can be generated (shown once), listed, and revoked
- [ ] StreamDeck setup instructions are displayed on the controls page
- [ ] "Trocar Token" rotates all widget tokens with confirmation dialog
- [ ] After token rotation, new widget URLs are displayed for easy copying
- [ ] Status indicators on the controls page show current state per section
- [ ] Mobile layout uses tabs instead of side-by-side columns
- [ ] Destructive actions (clear queue) require confirmation
