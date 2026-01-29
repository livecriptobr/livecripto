import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import DonationForm from '@/components/donate/DonationForm'
import DonationPageClient from '@/components/donate/DonationPageClient'
import type { IncentiveSettings } from '@prisma/client'

interface Props {
  params: Promise<{ username: string }>
}

interface SocialLinksData {
  twitch?: string
  youtube?: string
  instagram?: string
  twitter?: string
  tiktok?: string
}

export default async function DonatePage({ params }: Props) {
  const { username } = await params

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      alertSettings: true,
      avatarUrl: true,
      primaryColor: true,
      backgroundColor: true,
      backgroundImageUrl: true,
      bio: true,
      socialLinks: true,
      donationPageTitle: true,
      incentiveSettings: true,
      isVerified: true,
    },
  })

  if (!user) {
    notFound()
  }

  // Fetch active goals for this streamer
  const activeGoals = await prisma.goal.findMany({
    where: {
      userId: user.id,
      isActive: true,
      showOnDonation: true,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      rewards: {
        where: { isActive: true },
        orderBy: { thresholdCents: 'asc' },
      },
      _count: { select: { contributions: true } },
    },
  })

  // Fetch active poll for this streamer
  const activePoll = await prisma.poll.findFirst({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
  })

  const settings = user.alertSettings as Record<string, unknown>
  const minAmountCents = (settings?.minAmountCents as number) || 100
  const displayName = user.displayName || user.username
  const primaryColor = user.primaryColor || '#8B5CF6'
  const backgroundColor = user.backgroundColor || '#0F0A1E'
  const social = (user.socialLinks as SocialLinksData) || {}
  const title = user.donationPageTitle || `Apoie ${displayName}`

  const incentiveData = user.incentiveSettings ? {
    voiceMessagesEnabled: (user.incentiveSettings as IncentiveSettings).voiceMessagesEnabled,
    voiceMessageMaxSecs: (user.incentiveSettings as IncentiveSettings).voiceMessageMaxSecs,
    mediaEnabled: (user.incentiveSettings as IncentiveSettings).mediaEnabled,
    mediaGifsOnly: (user.incentiveSettings as IncentiveSettings).mediaGifsOnly,
    minAmountForVoice: (user.incentiveSettings as IncentiveSettings).minAmountForVoice,
    minAmountForMedia: (user.incentiveSettings as IncentiveSettings).minAmountForMedia,
  } : null

  const goalsData = activeGoals.map(g => ({
    id: g.id,
    title: g.title,
    description: g.description,
    targetCents: g.targetCents,
    currentCents: g.currentCents,
    type: g.type,
    charityName: g.charityName,
    charityPercent: g.charityPercent,
    deadline: g.deadline?.toISOString() || null,
    imageUrl: g.imageUrl,
    rewards: g.rewards.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      thresholdCents: r.thresholdCents,
      type: r.type,
    })),
    contributionCount: g._count.contributions,
  }))

  const pollData = activePoll ? {
    id: activePoll.id,
    title: activePoll.title,
    voteType: activePoll.voteType,
    options: activePoll.options.map(o => ({
      id: o.id,
      text: o.text,
      color: o.color,
    })),
  } : null

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{ backgroundColor }}
    >
      {user.backgroundImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${user.backgroundImageUrl})` }}
        >
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-6">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 flex items-center justify-center bg-zinc-800" style={{ borderColor: primaryColor }}>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white text-center flex items-center justify-center gap-2">
          {title}
          {user.isVerified && (
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
        </h1>

        {/* Bio */}
        {user.bio && (
          <p className="text-zinc-300 text-center text-sm max-w-sm">{user.bio}</p>
        )}

        {/* Social Links */}
        <DonationPageClient socialLinks={social} primaryColor={primaryColor} />

        {/* Donation Form */}
        <DonationForm
          username={user.username}
          displayName={displayName}
          minAmountCents={minAmountCents}
          primaryColor={primaryColor}
          activePoll={pollData}
          incentiveSettings={incentiveData}
          goals={goalsData}
        />
      </div>
    </main>
  )
}
