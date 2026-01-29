import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import WidgetRenderer from './WidgetRenderer'

interface PageProps {
  params: Promise<{ widgetId: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function WidgetPage({ params, searchParams }: PageProps) {
  const { widgetId } = await params
  const { token } = await searchParams

  if (!token) return notFound()

  const widget = await prisma.widget.findFirst({
    where: { id: widgetId, token, isActive: true },
    include: { user: { select: { username: true } } },
  })

  if (!widget) return notFound()

  const config = widget.config as Record<string, unknown>

  return (
    <html lang="pt-BR">
      <body style={{ background: 'transparent', overflow: 'hidden', margin: 0 }}>
        <WidgetRenderer
          widgetId={widget.id}
          token={token}
          type={widget.type}
          config={config}
          username={widget.user.username}
        />
      </body>
    </html>
  )
}
