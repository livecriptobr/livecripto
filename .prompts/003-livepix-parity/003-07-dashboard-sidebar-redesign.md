# Phase 7 — Dashboard & Sidebar Redesign

## Context

LivePix has a polished dark navy sidebar with: user avatar + name at top, collapsible sections (Carteira, Incentivos, Configurações with submenus), main navigation items (Enquetes, Vaquinhas, Ações Solidárias, Recompensas, Planos, Widgets), notification bell, and a "PULAR ALERTA" skip button in the header. LiveCripto's current sidebar is basic with flat navigation links. The dashboard layout is at `src/app/(dashboard)/layout.tsx` and sidebar component is in `src/components/`.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), Clerk auth, Framer Motion.

## Objective

Completely redesign the dashboard sidebar and header to match LivePix's structure with collapsible sections, dark navy theme, user avatar, notification bell, responsive mobile support, and a redesigned dashboard home page.

## Tasks

### 1. Sidebar Component

Create `src/components/dashboard/Sidebar.tsx`:

**Navigation structure:**

```typescript
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    name: 'Carteira',
    icon: Wallet,
    children: [
      { name: 'Sacar', href: '/dashboard/wallet/withdraw' },
      { name: 'Histórico', href: '/dashboard/history' },
      { name: 'Recebíveis', href: '/dashboard/wallet/receivables' },
      { name: 'Saques', href: '/dashboard/payouts' },
      { name: 'Limites', href: '/dashboard/wallet/limits' },
    ],
  },
  {
    name: 'Incentivos',
    icon: Sparkles,
    children: [
      { name: 'Mensagens', href: '/dashboard/incentives/messages' },
      { name: 'Mídia', href: '/dashboard/incentives/media' },
      { name: 'Configurações', href: '/dashboard/settings/incentives' },
    ],
  },
  { name: 'Enquetes', href: '/dashboard/polls', icon: BarChart3 },
  { name: 'Vaquinhas', href: '/dashboard/goals', icon: Target },
  { name: 'Ações Solidárias', href: '/dashboard/charity', icon: Heart },
  { name: 'Recompensas', href: '/dashboard/rewards', icon: Gift },
  { name: 'Planos', href: '/dashboard/plans', icon: CreditCard },
  { name: 'Widgets', href: '/dashboard/widgets', icon: Layout },
  {
    name: 'Configurações',
    icon: Settings,
    children: [
      { name: 'Perfil', href: '/dashboard/profile' },
      { name: 'Incentivos', href: '/dashboard/settings/incentives' },
      { name: 'Verificações', href: '/dashboard/settings/verifications' },
      { name: 'Conexões', href: '/dashboard/settings/connections' },
      { name: 'Moderação', href: '/dashboard/settings/moderation' },
      { name: 'Controle Remoto', href: '/dashboard/controls' },
      { name: 'Segurança', href: '/dashboard/settings/security' },
      { name: 'Minha Conta', href: '/dashboard/settings/account' },
    ],
  },
];
```

**Styling:**
```css
/* Sidebar base */
background: #1a1f36; /* dark navy */
width: 260px; /* expanded */
/* Collapsed: 64px (icon only) */

/* Nav item default */
color: #94A3B8; /* slate-400 */
padding: 8px 16px;
border-radius: 8px;
transition: all 150ms;

/* Nav item hover */
color: #F1F5F9; /* slate-100 */
background: rgba(255, 255, 255, 0.05);

/* Nav item active */
color: #F1F5F9;
background: rgba(139, 92, 246, 0.1); /* violet tint */
border-left: 3px solid #8B5CF6; /* violet-500 */
```

**Features:**
- User avatar + name + `@username` at top. Avatar from Clerk `useUser()` or custom `avatarUrl`.
- Collapsible sections use Framer Motion `AnimatePresence` with `height: auto` animation.
- Open/closed state stored in `localStorage` key `sidebar-sections`.
- Active route detection via `usePathname()` from `next/navigation`.
- Nested items: 24px left indent, subtle left border.
- Bottom: user menu with "Sair" (logout) button.

### 2. Dashboard Layout

Rewrite `src/app/(dashboard)/layout.tsx`:

```tsx
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}
```

Use a client component wrapper for sidebar state (open/closed, mobile toggle).

### 3. Header Component

Create `src/components/dashboard/Header.tsx`:

