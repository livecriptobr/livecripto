import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'poll-vote' })

interface RouteContext {
  params: Promise<{ pollId: string }>
}

interface VoteBody {
  optionId: string
  voterName: string
  donationId?: string
}

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + (process.env.IP_HASH_SALT || 'livecripto-salt'))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { pollId } = await ctx.params

  try {
    const body = (await req.json()) as VoteBody
    const { optionId, voterName, donationId } = body

    if (!optionId || !voterName?.trim()) {
      return NextResponse.json({ error: 'optionId e voterName obrigatorios' }, { status: 400 })
    }

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    })

    if (!poll) {
      return NextResponse.json({ error: 'Enquete nao encontrada' }, { status: 404 })
    }

    if (poll.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Enquete nao esta ativa' }, { status: 400 })
    }

    if (poll.expiresAt && new Date() > poll.expiresAt) {
      return NextResponse.json({ error: 'Enquete expirada' }, { status: 400 })
    }

    const option = poll.options.find(o => o.id === optionId)
    if (!option) {
      return NextResponse.json({ error: 'Opcao nao encontrada' }, { status: 404 })
    }

    let weight = 1
    let voterIpHash: string | null = null

    if (poll.voteType === 'UNIQUE') {
      // IP-based duplicate check
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || '0.0.0.0'
      voterIpHash = await hashIp(ip)

      const existing = await prisma.pollVote.findFirst({
        where: { pollId, voterIpHash },
      })

      if (existing) {
        return NextResponse.json({ error: 'Voce ja votou nesta enquete' }, { status: 409 })
      }
    } else {
      // WEIGHTED mode - require donationId
      if (!donationId) {
        return NextResponse.json({ error: 'donationId obrigatorio para voto ponderado' }, { status: 400 })
      }

      const donation = await prisma.donation.findUnique({
        where: { id: donationId },
        select: { amountCents: true, pollVoteOptionId: true },
      })

      if (!donation) {
        return NextResponse.json({ error: 'Doacao nao encontrada' }, { status: 404 })
      }

      if (donation.pollVoteOptionId) {
        return NextResponse.json({ error: 'Esta doacao ja votou' }, { status: 409 })
      }

      weight = donation.amountCents
    }

    // Atomic transaction
    const vote = await prisma.$transaction(async (tx) => {
      const newVote = await tx.pollVote.create({
        data: {
          pollId,
          optionId,
          donationId: donationId || null,
          voterName: voterName.trim(),
          voterIpHash,
          weight,
        },
      })

      await tx.pollOption.update({
        where: { id: optionId },
        data: {
          voteCount: { increment: 1 },
          voteWeight: { increment: weight },
        },
      })

      await tx.poll.update({
        where: { id: pollId },
        data: { totalVotes: { increment: 1 } },
      })

      if (donationId) {
        await tx.donation.update({
          where: { id: donationId },
          data: { pollVoteOptionId: optionId },
        })
      }

      return newVote
    })

    logger.info('Vote recorded', { pollId, optionId, voteId: vote.id })
    return NextResponse.json({ vote }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to record vote', { error: msg, pollId })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
