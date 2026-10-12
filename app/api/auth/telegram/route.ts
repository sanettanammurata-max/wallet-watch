import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { securityUser, makeUserId } from '@/lib/db/schema'
import { verifyTelegramHmac, SESSION_COOKIE, sessionSecret, type TelegramAuthPayload } from '@/lib/telegram-auth'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  const payload = await request.json() as TelegramAuthPayload
  if (!verifyTelegramHmac(payload)) return NextResponse.json({ error: 'Invalid Telegram authentication' }, { status: 401 })
  const telegramChatId = payload.id
  const existing = await db.select().from(securityUser).where(eq(securityUser.telegramChatId, telegramChatId)).limit(1)
  const user = existing[0] ?? (await db.insert(securityUser).values({ id: makeUserId(), telegramChatId }).returning())[0]
  const secret = sessionSecret()
  if (secret.length < 32) return NextResponse.json({ error: 'Session security is not configured' }, { status: 503 })
  const token = await new SignJWT({ userId: user.id, chatId: telegramChatId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(new TextEncoder().encode(secret))
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
  return response
}
