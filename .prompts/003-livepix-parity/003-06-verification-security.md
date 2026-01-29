# Phase 6 — Account Verification & Security

## Context

LivePix requires identity verification (document upload + selfie), offers social media verification (link Twitch/YouTube accounts), has a platform verification badge system, and provides active sessions management. LiveCripto uses Clerk for authentication but has no identity verification, social media linking, or enhanced security features beyond Clerk defaults.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), Clerk auth, Bunny CDN.

## Objective

Implement identity verification (document + selfie), social media OAuth linking (Twitch, YouTube), verification status display, and a security management page leveraging Clerk's session management.

## Tasks

### 1. Schema Updates

Add to `prisma/schema.prisma`:

```prisma
model Verification {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type            String    // "identity" | "twitch" | "youtube" | "instagram"
  status          String    @default("pending") // "pending" | "reviewing" | "approved" | "rejected"
  documentUrl     String?   // front of ID
  documentBackUrl String?   // back of ID
  selfieUrl       String?   // selfie holding document
  externalId      String?   // Twitch/YouTube user ID
  externalName    String?   // Twitch/YouTube display name
  rejectionReason String?
  reviewedBy      String?   // admin user ID
  reviewedAt      DateTime?
  submittedAt     DateTime  @default(now())
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
  @@unique([userId, type])
}
```

Add to `User` model:
```prisma
model User {
  // ... existing fields
  isVerified        Boolean @default(false)
  verificationLevel String  @default("none") // "none" | "basic" | "full"
  verifications     Verification[]
}
```

Run `npx prisma migrate dev --name add_verifications`.

### 2. Document Upload API

Create `src/app/api/verification/upload-document/route.ts`:

- `POST` multipart form data with fields `documentFront` (required) and `documentBack` (optional).
- Validate: JPEG/PNG only, max 10MB each.
- Resize to max 2000px wide using `sharp` (preserve aspect ratio).
- Upload to Bunny CDN: `/verification/{userId}/doc-front.jpg`, `/verification/{userId}/doc-back.jpg`.
- Upsert `Verification` record: `type="identity"`, `status="pending"`, set `documentUrl` and `documentBackUrl`.
- Return `{ verificationId, status: "pending" }`.

### 3. Selfie Upload API

Create `src/app/api/verification/upload-selfie/route.ts`:

- `POST` multipart with `selfie` image file.
- Validate: JPEG/PNG, max 10MB.
- Resize to max 1500px wide using `sharp`.
- Upload to Bunny CDN: `/verification/{userId}/selfie.jpg`.
- Update existing identity `Verification`: set `selfieUrl`.
- If both `documentUrl` and `selfieUrl` are now present, set `status = "reviewing"`.
- Return `{ verificationId, status }`.

### 4. Social Media OAuth — Twitch

Create `src/app/api/verification/social/twitch/route.ts`:

```typescript
export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID!,
    redirect_uri: process.env.TWITCH_REDIRECT_URI!,
    response_type: 'code',
    scope: 'user:read:email',
  });
  return NextResponse.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
}
```

Create `src/app/api/verification/social/twitch/callback/route.ts`:

```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  // Exchange code for token
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      code: code!,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TWITCH_REDIRECT_URI!,
    }),
  });
  const { access_token } = await tokenRes.json();

  // Fetch Twitch user profile
  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID!,
    },
  });
  const { data } = await userRes.json();
  const twitchUser = data[0];

  // Save verification
  const userId = /* get from Clerk session */;
  await prisma.verification.upsert({
    where: { userId_type: { userId, type: 'twitch' } },
    create: {
      userId, type: 'twitch', status: 'approved',
      externalId: twitchUser.id, externalName: twitchUser.display_name,
    },
    update: {
      status: 'approved',
      externalId: twitchUser.id, externalName: twitchUser.display_name,
    },
  });

  return NextResponse.redirect('/dashboard/settings/verifications?connected=twitch');
}
```

Env vars:
```
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_REDIRECT_URI=https://livecripto.com/api/verification/social/twitch/callback
```

### 5. Social Media OAuth — YouTube

Create `src/app/api/verification/social/youtube/route.ts`:

```typescript
export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.YOUTUBE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
```

Create `src/app/api/verification/social/youtube/callback/route.ts`:
- Exchange code for token via `https://oauth2.googleapis.com/token`.
- Fetch channel info via `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`.
- Save as `Verification` type `"youtube"`, status `"approved"`.

