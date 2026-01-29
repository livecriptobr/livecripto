# Phase 9 — Vaquinhas, Rewards & Charity

## Context

LivePix offers three community features: Vaquinhas (crowdfunding goals — e.g. "New PC fund" with progress bar), Recompensas (rewards/perks for donors at milestone amounts), and Ações Solidárias (charity campaigns where a percentage of donations goes to a cause). LiveCripto has none of these features. The dashboard is at `src/app/(dashboard)/dashboard/` and the public donation page is at `src/app/(public)/[username]/page.tsx`.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), Framer Motion, Bunny CDN.

## Objective

Implement crowdfunding goals with progress tracking, donor rewards at donation tiers, and charity campaigns, all integrated into the donation flow and displayable on OBS overlay widgets.

## Tasks

### 1. Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model Goal {
  id              String             @id @default(cuid())
  userId          String
  user            User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  title           String             // max 200 chars, e.g. "PC Novo", "Viagem TwitchCon"
  description     String?            @db.Text
  targetCents     Int                // goal amount in cents
  currentCents    Int                @default(0)
  imageUrl        String?            // cover image (Bunny CDN)
  deadline        DateTime?          // optional deadline
  isActive        Boolean            @default(true)
  showOnDonation  Boolean            @default(true)
  showOnOverlay   Boolean            @default(true)
  type            String             @default("personal") // "personal" | "charity"
  charityName     String?            // e.g. "Instituto Criança Feliz"
  charityPercent  Int?               // 1-100, percentage for charity
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  rewards         GoalReward[]
  contributions   GoalContribution[]

  @@index([userId])
  @@index([userId, isActive])
}

model GoalContribution {
  id          String   @id @default(cuid())
  goalId      String
  goal        Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  donationId  String
  donorName   String
  amountCents Int
  createdAt   DateTime @default(now())

  @@index([goalId])
  @@index([donationId])
}

model GoalReward {
  id             String        @id @default(cuid())
  goalId         String
  goal           Goal          @relation(fields: [goalId], references: [id], onDelete: Cascade)
  title          String        // e.g. "Menção na live", "Wallpaper exclusivo"
  description    String?
  thresholdCents Int           // min donation to unlock, e.g. 1000 = R$10
  type           String        @default("mention") // "mention" | "digital_download" | "custom"
  downloadUrl    String?       // Bunny CDN URL for digital rewards
  claimedCount   Int           @default(0)
  maxClaims      Int?          // null = unlimited
  isActive       Boolean       @default(true)
  sortOrder      Int           @default(0)
  claims         RewardClaim[]

  @@index([goalId])
}

