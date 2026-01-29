'use client'

import AlertsWidget from '@/components/widgets/AlertsWidget'
import RankingWidget from '@/components/widgets/RankingWidget'
import QrCodeWidget from '@/components/widgets/QrCodeWidget'
import RecentWidget from '@/components/widgets/RecentWidget'
import MarathonWidget from '@/components/widgets/MarathonWidget'
import VideoWidget from '@/components/widgets/VideoWidget'
import MusicWidget from '@/components/widgets/MusicWidget'

interface WidgetRendererProps {
  widgetId: string
  token: string
  type: string
  config: Record<string, unknown>
  username: string
}

export default function WidgetRenderer({ widgetId, token, type, config, username }: WidgetRendererProps) {
  switch (type) {
    case 'alerts':
      return <AlertsWidget widgetId={widgetId} token={token} config={config} />
    case 'ranking':
      return <RankingWidget widgetId={widgetId} token={token} config={config} />
    case 'qrcode':
      return <QrCodeWidget config={config} username={username} />
    case 'recent':
      return <RecentWidget widgetId={widgetId} token={token} config={config} />
    case 'marathon':
      return <MarathonWidget widgetId={widgetId} token={token} config={config} />
    case 'video':
      return <VideoWidget widgetId={widgetId} token={token} config={config} />
    case 'music':
      return <MusicWidget widgetId={widgetId} token={token} config={config} />
    default:
      return <div className="text-white text-center p-8">Widget type not supported</div>
  }
}
