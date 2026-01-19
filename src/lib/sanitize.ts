export function sanitizeMessage(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .slice(0, 400)
}

export function containsBlockedWord(message: string, blockedWords: string[]): boolean {
  if (!blockedWords || blockedWords.length === 0) return false
  const lower = message.toLowerCase()
  return blockedWords.some(word => lower.includes(word.toLowerCase()))
}
