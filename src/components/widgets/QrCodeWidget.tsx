'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeConfig {
  url?: string
  size?: number
  fgColor?: string
  bgColor?: string
  label?: string
  labelColor?: string
}

interface QrCodeWidgetProps {
  config: QrCodeConfig
  username: string
}

export default function QrCodeWidget({ config, username }: QrCodeWidgetProps) {
  const [dataUrl, setDataUrl] = useState<string>('')

  const url = config.url || `${typeof window !== 'undefined' ? window.location.origin : ''}/${username}`
  const size = config.size ?? 256

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: {
        dark: config.fgColor ?? '#FFFFFF',
        light: config.bgColor ?? '#00000000',
      },
    }).then(setDataUrl).catch(() => { /* silent */ })
  }, [url, size, config.fgColor, config.bgColor])

  if (!dataUrl) return null

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt="QR Code" width={size} height={size} />
      {config.label && (
        <div
          className="text-lg font-bold drop-shadow-lg"
          style={{ color: config.labelColor ?? '#FFFFFF' }}
        >
          {config.label}
        </div>
      )}
    </div>
  )
}
