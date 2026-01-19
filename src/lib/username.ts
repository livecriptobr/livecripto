import crypto from 'crypto'

export function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9-]/g, '-')     // Replace non-alphanumeric with dash
    .replace(/-+/g, '-')              // Collapse multiple dashes
    .replace(/^-|-$/g, '')            // Trim dashes
    .slice(0, 20)                     // Max 20 chars
    || 'user'
}

export function generateRandomSuffix(): string {
  return crypto.randomBytes(2).toString('hex') // 4 chars
}

export function generateOverlayToken(): string {
  return crypto.randomBytes(32).toString('hex') // 64 chars
}