model RewardClaim {
  id         String     @id @default(cuid())
  rewardId   String
  reward     GoalReward @relation(fields: [rewardId], references: [id], onDelete: Cascade)
  donationId String
  donorName  String
  donorEmail String?    // for digital reward delivery
  status     String     @default("pending") // "pending" | "delivered" | "expired"
  claimedAt  DateTime   @default(now())

  @@index([rewardId])
  @@index([donationId])
}
```

Add to `Donation` model:
```prisma
model Donation {
  // ... existing fields
  goalId String? // which goal this donation contributes to
}
```

Run `npx prisma migrate dev --name add_goals_rewards`.

### 2. Goals CRUD API

Create `src/app/api/goals/route.ts`:

- `GET /api/goals` — list goals for authenticated user. Query: `?active=true&type=personal`.
- `POST /api/goals` — create goal. Body:
  ```json
  {
    "title": "string (max 200)",
    "description": "string (optional)",
    "targetCents": 100000,
    "deadline": "2024-12-31T23:59:59Z (optional)",
    "imageUrl": "string (optional)",
    "type": "personal | charity",
    "charityName": "string (if charity)",
    "charityPercent": 50,
    "showOnDonation": true,
    "showOnOverlay": true
  }
  ```
  Validate: `targetCents > 0`, `charityPercent` 1-100 if type=charity, title max 200 chars.

Create `src/app/api/goals/[goalId]/route.ts`:

- `GET` — get goal with rewards, progress, contributor count. **Public** (for donation page and widget).
- `PATCH` — update goal fields (auth required).
- `DELETE` — delete goal and associated rewards/contributions (auth required).

### 3. Goal Image Upload

Create `src/app/api/upload/goal-image/route.ts`:

- Accept JPEG/PNG/WebP, max 5MB.
- Resize to max 800x600 using `sharp`.
- Upload to Bunny CDN: `/goals/{goalId}.webp`.
- Return `{ url: string }`.

### 4. Rewards CRUD API

Create `src/app/api/goals/[goalId]/rewards/route.ts`:

- `GET` — list rewards for a goal.
- `POST` — add reward. Body: `{ title, description?, thresholdCents, type, maxClaims? }`.
- If type `"digital_download"`: separate upload endpoint for the file.

Create `src/app/api/goals/[goalId]/rewards/[rewardId]/route.ts`:

- `PATCH` — update reward.
- `DELETE` — delete reward.

### 5. Goal Dashboard Page

Create `src/app/(dashboard)/dashboard/goals/page.tsx`:

**Active goals section**:
- Grid of goal cards, each showing:
  - Cover image (or placeholder gradient).
  - Title, type badge ("Pessoal" / "Ação Solidária" with heart icon).
  - Progress bar: animated fill, `R$ X / R$ Y` text, percentage.
  - Deadline countdown (if set): "Faltam X dias".
  - Contributor count.
  - Actions: Edit, Rewards, Contributors, Deactivate.

**"Criar Meta" button**: opens form with:
- Title, description textarea, target amount input.
- Type toggle: Pessoal / Ação Solidária.
- If charity: charity name input, percentage slider (10%-100%).
- Image upload with preview.
- Deadline date picker (optional).
- Show on donation page toggle, show on overlay toggle.

**Completed goals section**: collapsed list with final stats.

### 6. Rewards Management Page

Create `src/app/(dashboard)/dashboard/goals/[goalId]/rewards/page.tsx` (or inline in goal edit modal):

- List of rewards sorted by `thresholdCents` ascending.
- Each reward card: title, "A partir de R$ X", type badge, claims count / max claims.
- **Add reward** form:
  - Title input.
  - Threshold amount input ("Valor mínimo da doação").
  - Type selector: Menção na live, Download digital, Personalizado.
  - If digital: file upload (PDF, image, ZIP — max 50MB via Bunny CDN).
  - Max claims input (optional, empty = unlimited).
  - Description textarea.
- Drag to reorder (`sortOrder`).
- **Claims tab**: table of all claims for this goal's rewards: donor name, reward title, amount donated, status, date. "Marcar como entregue" button.

### 7. Donation Flow Integration

Update `src/app/(public)/[username]/page.tsx`:

- Fetch active goals for streamer: `GET /api/users/[username]/goals` (new public endpoint).
- **Display goals section** on donation page (before or after donation form):
  - Goal cards with image, title, progress bar, deadline.
  - If charity: show charity badge and "X% vai para [charityName]".
  - If rewards: show reward tiers below goal ("Doe R$10+ e ganhe: Menção na live").
- **Goal selection**: If multiple active goals, let donor choose which to contribute to (radio buttons or clickable cards). Default: most recent active goal.
- After amount input, show which rewards the donor qualifies for at that amount.

**On donation creation**:
```typescript
// In donation processing (webhook or API):
if (donation.goalId) {
  // 1. Create contribution
  await prisma.goalContribution.create({
    data: {
      goalId: donation.goalId,
      donationId: donation.id,
      donorName: donation.donorName,
      amountCents: donation.amountCents,
    },
  });

  // 2. Increment goal progress atomically
  await prisma.goal.update({
    where: { id: donation.goalId },
    data: { currentCents: { increment: donation.amountCents } },
  });

  // 3. Check and create reward claims
  const rewards = await prisma.goalReward.findMany({
    where: {
      goalId: donation.goalId,
      isActive: true,
      thresholdCents: { lte: donation.amountCents },
    },
  });

  for (const reward of rewards) {
    // Check max claims
    if (reward.maxClaims && reward.claimedCount >= reward.maxClaims) continue;

    await prisma.rewardClaim.create({
      data: {
        rewardId: reward.id,
        donationId: donation.id,
        donorName: donation.donorName,
        donorEmail: donation.donorEmail,
      },
    });

    await prisma.goalReward.update({
      where: { id: reward.id },
      data: { claimedCount: { increment: 1 } },
    });
  }

  // 4. Check if goal is now completed
  const goal = await prisma.goal.findUnique({ where: { id: donation.goalId } });
  if (goal && goal.currentCents >= goal.targetCents) {
    // Create notification
    await prisma.notification.create({
      data: {
        userId: goal.userId,
        type: 'goal_reached',
        title: 'Meta alcançada!',
        body: `A meta "${goal.title}" atingiu R$ ${(goal.targetCents / 100).toFixed(2)}!`,
        metadata: { goalId: goal.id },
      },
    });
    // Goal stays active (can continue collecting) unless streamer deactivates
  }
}
```

### 8. Goal Progress Widget (OBS)

Create `src/components/widgets/GoalWidget.tsx` (register as widget type `"goal"` in Phase 3 widget system):

- Config:
  ```json
  {
    "goalId": "clxyz...",
    "showTitle": true,
    "showAmount": true,
    "showPercentage": true,
    "barColor": "#8B5CF6",
    "barBgColor": "rgba(255,255,255,0.2)",
    "textColor": "#FFFFFF",
    "fontSize": 18,
    "layout": "horizontal" | "vertical"
  }
  ```
- **Horizontal layout**: Title left, progress bar center, amount/percentage right.
- **Vertical layout**: Title top, progress bar below, amount below bar.
- Auto-refresh every 10 seconds from widget data API.
- Framer Motion: `layout` prop on bar fill for smooth width animation.
- **Goal reached animation**: when `currentCents >= targetCents`, show confetti particles and flash effect. Use `canvas-confetti` or CSS animation.

Widget data endpoint returns:
```json
{
  "goal": {
    "title": "PC Novo",
    "targetCents": 500000,
    "currentCents": 325000,
    "percentage": 65,
    "contributorCount": 42,
    "isCompleted": false
  }
}
```

### 9. Charity Campaigns Page

Create `src/app/(dashboard)/dashboard/charity/page.tsx`:

- Filtered view of goals where `type="charity"`.
- Same layout as goals page but with charity-specific info:
  - Charity name prominently displayed.
  - Split display: "R$ X para você / R$ Y para [charityName]" based on percentage.
  - Total raised for charity across all campaigns.
- "Criar Ação Solidária" button: opens goal creation form pre-set to `type="charity"`.

### 10. Public Goals Display

Create `src/app/api/users/[username]/goals/route.ts`:

- Public endpoint returning active goals for a streamer.
- Returns: `[{ id, title, description, targetCents, currentCents, imageUrl, deadline, type, charityName, charityPercent, rewards: [{ title, thresholdCents, type }] }]`.
- Sorted by `createdAt` desc.

### 11. Goal Expiration Logic

In the goal fetch endpoints and donation processing:

```typescript
// Check for expired goals
const now = new Date();
await prisma.goal.updateMany({
  where: {
    userId,
    isActive: true,
    deadline: { lt: now },
  },
  data: { isActive: false },
});
```

When a goal expires:
- Auto-deactivate.
- Create notification: "A meta '[title]' expirou. Arrecadado: R$ X de R$ Y."
- Existing contributions are kept for records.

## Dependencies

- `sharp` — for goal image resizing (already needed from Phase 0).
- `canvas-confetti` (optional) — for goal completion celebration in widget: `npm install canvas-confetti`.
- Bunny CDN — for goal images and digital reward files.
- Framer Motion — already installed.

## Acceptance Criteria

- [ ] Streamer can create personal crowdfunding goals with title, target amount, image, and optional deadline
- [ ] Streamer can create charity campaigns with charity name and percentage split
- [ ] Goals display on the public donation page with animated progress bars
- [ ] Donors can choose which goal to contribute to during donation
- [ ] Donations correctly increment goal progress atomically
- [ ] Goal OBS widget shows real-time progress with smooth animations
- [ ] Celebration animation triggers when a goal reaches its target
- [ ] Streamer can add reward tiers to goals with donation thresholds
- [ ] Donors automatically receive reward claims when their donation meets a tier threshold
- [ ] Digital download rewards can be uploaded and delivered via claim
- [ ] Streamer can view and manage reward claims (mark as delivered)
- [ ] Charity campaigns display split amounts (streamer vs. charity)
- [ ] Goals auto-expire and deactivate when deadline passes
- [ ] Goal dashboard shows active, completed, and expired goals with stats
- [ ] Public donation page shows goals with reward tier previews
- [ ] Notifications are sent when goals are reached or expire
