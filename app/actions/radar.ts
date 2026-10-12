'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  isDuplicateError,
  isPublicAddressOnly,
  isValidWalletAddress,
  limitForPlan,
  makeUserId,
  makeWalletId,
  normalizeAddress,
  securityUser,
  monitoredWallet,
  type BlockchainType,
} from '@/lib/db/schema'

export interface AddWalletPayload {
  telegramChatId: string
  blockchain: BlockchainType
  walletAddress: string
}

async function registerProviderWebhook(blockchain: BlockchainType, address: string) {
  const endpoint = process.env.ALCHEMY_NOTIFY_URL
  const token = process.env.ALCHEMY_AUTH_TOKEN
  if (!endpoint || !token) {
    // Wallet persistence must not depend on optional provider webhook credentials.
    // The scheduled multi-provider scanner monitors the wallet when Notify is not configured.
    return null
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      network: blockchain === 'ETHEREUM' ? 'ETH_MAINNET' : blockchain,
      webhook_type: 'ADDRESS_ACTIVITY',
      webhook_url: `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL}/api/webhook/crypto`,
      addresses_to_add: [address],
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Provider registration rejected.')
  const data = (await response.json()) as { id?: string; data?: { id?: string } }
  return data.data?.id ?? data.id ?? null
}

export async function registerSecurityRadar(payload: AddWalletPayload) {
  const address = normalizeAddress(payload.walletAddress)
  if (!payload.telegramChatId.trim()) return { success: false, error: 'A Telegram chat ID is required.' }
  if (!isPublicAddressOnly(address)) return { success: false, error: 'Only public wallet addresses are accepted. Never share private keys.' }
  if (!isValidWalletAddress(payload.blockchain, address)) return { success: false, error: `Invalid ${payload.blockchain} address format.` }

  try {
    let user = (await db.select().from(securityUser).where(eq(securityUser.telegramChatId, payload.telegramChatId.trim())).limit(1))[0]
    if (!user) user = (await db.insert(securityUser).values({ id: makeUserId(), telegramChatId: payload.telegramChatId.trim() }).returning())[0]

    const wallets = await db.select({ id: monitoredWallet.id }).from(monitoredWallet).where(eq(monitoredWallet.userId, user.id))
    if (wallets.length >= limitForPlan(user.isPremium)) return { success: false, error: 'Free tier limit reached. Upgrade to Premium to monitor more wallets.' }

    const duplicate = await db.select({ id: monitoredWallet.id }).from(monitoredWallet).where(and(eq(monitoredWallet.userId, user.id), eq(monitoredWallet.blockchain, payload.blockchain), eq(monitoredWallet.walletAddress, address))).limit(1)
    if (duplicate.length) return { success: false, error: 'This wallet is already protected.' }

    const walletId = makeWalletId()
    await db.insert(monitoredWallet).values({ id: walletId, userId: user.id, blockchain: payload.blockchain, walletAddress: address, webhookId: null })

    // Provider registration is best-effort: the cron scanner remains the fallback
    // and wallet persistence must not fail because Notify is unavailable.
    let webhookId: string | null = null
    try {
      webhookId = await registerProviderWebhook(payload.blockchain, address)
      if (webhookId) {
        await db.update(monitoredWallet).set({ webhookId }).where(eq(monitoredWallet.id, walletId))
      }
    } catch (providerError) {
      console.error('[v0] Optional provider registration failed:', providerError)
    }
    revalidatePath('/')
    return { success: true, walletId, webhookId, message: `${payload.blockchain} radar initialized and active.` }
  } catch (error) {
    if (isDuplicateError(error)) return { success: false, error: 'This wallet is already protected.' }
    console.error('[v0] Radar registration failed:', error)
    return { success: false, error: 'Unable to initialize the security radar.' }
  }
}

export async function registerLiveSecurityRadar(payload: AddWalletPayload) {
  return registerSecurityRadar(payload)
}

export { registerProviderWebhook }