- **Left**: Breadcrumb navigation generated from pathname:
  ```
  Dashboard > Carteira > Histórico
  ```
  Map route segments to Portuguese labels.

- **Right** (flex row, gap-3):
  - **"PULAR ALERTA"** button: Red/orange background, white text, small. On click: `POST /api/alerts/skip` (sends skip command to overlay via SSE from Phase 8).
  - **Notification bell**: `<NotificationBell />` component.
  - **User avatar dropdown**: Small avatar circle, click opens dropdown with: "Minha Conta", "Configurações", divider, "Sair".

- **Mobile** (< 1024px): Add hamburger menu button (three lines) on the left that toggles sidebar.

### 4. Mobile Responsive Sidebar

- `< 1024px`: Sidebar hidden by default.
- Hamburger button in header toggles sidebar visibility.
- When open on mobile: sidebar slides in from left (Framer Motion `x: -260 → 0`), dark backdrop overlay covers main content.
- Click backdrop or any nav link → closes sidebar.
- Store mobile open state in React state (not localStorage).

```tsx
// Mobile overlay
{isMobileOpen && (
  <motion.div
    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={() => setMobileOpen(false)}
  />
)}
```

### 5. Dashboard Home Page Redesign

Redesign `src/app/(dashboard)/dashboard/page.tsx`:

**Stats cards row** (grid 2x2 on mobile, 4 columns on desktop):

```tsx
const stats = [
  { label: 'Total Recebido', value: formatBRL(totalReceived), icon: DollarSign, color: 'text-green-400' },
  { label: 'Saldo Disponível', value: formatBRL(balance), icon: Wallet, color: 'text-violet-400' },
  { label: 'Hoje', value: formatBRL(today), subtext: `${todayCount} doações`, icon: Calendar, color: 'text-blue-400' },
  { label: 'Este Mês', value: formatBRL(thisMonth), subtext: `${monthCount} doações`, icon: TrendingUp, color: 'text-amber-400' },
];
```

Each card: dark card (`bg-slate-900 border border-slate-800`), icon, label, large value, optional subtext.

**Recent donations** section (below stats):
- Table/list of last 10 donations: time ago ("há 5 min"), donor name, amount (green), payment method icon, message (truncated 60 chars).
- "Ver histórico completo" link at bottom → `/dashboard/history`.

**Quick actions** section (grid of action cards):
- "Copiar link de doação" — copies `https://livecripto.com/{username}`, shows toast "Link copiado!".
- "Criar enquete" → `/dashboard/polls` with `?create=true` to auto-open form.
- "Solicitar saque" → `/dashboard/wallet/withdraw`.
- "Configurar alertas" → `/dashboard/settings/incentives`.
Each: icon, title, description, onClick or href.

**API**: `GET /api/dashboard/stats` — returns `{ totalReceived, balance, todayTotal, todayCount, monthTotal, monthCount, recentDonations[] }`.

### 6. Notification System

