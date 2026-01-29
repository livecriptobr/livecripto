import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const logger = createLogger({ action: 'admin-list-verifications' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check admin role
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(clerkUserId)
    const role = (clerkUser.publicMetadata as Record<string, unknown>)?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const status = req.nextUrl.searchParams.get('status') || 'reviewing'

    const verifications = await prisma.verification.findMany({
      where: { status, type: 'identity' },
      include: {
        user: { select: { id: true, username: true, displayName: true, email: true } },
      },
      orderBy: { submittedAt: 'asc' },
    })

    logger.info('Listed verifications', { count: verifications.length, status })

    return NextResponse.json({ verifications })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('List verifications failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
