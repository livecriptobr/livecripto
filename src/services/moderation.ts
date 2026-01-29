import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import type { ModerationSettings } from '@prisma/client'
import type { Prisma } from '@prisma/client'

const log = createLogger({ action: 'moderation' })

// --- Types ---

interface ModerationResult {
  allowed: boolean
  reason?: string
  category?: string
  details?: Record<string, unknown>
}

interface ModerateDonationParams {
  userId: string
  donationId?: string
  donorName: string
  donorIp?: string
  text?: string
  audioUrl?: string
  imageUrl?: string
}

interface OpenAIModerationCategory {
  flagged: boolean
  categories: Record<string, boolean>
  category_scores: Record<string, number>
}

interface OpenAIModerationResponse {
  results: OpenAIModerationCategory[]
}

// --- Default Portuguese profanity list ---

const DEFAULT_PROFANITY_LIST = [
  'puta', 'caralho', 'porra', 'merda', 'foda', 'fodase', 'buceta',
  'viado', 'viada', 'piranha', 'vadia', 'cuzao', 'cuzão', 'arrombado',
  'arrombada', 'desgraça', 'desgraca', 'filhadaputa', 'fdp', 'pqp',
  'vsf', 'tnc', 'krl', 'pnc', 'otario', 'otária', 'retardado',
  'retardada', 'imbecil', 'idiota', 'babaca', 'corno', 'vagabundo',
  'vagabunda', 'lixo', 'nojento', 'nojenta',
]

