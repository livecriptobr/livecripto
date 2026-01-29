import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface PatchBody {
  action: 'approve' | 'reject'
  rejectionReason?: string
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const logger = createLogger({ action: 'admin-review-verification' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(clerkUserId)
    const role = (clerkUser.publicMetadata as Record<string, unknown>)?.role
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const body = (await req.json()) as PatchBody

    if (!['approve', 'reject'].includes(body.action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    if (body.action === 'reject' && !body.rejectionReason) {
      return NextResponse.json({ error: 'Motivo da rejeição é obrigatório' }, { status: 400 })
    }

    const verification = await prisma.verification.findUnique({ where: { id } })
    if (!verification) {
      return NextResponse.json({ error: 'Verificação não encontrada' }, { status: 404 })
    }

    const isApprove = body.action === 'approve'

    const updated = await prisma.verification.update({
      where: { id },
      data: {
        status: isApprove ? 'approved' : 'rejected',
        rejectionReason: isApprove ? null : body.rejectionReason,
        reviewedBy: clerkUserId,
        reviewedAt: new Date(),
      },
    })

    // If approved, update user verification status
    if (isApprove) {
      await prisma.user.update({
        where: { id: verification.userId },
        data: {
          isVerified: true,
          verificationLevel: 'identity',
        },
      })
    }

    logger.info('Verification reviewed', {
      verificationId: id,
      action: body.action,
      reviewedBy: clerkUserId,
    })

    return NextResponse.json({ success: true, verification: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Review verification failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