**Schema** — add to `prisma/schema.prisma`:

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // "donation" | "withdrawal" | "verification" | "system" | "goal_reached"
  title     String
  body      String
  isRead    Boolean  @default(false)
  metadata  Json?    // { donationId?, amount?, etc }
  createdAt DateTime @default(now())

  @@index([userId, isRead])
  @@index([userId, createdAt])
}
```

Run `npx prisma migrate dev --name add_notifications`.

**API** — Create `src/app/api/notifications/route.ts`:
- `GET ?unread=true&limit=10` — list notifications for authenticated user.
- `PATCH /api/notifications/read-all` — mark all as read.

Create `src/app/api/notifications/[id]/route.ts`:
- `PATCH { isRead: true }` — mark single notification as read.

**Component** — Create `src/components/dashboard/NotificationBell.tsx`:

```tsx
'use client';
export function NotificationBell() {
  const { data } = useSWR('/api/notifications?unread=true&limit=10');
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button onClick={toggleDropdown}>
        <BellIcon className="w-5 h-5 text-slate-400 hover:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {/* Dropdown panel with notification list */}
    </div>
  );
}
```

- Dropdown: max-height 400px, scrollable, each notification shows title + time ago.
- Click notification: mark as read, navigate if applicable.
- Refresh every 30 seconds via SWR `refreshInterval`.

### 7. Sidebar Collapse (Desktop)

- Add collapse toggle button at bottom of sidebar (chevron icon).
- Collapsed state: 64px wide, show only icons (no text), tooltips on hover.
- Collapsible sections hidden when sidebar is collapsed.
- Store collapsed state in `localStorage` key `sidebar-collapsed`.
- Smooth width transition: `transition-all duration-200`.

### 8. Route Mapping Reference

All sidebar routes with their page file paths:

| Route | File Path |
|---|---|
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` |
| `/dashboard/wallet/withdraw` | `src/app/(dashboard)/dashboard/wallet/withdraw/page.tsx` |
| `/dashboard/history` | `src/app/(dashboard)/dashboard/history/page.tsx` |
| `/dashboard/wallet/receivables` | `src/app/(dashboard)/dashboard/wallet/receivables/page.tsx` |
| `/dashboard/payouts` | `src/app/(dashboard)/dashboard/payouts/page.tsx` |
| `/dashboard/wallet/limits` | `src/app/(dashboard)/dashboard/wallet/limits/page.tsx` |
| `/dashboard/incentives/messages` | `src/app/(dashboard)/dashboard/incentives/messages/page.tsx` |
| `/dashboard/incentives/media` | `src/app/(dashboard)/dashboard/incentives/media/page.tsx` |
| `/dashboard/polls` | `src/app/(dashboard)/dashboard/polls/page.tsx` |
| `/dashboard/goals` | `src/app/(dashboard)/dashboard/goals/page.tsx` |
| `/dashboard/charity` | `src/app/(dashboard)/dashboard/charity/page.tsx` |
| `/dashboard/rewards` | `src/app/(dashboard)/dashboard/rewards/page.tsx` |
| `/dashboard/plans` | `src/app/(dashboard)/dashboard/plans/page.tsx` |
| `/dashboard/widgets` | `src/app/(dashboard)/dashboard/widgets/page.tsx` |
| `/dashboard/profile` | `src/app/(dashboard)/dashboard/profile/page.tsx` |
| `/dashboard/settings/incentives` | `src/app/(dashboard)/dashboard/settings/incentives/page.tsx` |
| `/dashboard/settings/verifications` | `src/app/(dashboard)/dashboard/settings/verifications/page.tsx` |
| `/dashboard/settings/connections` | `src/app/(dashboard)/dashboard/settings/connections/page.tsx` |
| `/dashboard/settings/moderation` | `src/app/(dashboard)/dashboard/settings/moderation/page.tsx` |
| `/dashboard/controls` | `src/app/(dashboard)/dashboard/controls/page.tsx` |
| `/dashboard/settings/security` | `src/app/(dashboard)/dashboard/settings/security/page.tsx` |
| `/dashboard/settings/account` | `src/app/(dashboard)/dashboard/settings/account/page.tsx` |

Create placeholder pages for routes that don't exist yet: simple page with title and "Em breve" message.

## Dependencies

- Framer Motion — already installed, for sidebar animations.
- `lucide-react` — for icons (or any icon library already in project). `npm install lucide-react` if not present.
- `swr` — for data fetching in notification bell. `npm install swr` if not present.
- Clerk `useUser()` — for avatar and name display.
- `recharts` (optional) — for dashboard chart. `npm install recharts` if adding chart.

## Acceptance Criteria

- [ ] Sidebar has dark navy (#1a1f36) background matching LivePix design
- [ ] User avatar, display name, and @username shown at top of sidebar
- [ ] Collapsible sections (Carteira, Incentivos, Configurações) expand/collapse with smooth animation
- [ ] Active route is highlighted with violet accent and left border indicator
- [ ] Sidebar can collapse to icon-only mode (64px) on desktop with toggle button
- [ ] Mobile (< 1024px): sidebar is hidden, hamburger button opens slide-in overlay
- [ ] Mobile sidebar closes on navigation or backdrop click
- [ ] Header shows breadcrumb navigation derived from current route
- [ ] Header has "PULAR ALERTA" button that sends skip command to overlay
- [ ] Notification bell shows unread count badge and dropdown list
- [ ] Dashboard home page shows 4 stats cards with key metrics
- [ ] Dashboard shows recent donations list with "Ver histórico" link
- [ ] Dashboard has quick action cards (copy link, create poll, withdraw, configure alerts)
- [ ] All sidebar routes navigate correctly
- [ ] Placeholder pages exist for routes not yet implemented
- [ ] Sidebar section open/close state persists in localStorage
