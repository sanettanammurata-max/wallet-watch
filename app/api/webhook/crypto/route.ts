import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { monitoredWallet, securityAlert, securityUser, getExplorerUrl, isBlockchainType, truncateForMessage } from '@/lib/db/schema'
import { sendTelegramMessage } from '@/lib/telegram-bot'

function isValidSignature(rawBody: string, signature: string | null) {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret || !signature) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const providedValue = signature.replace(/^sha256=/, '').trim()
  if (!/^[a-f0-9]{64}$/i.test(providedValue)) return false

  const provided = Buffer.from(providedValue, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer)
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function parseIncomingPayload(body: Record<string, unknown>) {
  const envelope = body.data && typeof body.data === 'object' ? body.data as Record<string, unknown> : body
  const event = envelope.event && typeof envelope.event === 'object' ? envelope.event as Record<string, unknown> : envelope
  const activity = Array.isArray(event.activity) && event.activity[0] && typeof event.activity[0] === 'object'
    ? event.activity[0] as Record<string, unknown>
    : event

  return {
    address: readString(activity.address ?? activity.account ?? event.address ?? event.account),
    blockchain: readString(activity.blockchain ?? activity.network ?? event.blockchain ?? event.network, 'ETHEREUM').toUpperCase(),
    amount: String(activity.amount ?? activity.value ?? event.amount ?? '0').trim(),
    token: readString(activity.token ?? activity.asset ?? activity.tokenSymbol ?? event.token, 'NATIVE'),
    from: readString(activity.from ?? activity.fromAddress ?? event.from),
    to: readString(activity.to ?? activity.toAddress ?? event.to),
    txHash: readString(activity.txHash ?? activity.hash ?? activity.transactionHash ?? event.txHash ?? event.hash),
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-webhook-signature') ?? request.headers.get('x-alchemy-signature')
  if (!isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Unauthorized source' }, { status: 401 })
  }

  try {
    const body = JSON.parse(rawBody) as Record<string, unknown>
    const { address, blockchain, amount, token, from, to, txHash } = parseIncomingPayload(body)

    if (!address || !txHash || !isBlockchainType(blockchain) || !/^[0-9]+(?:\.[0-9]+)?$/.test(amount)) {
      return NextResponse.json({ error: 'Malformed payload' }, { status: 400 })
    }

    const result = await db
      .select({ wallet: monitoredWallet, user: securityUser })
      .from(monitoredWallet)
      .innerJoin(securityUser, eq(monitoredWallet.userId, securityUser.id))
      .where(and(eq(monitoredWallet.walletAddress, address), eq(monitoredWallet.blockchain, blockchain)))
      .limit(1)

    if (!result.length) return NextResponse.json({ message: 'Address not actively monitored.' })

    const { user } = result[0]
    const outgoing = from.toLowerCase() === address.toLowerCase()
    const numericAmount = Number(amount)
    const poisoned = numericAmount === 0 || amount === '0.000001'
    const alertType = outgoing
      ? 'UNAUTHORIZED_OUTGOING'
      : poisoned
        ? 'ADDRESS_POISONING_SCAM'
        : 'SUSPICIOUS_VOLUME'

    const insertResult = await db.insert(securityAlert).values({
      id: crypto.randomUUID(),
      userId: user.id,
      blockchain,
      walletAddress: address,
      alertType,
      amount,
      tokenSymbol: token,
      txHash,
      resolved: false,
    }).onConflictDoNothing({ target: securityAlert.txHash }).returning({ id: securityAlert.id })

    if (insertResult.length && process.env.TELEGRAM_BOT_TOKEN) {
      const text = [
        `SHIELD SECURITY ALERT [${blockchain}]`,
        '',
        outgoing ? 'CRITICAL: An outgoing transfer was detected.' : poisoned ? 'WARNING: Potential address poisoning dust transaction.' : 'Suspicious activity detected.',
        '',
        `Asset: ${amount} ${token}`,
        `From: ${truncateForMessage(from)}`,
        `To: ${truncateForMessage(to)}`,
        `Ledger proof: ${getExplorerUrl(blockchain, txHash)}`,
      ].join('\n')

      await sendTelegramMessage(String(user.telegramChatId), text)
    }

    return NextResponse.json({ success: true, duplicate: insertResult.length === 0, trackingId: txHash })
  } catch (error) {
    console.error('[v0] Webhook processor error:', error)
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })
  }
}
