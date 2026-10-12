import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramAuthPayload {
  id: string
  auth_date: string
  hash: string
  [key: string]: string | undefined
}

export function verifyTelegramHmac(payload: TelegramAuthPayload) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !payload.hash) return false

  const { hash, ...fields } = payload
  const authDate = Number(payload.auth_date)
  if (!Number.isFinite(authDate) || Math.abs(Date.now() / 1000 - authDate) > 86400) return false

  const dataCheckString = Object.keys(fields)
    .filter((key) => fields[key] !== undefined)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n')
  const secret = createHash('sha256').update(token).digest()
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex')
  const actual = Buffer.from(hash, 'hex')
  const reference = Buffer.from(expected, 'hex')
  return actual.length === reference.length && timingSafeEqual(actual, reference)
}

export const SESSION_COOKIE = 'shield_session'
export const sessionSecret = () => process.env.SESSION_SECRET ?? process.env.WEBHOOK_SIGNING_SECRET ?? ''

export function getTelegramUserId(payload: TelegramAuthPayload) {
  return payload.id
}

export async function readSessionUserId(token: string | undefined) {
  if (!token || sessionSecret().length < 32) return null
  try {
    const { jwtVerify } = await import('jose')
    const result = await jwtVerify(token, new TextEncoder().encode(sessionSecret()), { algorithms: ['HS256'] })
    return typeof result.payload.userId === 'string' ? result.payload.userId : null
  } catch {
    return null
  }
}
