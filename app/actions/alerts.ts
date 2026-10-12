'use server'

import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { securityAlert, securityUser } from '@/lib/db/schema'

export async function getAuthenticatedUser() {
  const requestHeaders = await headers()
  const userId = requestHeaders.get('x-shield-user-id')
  if (!userId) return null
  const result = await db.select().from(securityUser).where(eq(securityUser.id, userId)).limit(1)
  return result[0] ?? null
}

export async function getThreatHistory() {
  const user = await getAuthenticatedUser()
  if (!user) return []
  return db.select().from(securityAlert).where(and(eq(securityAlert.userId, user.id))).orderBy(desc(securityAlert.createdAt)).limit(100)
}

export async function logThreatToDatabase(payload: {
  userId: string
  blockchain: string
  walletAddress: string
  alertType: string
  amount: string
  tokenSymbol: string
  txHash: string
}) {
  await db.insert(securityAlert).values({ id: crypto.randomUUID(), ...payload, resolved: false }).onConflictDoNothing({ target: securityAlert.txHash })
}
