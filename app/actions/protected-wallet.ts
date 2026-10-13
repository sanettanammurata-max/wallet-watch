'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getVerifiedSession } from '@/app/actions/session'
import {
  isDuplicateError,
  isPublicAddressOnly,
  isValidWalletAddress,
  limitForPlan,
  makeWalletId,
  monitoredWallet,
  normalizeAddress,
  securityUser,
  type BlockchainType,
} from '@/lib/db/schema'
import { registerProviderWebhook } from '@/app/actions/radar'
import { sendTelegramMessage } from '@/lib/telegram-bot'

const addWalletSchema = z.object({
  blockchain: z.enum(['BITCOIN', 'ETHEREUM', 'SOLANA', 'STELLAR', 'XRP']),
  walletAddress: z.string().trim().min(1).max(128),
})

export async function addProtectedWallet(input: unknown) {
  const session = await getVerifiedSession()
  if (!session) return { success: false, error: 'Authentication required.' as const }

  const parsed = addWalletSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid wallet request.' as const }

  const address = normalizeAddress(parsed.data.walletAddress)
  const blockchain = parsed.data.blockchain as BlockchainType
  if (!isPublicAddressOnly(address)) return { success: false, error: 'Only public wallet addresses are accepted.' as const }
  if (!isValidWalletAddress(blockchain, address)) return { success: false, error: `Invalid ${blockchain} address format.` as const }

  try {
    const user = await db.select().from(securityUser).where(eq(securityUser.id, session.userId)).limit(1)
    if (!user[0]) return { success: false, error: 'Authenticated user was not found.' as const }

    const wallets = await db.select({ id: monitoredWallet.id }).from(monitoredWallet).where(eq(monitoredWallet.userId, user[0].id))
    if (wallets.length >= limitForPlan(user[0].isPremium)) return { success: false, error: 'Wallet limit reached for this plan.' as const }

    const duplicate = await db.select({ id: monitoredWallet.id }).from(monitoredWallet).where(and(
      eq(monitoredWallet.userId, user[0].id),
      eq(monitoredWallet.blockchain, blockchain),
      eq(monitoredWallet.walletAddress, address),
    )).limit(1)
    if (duplicate[0]) return { success: false, error: 'This wallet is already protected.' as const }

    const walletId = makeWalletId()
    await db.insert(monitoredWallet).values({ id: walletId, userId: user[0].id, blockchain, walletAddress: address, webhookId: null })

    let webhookId: string | null = null
    try {
      webhookId = await registerProviderWebhook(blockchain, address)
      if (webhookId) {
        await db.update(monitoredWallet).set({ webhookId }).where(eq(monitoredWallet.id, walletId))
      }
    } catch (providerError) {
      console.error('[v0] Provider webhook registration skipped:', providerError)
    }
    let telegramNotified = false
    try {
      telegramNotified = await sendTelegramMessage(String(user[0].telegramChatId), `Wallet aggiunto correttamente.\n\nRete: ${blockchain}\nIndirizzo: ${address}\n\nIl monitoraggio è attivo. Ti avviserò qui quando rileverò un movimento.`)
    } catch (telegramError) {
      console.error('[v0] Telegram notification failed after wallet save:', telegramError)
    }
    revalidatePath('/')
    return { success: true, walletId, blockchain, walletAddress: address, telegramNotified }
  } catch (error) {
    if (isDuplicateError(error)) return { success: false, error: 'This wallet is already protected.' as const }
    console.error('[v0] Secure wallet registration failed:', error)
    return { success: false, error: 'Unable to initialize the security radar.' as const }
  }
}
