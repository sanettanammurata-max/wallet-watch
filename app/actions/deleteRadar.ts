'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { monitoredWallet } from '@/lib/db/schema'
import { getVerifiedSession } from './session'

export interface DeleteRadarPayload {
  walletId: string
}

export async function deleteLiveSecurityRadar(payload: DeleteRadarPayload) {
  if (!payload.walletId?.trim()) return { success: false, error: 'Invalid radar identifier.' }

  try {
    const session = await getVerifiedSession()
    if (!session) return { success: false, error: 'Unauthorized operation. Active session not found.' }

    const owned = await db
      .select({ wallet: monitoredWallet })
      .from(monitoredWallet)
      .where(and(eq(monitoredWallet.id, payload.walletId), eq(monitoredWallet.userId, session.userId)))
      .limit(1)

    if (!owned.length) return { success: false, error: 'Security radar not found or access denied.' }
    const wallet = owned[0].wallet

    const endpoint = process.env.ALCHEMY_NOTIFY_URL
    const token = process.env.ALCHEMY_AUTH_TOKEN
    if (endpoint && token && wallet.webhookId) {
      const response = await fetch(`${endpoint}/${encodeURIComponent(wallet.webhookId)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!response.ok && response.status !== 404) throw new Error('Provider rejected radar removal.')
    }

    await db.delete(monitoredWallet).where(eq(monitoredWallet.id, wallet.id))
    revalidatePath('/')
    return { success: true, message: 'Security radar successfully deactivated.' }
  } catch (error) {
    console.error('[v0] Radar deletion failed:', error)
    return { success: false, error: 'Unable to deactivate the security radar.' }
  }
}

export { deleteLiveSecurityRadar as deleteRadar }
