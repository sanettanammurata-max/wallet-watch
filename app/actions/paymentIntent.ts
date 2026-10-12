'use server'

import { randomUUID } from 'node:crypto'
import { Asset, Horizon, Memo, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { paymentIntent } from '@/lib/db/schema'
import { getVerifiedSession } from './session'

const COMPANY_RECEIVER_WALLET = 'GBDZ5E7ENT5T3SUKGAU5KEVFGUKWIGKQFH45EZV4IRUHPYVI6Y7PTELI'
const PREMIUM_PRICE_USDC = '9.0000000'
const USDC_ASSET_CODE = 'USDC'
const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5M3R7EZ6E6S26JHEV2Z66QLXNZD5S2WAC7V3'
const INTENT_TTL_MS = 15 * 60 * 1000

const publicKeyPattern = /^G[A-Z2-7]{55}$/

export type PaymentIntentResponse = {
  success: boolean
  error?: string
  paymentIntentId?: string
  stellarUri?: string
  xdr?: string
}

export async function createStellarPaymentIntent(sourcePublicKey: string): Promise<PaymentIntentResponse> {
  try {
    const session = await getVerifiedSession()
    if (!session) return { success: false, error: 'Authentication checkpoint failed. Active session required.' }

    const source = sourcePublicKey.trim()
    if (!publicKeyPattern.test(source)) return { success: false, error: 'A valid Stellar public key is required.' }

    const horizonUrl = process.env.STELLAR_HORIZON_URL ?? 'https://horizon.stellar.org'
    const horizon = new Horizon.Server(horizonUrl)
    const account = await horizon.loadAccount(source)
    const nonce = randomUUID().replaceAll('-', '')
    const intentId = `intent_${randomUUID().replaceAll('-', '')}`
    const expiresAt = new Date(Date.now() + INTENT_TTL_MS)

    const transaction = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(Operation.payment({
        destination: COMPANY_RECEIVER_WALLET,
        asset: new Asset(USDC_ASSET_CODE, USDC_ISSUER),
        amount: PREMIUM_PRICE_USDC,
      }))
      .addMemo(Memo.text(intentId.slice(-28)))
      .setTimeout(Math.floor(INTENT_TTL_MS / 1000))
      .build()

    const xdr = transaction.toXDR()
    await db.insert(paymentIntent).values({
      id: intentId,
      userId: session.userId,
      nonce,
      network: 'PUBLIC',
      amount: PREMIUM_PRICE_USDC,
      assetCode: USDC_ASSET_CODE,
      assetIssuer: USDC_ISSUER,
      receiver: COMPANY_RECEIVER_WALLET,
      expiresAt,
    })

    const stellarUri = `web+stellar:tx?xdr=${encodeURIComponent(xdr)}`
    return { success: true, paymentIntentId: intentId, stellarUri, xdr }
  } catch (error) {
    console.error('Payment intent creation failed:', error)
    return { success: false, error: 'Unable to create a Stellar payment intent.' }
  }
}

export async function expirePaymentIntent(paymentIntentId: string) {
  const session = await getVerifiedSession()
  if (!session) return { success: false, error: 'Unauthorized operation.' }
  await db.update(paymentIntent)
    .set({ status: 'expired' })
    .where(and(eq(paymentIntent.id, paymentIntentId), eq(paymentIntent.userId, session.userId)))
  return { success: true }
}
