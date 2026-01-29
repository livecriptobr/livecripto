import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

interface PatchBody {
  isRead?: boolean
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createLogger({ action: 'notification.markRead' })
  const { id } = await params

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkUserId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const notification = await prisma.notification.findUnique({ where: { id } })
    if (!notification) {
      return NextResponse.json({ error: 'Notificacao nao encontrada' }, { status: 404 })
    }

    if (notification.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: PatchBody
    try {
      body = await req.json() as PatchBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (body.isRead !== true) {
      return NextResponse.json({ error: 'isRead deve ser true' }, { status: 400 })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    log.info('Notification marked as read', { notificationId: id, userId: user.id })
    return NextResponse.json(updated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    log.error('Notification update failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
