'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { securityAlert } from '@/lib/db/schema'
import { readSessionUserId, SESSION_COOKIE } from '@/lib/telegram-auth'
import { cookies } from 'next/headers'

export type ResolveAlertPayload = {
  alertId: string
}

export async function resolveSecurityAlert({ alertId }: ResolveAlertPayload) {
  if (!alertId || alertId.length > 128) {
    return { success: false, error: 'Invalid alert identifier.' }
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const userId = await readSessionUserId(token)

  if (!userId) {
    return { success: false, error: 'Unauthorized operation.' }
  }

  try {
    const updated = await db
      .update(securityAlert)
      .set({ resolved: true })
      .where(and(eq(securityAlert.id, alertId), eq(securityAlert.userId, userId)))
      .returning({ id: securityAlert.id })

    if (updated.length === 0) {
      return { success: false, error: 'Security alert not found or access denied.' }
    }

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('[v0] Failed to resolve security alert:', error)
    return { success: false, error: 'Unable to resolve the security alert.' }
  }
}
