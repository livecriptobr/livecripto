import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import DonationForm from '@/components/donate/DonationForm'

interface Props {
  params: Promise<{ username: string }>
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
    },
  })

  if (!user) {
    notFound()
  }

  const settings = user.alertSettings as Record<string, unknown>
  const minAmountCents = (settings?.minAmountCents as number) || 100

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <DonationForm
        username={user.username}
        displayName={user.displayName || user.username}
        minAmountCents={minAmountCents}
      />
    </main>
  )
}
