import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { monitoredWallet, securityUser, isBlockchainType } from '@/lib/db/schema'
import { fetchLatestTransaction } from '@/lib/blockchain/providers'

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const wallets = await db.select({ wallet: monitoredWallet, user: securityUser }).from(monitoredWallet).innerJoin(securityUser, eq(monitoredWallet.userId, securityUser.id))
  const results = []

  for (const { wallet } of wallets) {
    if (!isBlockchainType(wallet.blockchain)) continue
    try {
      const transaction = await fetchLatestTransaction(wallet.blockchain, wallet.walletAddress)
      if (!transaction) continue
      const response = await fetch(new URL('/api/webhook/crypto', request.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-webhook-signature': await sign(JSON.stringify(transaction)) },
        body: JSON.stringify(transaction),
      })
      results.push({ wallet: wallet.id, status: response.status })
    } catch (error) {
      results.push({ wallet: wallet.id, error: error instanceof Error ? error.message : 'Provider error' })
    }
  }

  return NextResponse.json({ scanned: wallets.length, results })
}

async function sign(value: string) {
  const { createHmac } = await import('node:crypto')
  return `sha256=${createHmac('sha256', process.env.WEBHOOK_SIGNING_SECRET ?? '').update(value).digest('hex')}`
}
