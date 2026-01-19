'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import AlertBox from '@/components/overlay/AlertBox'

interface AlertData {
  id: string
  donorName: string
  amountCents: number
  message: string
  audioUrl?: string
  durationMs: number
}

export default function OverlayPage({ params }: { params: Promise<{ username: string }> }) {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [username, setUsername] = useState<string>('')
  const [currentAlert, setCurrentAlert] = useState<AlertData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    params.then(p => setUsername(p.username))
  }, [params])

  const fetchNextAlert = useCallback(async () => {
    if (!username || !token) return

    try {
      const res = await fetch(`/api/overlay/next?username=${username}&token=${token}`)

      if (res.status === 401) {
        setError('Token invalido')
        return
      }

      const data = await res.json()

      if (data.alert) {
        setCurrentAlert(data.alert)
      }
    } catch (e) {
      console.error('Poll error:', e)
    }
  }, [username, token])

  useEffect(() => {
    if (!username || !token) return

    const startPolling = () => {
      pollingRef.current = setInterval(fetchNextAlert, 1000)
    }

    startPolling()

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [username, token, fetchNextAlert])

  const handleAlertFinish = async () => {
    if (!currentAlert) return

    // Stop polling during transition
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    try {
      await fetch('/api/overlay/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: currentAlert.id, token }),
      })
    } catch (e) {
      console.error('Ack error:', e)
    }

    setCurrentAlert(null)

    // Resume polling
    pollingRef.current = setInterval(fetchNextAlert, 1000)
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Token obrigatorio
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent">
      {currentAlert && (
        <AlertBox
          alert={currentAlert}
          onFinish={handleAlertFinish}
          audioRef={audioRef}
        />
      )}
      <audio ref={audioRef} />
    </div>
  )
}
