import { and, desc, eq } from 'drizzle-orm'
import TelegramLoginButton from '@/components/TelegramLoginButton'
import Dashboard from '@/components/dashboard-client'
import { getVerifiedSession } from '@/app/actions/session'
import { db } from '@/lib/db'
import { monitoredWallet, securityAlert, securityUser } from '@/lib/db/schema'

export default async function DashboardPage() {
  const session = await getVerifiedSession()

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
        <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
          <h1 className="text-2xl font-semibold">Open your security dashboard</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Authenticate with Telegram to add and monitor your public wallet addresses.</p>
          <div className="mt-8 flex justify-center"><TelegramLoginButton /></div>
        </section>
      </main>
    )
  }

  const user = await db.select().from(securityUser).where(eq(securityUser.id, session.userId)).limit(1)
  if (!user[0]) return null

  const [walletRows, alertRows] = await Promise.all([
    db.select().from(monitoredWallet).where(eq(monitoredWallet.userId, user[0].id)).orderBy(desc(monitoredWallet.createdAt)),
    db.select().from(securityAlert).where(and(eq(securityAlert.userId, user[0].id), eq(securityAlert.resolved, false))).orderBy(desc(securityAlert.createdAt)),
  ])

  return (
    <Dashboard
      telegramChatId={session.chatId}
      isPremium={user[0].isPremium}
      initialWallets={walletRows.map((wallet) => ({
        id: wallet.id,
        chain: wallet.blockchain as 'BITCOIN' | 'ETHEREUM' | 'SOLANA' | 'STELLAR' | 'XRP',
        address: wallet.walletAddress.length > 16 ? `${wallet.walletAddress.slice(0, 7)}…${wallet.walletAddress.slice(-5)}` : wallet.walletAddress,
        status: 'Active' as const,
      }))}
      alerts={alertRows.map((alert) => ({
        id: alert.id,
        blockchain: alert.blockchain as 'BITCOIN' | 'ETHEREUM' | 'SOLANA' | 'STELLAR' | 'XRP',
        walletAddress: alert.walletAddress,
        alertType: alert.alertType,
        amount: alert.amount,
        tokenSymbol: alert.tokenSymbol,
        txHash: alert.txHash,
        resolved: alert.resolved,
        createdAt: alert.createdAt.toISOString(),
      }))}
    />
  )
}
