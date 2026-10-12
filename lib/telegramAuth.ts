import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export type TelegramAuthData = {
  id: string
  auth_date: string
  hash: string
  [key: string]: string
}

export function verifyTelegramAuth(data: TelegramAuthData) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !data.hash || !data.id || !data.auth_date) return false
  const { hash, ...fields } = data
  const age = Math.floor(Date.now() / 1000) - Number(data.auth_date)
  if (!Number.isFinite(age) || age < 0 || age > 86400) return false
  const checkString = Object.keys(fields).sort().map((key) => `${key}=${fields[key]}`).join('\n')
  const secret = createHash('sha256').update(token).digest()
  const expected = createHmac('sha256', secret).update(checkString).digest('hex')
  const actual = Buffer.from(hash, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}

export function telegramSessionValue(id: string) {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret) throw new Error('WEBHOOK_SIGNING_SECRET is not configured')
  const signature = createHmac('sha256', secret).update(id).digest('hex')
  return `${id}.${signature}`
}

export function verifyTelegramSession(value: string | undefined) {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret || !value) return null
  const [id, signature] = value.split('.')
  if (!id || !signature) return null
  const expected = createHmac('sha256', secret).update(id).digest('hex')
  const actual = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer) ? id : null
}

export const TELEGRAM_SESSION_COOKIE = 'shield_telegram_session'

export function toTelegramChatId(id: string) {
  return id
}

export function normalizeTelegramAuth(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'string')) as TelegramAuthData
}

export function isTelegramAuthData(data: Record<string, unknown>): data is TelegramAuthData {
  return typeof data.id === 'string' && typeof data.auth_date === 'string' && typeof data.hash === 'string'
}
