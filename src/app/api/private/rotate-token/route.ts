import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

export async function POST() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Generate new overlay token
  const newToken = randomBytes(32).toString('hex')

  await prisma.user.update({
    where: { id: user.id },
    data: {
      overlayToken: newToken,
      overlayTokenUpdatedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, newToken })
}
