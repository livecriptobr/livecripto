# Phase 0 — Profile Customization & Donation Page Redesign

## Context

LivePix's settings/profile page includes: avatar upload, primary color picker, background color picker, background image upload, bio text, social links (Twitch, YouTube, Instagram, Twitter/X, TikTok), donation page preview, custom title, thank you message, and phone number. Currently, LiveCripto has a basic profile page at `src/app/(dashboard)/dashboard/profile/page.tsx` with minimal fields. The donation page at `src/app/(public)/[username]/page.tsx` uses a generic layout without user-specific branding.

**Tech stack**: Next.js 15 App Router, TypeScript, Tailwind CSS 4, Prisma + PostgreSQL (Supabase), Clerk auth, Bunny CDN for storage.

## Objective

Implement full profile customization so streamers can brand their donation page with custom colors, avatar, background image, bio, social links, and personalized messages — achieving visual parity with LivePix's profile/settings experience.

## Tasks

### 1. Schema Updates

Add fields to the `User` model in `prisma/schema.prisma`:

```prisma
model User {
  // ... existing fields
  avatarUrl          String?
  primaryColor       String?   @default("#8B5CF6") // violet-500
  backgroundColor    String?   @default("#0F0A1E")
  backgroundImageUrl String?
  bio                String?   @db.Text
  socialLinks        Json?     // { twitch?: string, youtube?: string, instagram?: string, twitter?: string, tiktok?: string }
  donationPageTitle  String?   // e.g. "Apoie minha live!"
  thankYouMessage    String?   // e.g. "Obrigado pela doação!"
  phone              String?
}
```

Run `npx prisma migrate dev --name add_profile_customization`.

### 2. Avatar Upload API

Create `src/app/api/upload/avatar/route.ts`:

- Accept `POST` with `multipart/form-data` (single image file).
- Validate file type (JPEG, PNG, WebP), max 5MB.
- Resize to 256x256 using `sharp`.
- Upload to Bunny CDN storage zone (`/avatars/{userId}.webp`).
- Update `user.avatarUrl` in DB.
- Return `{ url: string }`.

### 3. Background Image Upload API

Create `src/app/api/upload/background/route.ts`:

- Accept `POST` with `multipart/form-data` (single image file).
- Validate file type (JPEG, PNG, WebP), max 10MB.
- Resize to max 1920x1080, compress to WebP using `sharp`.
- Upload to Bunny CDN (`/backgrounds/{userId}.webp`).
- Update `user.backgroundImageUrl` in DB.
- Return `{ url: string }`.

### 4. Profile Settings Page Redesign

Redesign `src/app/(dashboard)/dashboard/profile/page.tsx`:

- **Avatar section**: Circular preview with upload button overlay, crop modal optional.
- **Color pickers**: Primary color (used for buttons/accents on donation page), background color. Use `<input type="color">` or `react-colorful`.
- **Background image**: Upload area with drag-and-drop, preview thumbnail, remove button.
- **Bio**: Textarea, max 500 chars, character counter.
- **Social links**: Input fields with platform icons (Twitch, YouTube, Instagram, Twitter/X, TikTok), URL validation.
- **Donation page title**: Text input, placeholder "Apoie minha live!".
- **Thank you message**: Text input, placeholder "Obrigado pela doação!".
- **Phone**: Phone input with Brazilian mask (+55).
- **Live preview**: Side panel or bottom section showing how the donation page will look.
- Use Framer Motion for section transitions.

### 5. Account Settings Page

Create `src/app/(dashboard)/dashboard/settings/account/page.tsx`:

- Display name, email (from Clerk), username/slug.
- Username change with availability check via `GET /api/users/check-username?username=xxx`.
- Delete account button with confirmation modal.

### 6. Profile API Updates

Update or create `src/app/api/profile/route.ts`:

- `GET /api/profile` — return full profile for authenticated user.
- `PATCH /api/profile` — update profile fields. Validate: colors as hex (`/^#[0-9A-Fa-f]{6}$/`), URLs for social links, bio max 500 chars.
- `GET /api/users/[username]/profile` — public endpoint returning public profile data for donation page (no sensitive fields).

### 7. Donation Page Redesign

Update `src/app/(public)/[username]/page.tsx`:

- Fetch user profile data (avatar, colors, background, bio, social links, title).
- Apply `primaryColor` to buttons, links, accents via CSS variables: `style={{ '--primary': user.primaryColor }}`.
- Apply `backgroundColor` as page background; if `backgroundImageUrl` exists, use as `background-image` with dark overlay.
- Show avatar (circular, top center).
- Show bio text below avatar.
- Show social links as icon buttons row.
- Show custom `donationPageTitle` as heading.
- After successful donation, show `thankYouMessage`.
- Mobile-first responsive design.

## Dependencies

- `sharp` — image resizing/compression: `npm install sharp`
- Bunny CDN — already configured for TTS storage; reuse `BUNNY_STORAGE_API_KEY`, `BUNNY_STORAGE_ZONE`, `BUNNY_CDN_URL` env vars.
- `react-colorful` (optional) — lightweight color picker: `npm install react-colorful`

## Acceptance Criteria

- [ ] User can upload an avatar that appears on their donation page
- [ ] User can pick a primary color that changes button/accent colors on donation page
- [ ] User can pick a background color or upload a background image
- [ ] User can write a bio (max 500 chars) displayed on donation page
- [ ] User can add social links (Twitch, YouTube, Instagram, Twitter/X, TikTok) displayed as icons
- [ ] User can set a custom donation page title and thank you message
- [ ] Donation page renders with all customizations applied
- [ ] Profile settings page has a live preview section
- [ ] Images are resized/compressed before upload to Bunny CDN
- [ ] All API endpoints validate input and return proper errors
- [ ] Mobile-responsive donation page
