"use client"

import { FormEvent, useState } from 'react'
import { registerSecurityRadar } from '@/app/actions/radar'
import { blockchainLabels, blockchainTypes, type BlockchainType } from '@/lib/db/schema'

type Radar = { id: string; blockchain: BlockchainType; walletAddress: string; createdAt: string; webhookId: string | null }

export default function RadarProfile({ telegramChatId, isPremium, initialWallets }: { telegramChatId: string; isPremium: boolean; initialWallets: Radar[] }) {
  const [network, setNetwork] = useState<BlockchainType>('ETHEREUM')
  const [address, setAddress] = useState('')
  const [wallets, setWallets] = useState(initialWallets)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(null)
    setBusy(true)
    const result = await registerSecurityRadar({ telegramChatId, blockchain: network, walletAddress: address })
    if (result.success && result.walletId) {
      setWallets((current) => [...current, { id: result.walletId!, blockchain: network, walletAddress: address.trim(), createdAt: new Date().toISOString(), webhookId: result.webhookId ?? null }])
      setAddress('')
      setStatus('Protection is active for this address.')
    } else {
      setStatus(result.error ?? 'Unable to activate protection.')
    }
    setBusy(false)
  }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Solay39 / Safeguard</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Protected wallet addresses</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Register public addresses to monitor their on-chain activity. Solay39 never asks for a seed phrase or private key.</p></div>
          <div className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">{isPremium ? 'Premium protection' : `${wallets.length} / 1 free address`}</div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={submit} className="rounded-2xl border border-primary/25 bg-card p-6 shadow-lg">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Register an address</p><h2 className="mt-3 text-xl font-semibold">Start a new safeguard radar</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Choose the network, paste the public address, and activate monitoring.</p>
            <div className="mt-6 space-y-4"><label className="block text-sm font-medium">Blockchain<select value={network} onChange={(event) => setNetwork(event.target.value as BlockchainType)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"><option value="ETHEREUM">Ethereum</option><option value="BITCOIN">Bitcoin</option><option value="SOLANA">Solana</option><option value="STELLAR">Stellar</option><option value="XRP">XRP Ledger</option></select></label><label className="block text-sm font-medium">Public wallet address<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x..., bc1..., or public address" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 font-mono text-sm outline-none focus:border-primary" required /></label><button disabled={busy} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Activating safeguard...' : 'Activate safeguard'}</button></div>
            {status && <p role="status" className="mt-4 text-sm text-primary">{status}</p>}
          </form>
          <aside className="rounded-2xl border border-border bg-card p-6"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Your radar network</p><div className="mt-5 space-y-4"><div><p className="text-2xl font-semibold">{wallets.length}</p><p className="text-xs text-muted-foreground">addresses protected</p></div><div className="border-t border-border pt-4"><p className="text-sm font-medium">Telegram alerts</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Connected to chat {telegramChatId}</p></div><div className="border-t border-border pt-4"><p className="text-sm font-medium">Public-address only</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your funds and signing keys remain outside Solay39.</p></div></div></aside>
        </section>

        <section className="mt-8"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Active radars</h2><span className="text-xs text-muted-foreground">{wallets.length} total</span></div><div className="mt-4 space-y-3">{wallets.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No addresses protected yet.</div> : wallets.map((wallet) => <article key={wallet.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary">{blockchainLabels[wallet.blockchain]}</span><span className="text-xs text-primary">Live</span></div><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{wallet.walletAddress}</p></div><p className="text-xs text-muted-foreground">Added {new Date(wallet.createdAt).toLocaleDateString('en-US')}</p></article>)}</div></section>
      </div>
    </main>
  )
}

export { blockchainTypes }
