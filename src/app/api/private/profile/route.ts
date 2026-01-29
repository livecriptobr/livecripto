import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

interface ProfileBody {
  username?: string
  displayName?: string
  avatarUrl?: string
  primaryColor?: string
  backgroundColor?: string
  backgroundImageUrl?: string
  bio?: string
  socialLinks?: Record<string, string>
  donationPageTitle?: string
  thankYouMessage?: string
  phone?: string
}

export async function GET() {
  const log = createLogger({ action: 'profile.get' })
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clerkUser = await currentUser()
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      username: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      primaryColor: true,
      backgroundColor: true,
      backgroundImageUrl: true,
      bio: true,
      socialLinks: true,
      donationPageTitle: true,
      thankYouMessage: true,
      phone: true,
    },
  })

  if (!user) {
    log.warn('User not found', { clerkUserId })
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...user,
    email: user.email || clerkUser?.emailAddresses[0]?.emailAddress || '',
  })
}

export async function POST(request: Request) {
  const log = createLogger({ action: 'profile.update' })
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ProfileBody
  try {
    body = await request.json() as ProfileBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    username,
    displayName,
    avatarUrl,
    primaryColor,
    backgroundColor,
    backgroundImageUrl,
    bio,
    socialLinks,
    donationPageTitle,
    thankYouMessage,
    phone,
  } = body

  // Validate username if provided
  if (username !== undefined) {
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username e obrigatorio' }, { status: 400 })
    }

    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (cleanUsername.length < 3) {
      return NextResponse.json({ error: 'Username deve ter pelo menos 3 caracteres' }, { status: 400 })
    }
    if (cleanUsername.length > 30) {
      return NextResponse.json({ error: 'Username deve ter no maximo 30 caracteres' }, { status: 400 })
    }

    const reserved = ['admin', 'api', 'dashboard', 'login', 'signup', 'sign-in', 'sign-up', 'checkout', 'overlay', 'donate']
    if (reserved.includes(cleanUsername)) {
      return NextResponse.json({ error: 'Este username esta reservado' }, { status: 400 })
    }

    const existingUser = await prisma.user.findFirst({
      where: { username: cleanUsername, NOT: { clerkUserId } },
    })
    if (existingUser) {
      return NextResponse.json({ error: 'Este username ja esta em uso' }, { status: 400 })
    }
  }

  // Validate colors
  if (primaryColor && !HEX_COLOR_RE.test(primaryColor)) {
    return NextResponse.json({ error: 'Cor primaria invalida' }, { status: 400 })
  }
  if (backgroundColor && !HEX_COLOR_RE.test(backgroundColor)) {
    return NextResponse.json({ error: 'Cor de fundo invalida' }, { status: 400 })
  }

  // Validate bio length
  if (bio && bio.length > 500) {
    return NextResponse.json({ error: 'Bio deve ter no maximo 500 caracteres' }, { status: 400 })
  }

  // Build update data
  const data: Record<string, unknown> = {}

  if (username !== undefined) {
    data.username = username.toLowerCase().replace(/[^a-z0-9-]/g, '')
  }
  if (displayName !== undefined) data.displayName = displayName?.trim() || null
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl?.trim() || null
  if (primaryColor !== undefined) data.primaryColor = primaryColor || null
  if (backgroundColor !== undefined) data.backgroundColor = backgroundColor || null
  if (backgroundImageUrl !== undefined) data.backgroundImageUrl = backgroundImageUrl?.trim() || null
  if (bio !== undefined) data.bio = bio?.trim() || null
  if (socialLinks !== undefined) data.socialLinks = socialLinks || null
  if (donationPageTitle !== undefined) data.donationPageTitle = donationPageTitle?.trim() || null
  if (thankYouMessage !== undefined) data.thankYouMessage = thankYouMessage?.trim() || null
  if (phone !== undefined) data.phone = phone?.trim() || null

  try {
    const updatedUser = await prisma.user.update({
      where: { clerkUserId },
      data,
      select: {
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        primaryColor: true,
        backgroundColor: true,
        backgroundImageUrl: true,
        bio: true,
        socialLinks: true,
        donationPageTitle: true,
        thankYouMessage: true,
        phone: true,
      },
    })

    log.info('Profile updated', { clerkUserId })
    return NextResponse.json(updatedUser)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar perfil'
    log.error('Profile update failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
