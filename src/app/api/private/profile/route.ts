import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function GET() {
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
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    username: user.username,
    displayName: user.displayName,
    email: user.email || clerkUser?.emailAddresses[0]?.emailAddress || '',
  })
}

export async function POST(request: Request) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { username, displayName } = body

  // Validate username
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

  // Reserved usernames
  const reserved = ['admin', 'api', 'dashboard', 'login', 'signup', 'sign-in', 'sign-up', 'checkout', 'overlay', 'donate']
  if (reserved.includes(cleanUsername)) {
    return NextResponse.json({ error: 'Este username esta reservado' }, { status: 400 })
  }

  // Check if username is already taken by another user
  const existingUser = await prisma.user.findFirst({
    where: {
      username: cleanUsername,
      NOT: { clerkUserId },
    },
  })

  if (existingUser) {
    return NextResponse.json({ error: 'Este username ja esta em uso' }, { status: 400 })
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { clerkUserId },
    data: {
      username: cleanUsername,
      displayName: displayName?.trim() || null,
    },
    select: {
      username: true,
      displayName: true,
      email: true,
    },
  })

  return NextResponse.json({
    username: updatedUser.username,
    displayName: updatedUser.displayName,
    email: updatedUser.email,
  })
}