// --- Helpers ---

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'livecripto-default-salt'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function containsBlockedWord(text: string, blockedWords: string[]): string | null {
  const normalizedText = removeAccents(text.toLowerCase())
  for (const word of blockedWords) {
    const normalizedWord = removeAccents(word.toLowerCase())
    if (normalizedWord.length === 0) continue
    // Word boundary check using regex
    const escaped = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(?:^|\\s|[^a-zA-Z0-9])${escaped}(?:$|\\s|[^a-zA-Z0-9])`, 'i')
    if (regex.test(normalizedText) || normalizedText.includes(normalizedWord)) {
      return word
    }
  }
  return null
}

function matchesRegexPattern(text: string, patterns: string[]): string | null {
  const normalizedText = removeAccents(text.toLowerCase())
  for (const pattern of patterns) {
    if (!pattern) continue
    try {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(normalizedText) || regex.test(text)) {
        return pattern
      }
    } catch {
      log.warn('Invalid regex pattern', { pattern })
    }
  }
  return null
}

// --- Core moderation functions ---

export async function getModerationSettings(userId: string): Promise<ModerationSettings> {
  const settings = await prisma.moderationSettings.findUnique({
    where: { userId },
  })

  if (settings) return settings

  // Return defaults (not persisted until user saves)
  return {
    id: '',
    userId,
    blockedWordsEnabled: false,
    blockedWords: [],
    blockedWordsRegex: [],
    useDefaultProfanityList: true,
    gptModerationEnabled: false,
    gptBlockHate: true,
    gptBlockSexual: true,
    gptBlockViolence: true,
    gptBlockSelfHarm: true,
    gptBlockThreatening: true,
    gptBlockHarassment: true,
    gptSensitivity: 0.7,
    audioModerationEnabled: false,
    imageModerationEnabled: false,
    autoBlockRepeatOffenders: false,
    repeatOffenderThreshold: 3,
  } as ModerationSettings
}

export async function isDonorBlocked(userId: string, ipHash: string): Promise<boolean> {
  const blocked = await prisma.blockedDonor.findUnique({
    where: { userId_donorIpHash: { userId, donorIpHash: ipHash } },
  })
  return !!blocked
}

export function moderateText(text: string, settings: ModerationSettings): ModerationResult {
  if (!settings.blockedWordsEnabled && !settings.useDefaultProfanityList) {
    return { allowed: true }
  }

  const userWords = (settings.blockedWords as string[]) || []
  const regexPatterns = (settings.blockedWordsRegex as string[]) || []

  // Check user's custom blocked words
  if (settings.blockedWordsEnabled && userWords.length > 0) {
    const matched = containsBlockedWord(text, userWords)
    if (matched) {
      return {
        allowed: false,
        reason: 'blocked_word',
        category: 'custom',
        details: { matchedWord: matched },
      }
    }
  }

  // Check regex patterns
  if (settings.blockedWordsEnabled && regexPatterns.length > 0) {
    const matched = matchesRegexPattern(text, regexPatterns)
    if (matched) {
      return {
        allowed: false,
        reason: 'blocked_regex',
        category: 'custom',
        details: { matchedPattern: matched },
      }
    }
  }

  // Check default profanity list
  if (settings.useDefaultProfanityList) {
    const matched = containsBlockedWord(text, DEFAULT_PROFANITY_LIST)
    if (matched) {
      return {
        allowed: false,
        reason: 'profanity',
        category: 'default_list',
        details: { matchedWord: matched },
      }
    }
  }

  return { allowed: true }
}

export async function moderateWithGpt(text: string, settings: ModerationSettings): Promise<ModerationResult> {
  if (!settings.gptModerationEnabled) {
    return { allowed: true }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    log.warn('OpenAI API key not configured, skipping GPT moderation')
    return { allowed: true }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
    })

    if (!response.ok) {
      log.error('OpenAI moderation API error', { status: response.status })
      // Fail open
      return { allowed: true }
    }

    const data = (await response.json()) as OpenAIModerationResponse
    const result = data.results[0]
    if (!result) return { allowed: true }

    const sensitivity = settings.gptSensitivity

    // Map settings to OpenAI categories
    const categoryMap: Record<string, boolean> = {
      'hate': settings.gptBlockHate,
      'hate/threatening': settings.gptBlockHate,
      'sexual': settings.gptBlockSexual,
      'sexual/minors': settings.gptBlockSexual,
      'violence': settings.gptBlockViolence,
      'violence/graphic': settings.gptBlockViolence,
      'self-harm': settings.gptBlockSelfHarm,
      'self-harm/intent': settings.gptBlockSelfHarm,
      'self-harm/instructions': settings.gptBlockSelfHarm,
      'harassment': settings.gptBlockHarassment,
      'harassment/threatening': settings.gptBlockThreatening,
    }

    for (const [category, score] of Object.entries(result.category_scores)) {
      const shouldBlock = categoryMap[category]
      if (shouldBlock && score >= sensitivity) {
        return {
          allowed: false,
          reason: 'gpt_moderation',
          category,
          details: { score, sensitivity, allScores: result.category_scores },
        }
      }
    }

    return { allowed: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('GPT moderation failed, failing open', { error: msg })
    // Fail open on error
    return { allowed: true }
  }
}

export async function moderateAudio(_audioUrl: string, settings: ModerationSettings): Promise<ModerationResult> {
  if (!settings.audioModerationEnabled) {
    return { allowed: true }
  }

  // TODO: Integrate Google Cloud Speech-to-Text to transcribe audio,
  // then run text moderation on the transcript
  return { allowed: true }
}

export async function moderateImage(_imageUrl: string, settings: ModerationSettings): Promise<ModerationResult> {
  if (!settings.imageModerationEnabled) {
    return { allowed: true }
  }

  // TODO: Integrate Google Cloud Vision API for image content moderation
  return { allowed: true }
}

async function logModeration(
  userId: string,
  donationId: string | undefined,
  donorName: string,
  donorIpHash: string | undefined,
  content: string,
  contentType: string,
  result: ModerationResult,
  action: string,
) {
  try {
    await prisma.moderationLog.create({
      data: {
        userId,
        donationId: donationId ?? null,
        donorName,
        donorIpHash: donorIpHash ?? null,
        content,
        contentType,
        reason: result.reason || 'unknown',
        category: result.category ?? null,
        action,
        details: (result.details as Prisma.InputJsonValue) ?? undefined,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Failed to create moderation log', { error: msg })
  }
}

async function checkAutoBlock(userId: string, donorIpHash: string, donorName: string, settings: ModerationSettings) {
  if (!settings.autoBlockRepeatOffenders || !donorIpHash) return

  const count = await prisma.moderationLog.count({
    where: {
      userId,
      donorIpHash,
      action: 'blocked',
    },
  })

  if (count >= settings.repeatOffenderThreshold) {
    try {
      await prisma.blockedDonor.upsert({
        where: { userId_donorIpHash: { userId, donorIpHash } },
        create: {
          userId,
          donorIpHash,
          donorName,
          reason: `Auto-bloqueado: ${count} violacoes`,
        },
        update: {},
      })
      log.info('Auto-blocked repeat offender', { userId, donorIpHash, violations: count })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      log.error('Failed to auto-block donor', { error: msg })
    }
  }
}

// --- Main pipeline ---

export async function moderateDonation(params: ModerateDonationParams): Promise<ModerationResult> {
  const { userId, donationId, donorName, donorIp, text, audioUrl, imageUrl } = params
  const settings = await getModerationSettings(userId)
  const ipHash = donorIp ? hashIp(donorIp) : undefined

  // 1. Check if donor is blocked
  if (ipHash) {
    const blocked = await isDonorBlocked(userId, ipHash)
    if (blocked) {
      const result: ModerationResult = {
        allowed: false,
        reason: 'blocked_donor',
        category: 'blocked',
      }
      await logModeration(userId, donationId, donorName, ipHash, text || '', 'text', result, 'blocked')
      return result
    }
  }

  // 2. Text moderation
  if (text) {
    const textResult = moderateText(text, settings)
    if (!textResult.allowed) {
      await logModeration(userId, donationId, donorName, ipHash, text, 'text', textResult, 'blocked')
      if (ipHash) await checkAutoBlock(userId, ipHash, donorName, settings)
      return textResult
    }

    // 3. GPT moderation
    const gptResult = await moderateWithGpt(text, settings)
    if (!gptResult.allowed) {
      await logModeration(userId, donationId, donorName, ipHash, text, 'text', gptResult, 'blocked')
      if (ipHash) await checkAutoBlock(userId, ipHash, donorName, settings)
      return gptResult
    }
  }

  // 4. Audio moderation
  if (audioUrl) {
    const audioResult = await moderateAudio(audioUrl, settings)
    if (!audioResult.allowed) {
      await logModeration(userId, donationId, donorName, ipHash, audioUrl, 'audio', audioResult, 'blocked')
      if (ipHash) await checkAutoBlock(userId, ipHash, donorName, settings)
      return audioResult
    }
  }

  // 5. Image moderation
  if (imageUrl) {
    const imageResult = await moderateImage(imageUrl, settings)
    if (!imageResult.allowed) {
      await logModeration(userId, donationId, donorName, ipHash, imageUrl, 'image', imageResult, 'blocked')
      if (ipHash) await checkAutoBlock(userId, ipHash, donorName, settings)
      return imageResult
    }
  }

  return { allowed: true }
}