Env vars:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=https://livecripto.com/api/verification/social/youtube/callback
```

### 6. Verification Status Page

Create `src/app/(dashboard)/dashboard/settings/verifications/page.tsx`:

- **Identity verification section**:
  - Status: badge showing Not started / Pendente / Em revisão / Aprovado / Rejeitado.
  - **Not started**: Upload forms for document front, document back (optional), selfie. Step-by-step flow:
    1. "Envie a frente do seu documento (RG, CNH ou Passaporte)"
    2. "Envie o verso (opcional para passaporte)"
    3. "Tire uma selfie segurando o documento"
  - **Pending/Reviewing**: "Estamos verificando seus documentos. Isso pode levar até 48 horas."
  - **Approved**: Green checkmark, "Identidade verificada em [date]".
  - **Rejected**: Red badge, reason text, "Reenviar documentos" button.

- **Social verifications section**:
  - **Twitch**: "Conectar Twitch" button (purple, Twitch icon). If connected: show display name, "Desconectar" button.
  - **YouTube**: "Conectar YouTube" button (red, YouTube icon). If connected: show channel name, "Desconectar" button.
  - **Instagram**: Grayed out, "Em breve" badge.

- **Verification benefits** info box:
  - "Verificação básica (identidade): Limites de saque maiores"
  - "Verificação completa (identidade + rede social): Badge verificado na página de doação"

### 7. Admin Verification Approval

Create `src/app/api/admin/verifications/route.ts`:

- `GET ?status=reviewing` — list pending identity verifications. Returns: user info, document URLs, selfie URL, submitted date.
- Auth: check Clerk user's `publicMetadata.role === 'admin'`.

Create `src/app/api/admin/verifications/[id]/route.ts`:

- `PATCH { status: "approved" | "rejected", rejectionReason?: string }`:
  - Update `Verification` record.
  - If approved: set `reviewedBy`, `reviewedAt`. Update `User.isVerified = true`, `User.verificationLevel`:
    - Has identity approval → `"basic"`.
    - Has identity + any social → `"full"`.
  - If rejected: set `rejectionReason`. User can resubmit.
  - Optionally: create notification for user.

Create `src/app/(dashboard)/admin/verifications/page.tsx`:

- Table: User, Submitted Date, Documents (thumbnail previews, click to enlarge), Status.
- Actions: "Aprovar" (green button), "Rejeitar" (red button, opens reason input modal).
- Filter: status dropdown.
- Route guard: only accessible if `user.publicMetadata.role === 'admin'`.

### 8. Security Page

Create `src/app/(dashboard)/dashboard/settings/security/page.tsx`:

Using Clerk React SDK:

- **Active sessions** section:
  - Use `useSessionList()` from `@clerk/nextjs` to list sessions.
  - Show: device/browser (from user agent), approximate location (from IP), last active time, current session badge.
  - "Encerrar sessão" button per session (calls `session.revoke()`).
  - "Encerrar todas as outras sessões" button.

- **Two-factor authentication** section:
  - Show current status: enabled/disabled.
  - "Configurar 2FA" button — uses Clerk's `<UserProfile />` component or redirect to Clerk's 2FA management URL.
  - Clerk handles TOTP setup natively.

- **Password** section (if using email/password auth):
  - "Alterar senha" button — uses Clerk's password change flow.

- **Login history**: list recent sessions with login timestamps.

### 9. Verification Badge on Public Pages

Update `src/app/(public)/[username]/page.tsx`:

```tsx
{user.isVerified && (
  <div className="inline-flex items-center gap-1" title="Conta verificada">
    <svg className="w-5 h-5 text-blue-500" /* checkmark icon */ />
  </div>
)}
```

- Blue checkmark badge next to streamer name.
- Tooltip: "Identidade verificada" (basic) or "Conta verificada" (full).
- Show connected social platforms as clickable icons linking to their profiles.

### 10. Disconnect Social Account API

Create `src/app/api/verification/social/[platform]/disconnect/route.ts`:

- `POST` — delete the `Verification` record for the given platform.
- Update `User.verificationLevel` accordingly (if was "full" and social is removed, downgrade to "basic" if identity still approved).

## Dependencies

- `sharp` — for image resizing (already needed from Phase 0).
- Clerk SDK — `@clerk/nextjs` already installed. Use `useSessionList()`, `useUser()`.
- Twitch API — `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` env vars.
- Google OAuth — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` env vars (may already exist for Google Cloud TTS).
- Bunny CDN — for document/selfie storage. Consider using a separate, non-public storage zone if Bunny supports access controls.

## Acceptance Criteria

- [ ] User can upload ID document (front + optional back) and selfie for identity verification
- [ ] Documents are uploaded to Bunny CDN and stored securely
- [ ] Verification status progresses: pending → reviewing (when all docs uploaded) → approved/rejected
- [ ] User can connect Twitch account via OAuth and see connected username
- [ ] User can connect YouTube channel via OAuth and see connected channel name
- [ ] User can disconnect social accounts
- [ ] Admin page lists pending verifications with document/selfie previews
- [ ] Admin can approve or reject verifications with optional reason
- [ ] Approved users get `isVerified=true` and appropriate `verificationLevel`
- [ ] Verified badge (blue checkmark) displays on the public donation page
- [ ] Security page shows active Clerk sessions with device info
- [ ] User can revoke individual sessions or all other sessions
- [ ] 2FA setup is accessible through the security page via Clerk
- [ ] Rejected verifications show reason and allow document resubmission
- [ ] Verification level affects wallet limits (basic = higher limits, full = highest limits)
