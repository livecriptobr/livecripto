import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { pixKey: true, lightningAddress: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    pixKey: user.pixKey || '',
    lightningAddress: user.lightningAddress || '',
  })
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { pixKey, lightningAddress } = await req.json()

  // Basic validation
  if (pixKey !== undefined && typeof pixKey !== 'string') {
    return NextResponse.json({ error: 'Invalid pixKey' }, { status: 400 })
  }

  if (lightningAddress !== undefined && typeof lightningAddress !== 'string') {
    return NextResponse.json({ error: 'Invalid lightningAddress' }, { status: 400 })
  }

  // Validate Lightning Address format if provided
  if (lightningAddress && lightningAddress.length > 0) {
    const lnAddressRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
    if (!lnAddressRegex.test(lightningAddress)) {
      return NextResponse.json({ error: 'Formato de Lightning Address invalido' }, { status: 400 })
    }
  }

  await prisma.user.update({
    where: { clerkUserId },
    data: {
      pixKey: pixKey || null,
      lightningAddress: lightningAddress || null,
    },
  })

  return NextResponse.json({ success: true })
}
