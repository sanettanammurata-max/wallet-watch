'use server'

import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE, sessionSecret } from '@/lib/telegram-auth'

export interface SessionData {
  userId: string
  chatId: string
}

export async function getVerifiedSession(): Promise<SessionData | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const secret = sessionSecret()
  if (!token || secret.length < 32) return null

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] })
    if (typeof payload.userId !== 'string' || typeof payload.chatId !== 'string') return null
    return { userId: payload.userId, chatId: payload.chatId }
  } catch {
    return null
  }
}
