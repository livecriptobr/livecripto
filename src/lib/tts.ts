const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize'

export async function generateTTS(params: {
  text: string
  voice?: string
  languageCode?: string
}): Promise<Buffer> {
  const { text, voice = 'pt-BR-Standard-A', languageCode = 'pt-BR' } = params

  const truncatedText = text.slice(0, 5000)

  const response = await fetch(`${TTS_ENDPOINT}?key=${process.env.GOOGLE_TTS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: truncatedText },
      voice: { languageCode, name: voice },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0,
      },
    }),
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(`TTS Error: ${data.error.message}`)
  }

  return Buffer.from(data.audioContent, 'base64')
}

export function buildTTSText(
  template: string,
  donation: { donorName: string; amountCents: number; message: string }
): string {
  const valor = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(donation.amountCents / 100)

  return template
    .replace(/{nome}/g, donation.donorName)
    .replace(/{valor}/g, valor)
    .replace(/{mensagem}/g, donation.message)
}

export function applyBlacklist(text: string, blockedWords: string[]): string {
  if (!blockedWords || blockedWords.length === 0) return text

  let result = text
  for (const word of blockedWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    result = result.replace(regex, 'censurado')
  }
  return result
}
