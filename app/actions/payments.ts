'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { securityUser } from '@/lib/db/schema'
import { getVerifiedSession } from './session'

export interface VerifyPaymentPayload {
  stellarTxHash: string
}

const PREMIUM_PRICE_USDC = process.env.PREMIUM_PRICE_USDC ?? '9.0000000'
const USDC_ASSET_CODE = 'USDC'
const USDC_ISSUER = process.env.STELLAR_USDC_ISSUER ?? 'GA5ZSEJYB37JRC5AVCIA5M3R7EZ6E6S26JHEV2Z66QLXNZD5S2WAC7V3'

export async function processCryptoSubscriptionPayment(payload: VerifyPaymentPayload) {
  const txHash = payload.stellarTxHash.trim()
  const receiver = process.env.STELLAR_COMPANY_WALLET ?? 'GBDZ5E7ENT5T3SUKGAU5KEVFGUKWIGKQFH45EZV4IRUHPYVI6Y7PTELI'
  const session = await getVerifiedSession()

  if (!session) return { success: false, error: 'Unauthorized access. Active session required.' }
  if (!/^[a-f0-9]{64}$/i.test(txHash)) return { success: false, error: 'A valid Stellar transaction hash is required.' }
  if (!receiver) return { success: false, error: 'Premium payments are not configured yet.' }

  try {
    const transactionResponse = await fetch(`https://horizon.stellar.org/transactions/${encodeURIComponent(txHash)}`, { cache: 'no-store' })
    if (!transactionResponse.ok) return { success: false, error: 'Transaction not found on the Stellar network.' }
    const transaction = await transactionResponse.json() as { successful?: boolean }
    if (transaction.successful !== true) return { success: false, error: 'The Stellar transaction was not successful.' }

    const operationsResponse = await fetch(`https://horizon.stellar.org/transactions/${encodeURIComponent(txHash)}/operations`, { cache: 'no-store' })
    if (!operationsResponse.ok) return { success: false, error: 'Unable to verify the Stellar payment operation.' }
    const operationsData = await operationsResponse.json() as { _embedded?: { records?: Array<Record<string, unknown>> } }
    const payment = operationsData._embedded?.records?.find((operation) =>
      operation.type === 'payment' &&
      operation.to === receiver &&
      operation.amount === PREMIUM_PRICE_USDC &&
      operation.asset_code === USDC_ASSET_CODE &&
      operation.asset_issuer === USDC_ISSUER,
    )

    if (!payment) return { success: false, error: `Send exactly ${PREMIUM_PRICE_USDC} USDC to the configured company wallet.` }

    const updated = await db.update(securityUser).set({ isPremium: true }).where(eq(securityUser.id, session.userId)).returning({ id: securityUser.id })
    if (!updated.length) return { success: false, error: 'Security profile not found.' }

    revalidatePath('/')
    return { success: true, message: 'Payment verified. Premium protection is now active.' }
  } catch (error) {
    console.error('[v0] Stellar payment verification failed:', error)
    return { success: false, error: 'Unable to verify the payment right now.' }
  }
}
