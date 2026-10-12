import 'dotenv/config'
import { db } from './index'
import { securityAlert, securityUser, monitoredWallet, makeUserId, makeWalletId } from './schema'
import { eq } from 'drizzle-orm'

const DEMO_CHAT_ID = 'demo-ui-seed-user'
const DEMO_WALLET = 'GBDZ5E7ENT5T3SUKGAU5KEVFGUKWIGKQFH45EZV4IRUHPYVI6Y7PTELI'

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed is disabled. Set ALLOW_DEMO_SEED=true in a non-production environment.')
  }

  const [user] = await db
    .insert(securityUser)
    .values({ id: makeUserId(), telegramChatId: DEMO_CHAT_ID, isPremium: true })
    .onConflictDoUpdate({ target: securityUser.telegramChatId, set: { isPremium: true } })
    .returning()

  const [wallet] = await db
    .insert(monitoredWallet)
    .values({
      id: makeWalletId(),
      userId: user.id,
      blockchain: 'STELLAR',
      walletAddress: DEMO_WALLET,
      webhookId: 'demo-seed-webhook',
    })
    .onConflictDoNothing()
    .returning()

  const walletId = wallet?.id ?? (await db.select({ id: monitoredWallet.id }).from(monitoredWallet).where(eq(monitoredWallet.userId, user.id)).limit(1))[0]?.id
  if (!walletId) throw new Error('Unable to resolve demo wallet.')

  const alerts = [
    ['ADDRESS_POISONING_SCAM', '0.0000001', 'USDC', 'demo_stellar_poison_001'],
    ['UNAUTHORIZED_OUTGOING', '1450.0000000', 'XLM', 'demo_stellar_outgoing_001'],
    ['SUSPICIOUS_VOLUME', '50000.0000000', 'USDC', 'demo_stellar_volume_001'],
  ] as const

  for (const [alertType, amount, tokenSymbol, txHash] of alerts) {
    await db.insert(securityAlert).values({
      id: `demo_${txHash}`,
      userId: user.id,
      blockchain: 'STELLAR',
      walletAddress: DEMO_WALLET,
      alertType,
      amount,
      tokenSymbol,
      txHash,
    }).onConflictDoNothing()
  }

  console.log(`Demo seed ready for ${DEMO_CHAT_ID}. Wallet: ${walletId}`)
}

main().catch((error) => {
  console.error('Demo seed failed:', error)
  process.exitCode = 1
})
