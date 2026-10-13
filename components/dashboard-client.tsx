'use client'

import { useMemo, useState } from 'react'
import { Bell, CheckCircle2, Copy, LogOut, Plus, Radar, ShieldCheck, WalletCards, X, AlertTriangle } from 'lucide-react'
import { addProtectedWallet } from '@/app/actions/protected-wallet'
import { deleteRadar } from '@/app/actions/deleteRadar'
import { resolveSecurityAlert } from '@/app/actions/resolveAlert'
import { type BlockchainType } from '@/lib/db/schema'

type Chain = 'BITCOIN' | 'ETHEREUM' | 'SOLANA' | 'STELLAR' | 'XRP'
  type Wallet = { id: string; chain: Chain; address: string; status: 'Active' | 'Syncing' }
type Alert = { id: string; blockchain: Chain; walletAddress: string; alertType: string; amount: string; tokenSymbol: string; txHash: string; resolved: boolean; createdAt: string }
type DashboardProps = { telegramChatId: string; initialWallets: Wallet[]; alerts: Alert[]; isPremium: boolean }

const chainNames: Record<Chain, string> = { BITCOIN: 'Bitcoin', ETHEREUM: 'Ethereum', SOLANA: 'Solana', STELLAR: 'Stellar', XRP: 'XRP Ledger' }
  const chainMarks: Record<Chain, string> = { BITCOIN: 'BTC', ETHEREUM: 'ETH', SOLANA: 'SOL', STELLAR: 'XLM', XRP: 'XRP' }

export default function Dashboard({ telegramChatId, initialWallets, alerts, isPremium }: DashboardProps) {
  const [wallets, setWallets] = useState(initialWallets)
  const [activeAlerts, setActiveAlerts] = useState(() => alerts.filter((item) => !item.resolved))
  const [modalOpen, setModalOpen] = useState(false)
  const [chain, setChain] = useState<Chain>('ETHEREUM')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const limit = isPremium ? 5 : 1
  const initials = telegramChatId.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase() || 'SE'
  const usage = useMemo(() => Math.min(100, (wallets.length / limit) * 100), [wallets.length, limit])

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!address.trim() || busy) return
    setBusy(true)
    try {
      const result = await addProtectedWallet({ blockchain: chain, walletAddress: address.trim() })
      if (!result.success || !result.walletId) { window.alert(result.error || 'Wallet could not be added.'); return }
      setWallets((current) => [...current, { id: result.walletId, chain, address: `${address.trim().slice(0, 7)}…${address.trim().slice(-5)}`, status: 'Active' }])
      setAddress(''); setModalOpen(false)
    } catch (error) {
      console.error('[v0] Wallet registration request failed:', error)
      window.alert('Unable to save this wallet. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteRadar({ walletId: id })
    if (!result.success) { window.alert(result.error); return }
    setWallets((current) => current.filter((wallet) => wallet.id !== id))
  }

  async function handleResolve(id: string) {
    const result = await resolveSecurityAlert({ alertId: id })
    if (!result.success) { window.alert(result.error); return }
    setActiveAlerts((current) => current.filter((alert) => alert.id !== id))
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3"><div className="relative flex size-10 items-center justify-center overflow-hidden rounded-xl border border-primary/30 bg-card"><img src="/solay39-logo.png" alt="Solay39" className="size-full object-cover" /></div><div><p className="font-mono text-sm font-bold tracking-[0.18em]">SOLAY39</p><p className="text-[10px] uppercase tracking-[0.16em] text-primary">Security command center</p></div></div>
          <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-xs font-medium">Telegram verified</p><p className="font-mono text-[10px] text-muted-foreground">{telegramChatId || 'connected account'}</p></div><div className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{initials}</div><button className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted sm:block" aria-label="Sign out"><LogOut className="size-4" /></button></div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-12">
        <section className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-card p-6 shadow-[0_24px_80px_-40px_hsl(var(--primary))] sm:p-10"><div className="absolute inset-y-0 right-0 w-1/3 border-l border-primary/10 bg-primary/[0.03]" /><div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary"><span className="size-2 rounded-full bg-primary shadow-[0_0_16px_hsl(var(--primary))]" />Live protection layer</div><h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-balance sm:text-6xl">Your safeguarded addresses are in view.</h1><p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">Add a public address below. Solay39 checks the chain on a schedule, records each detected transaction, and sends critical findings to your verified Telegram chat.</p></div><button onClick={() => setModalOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"><Plus className="size-4" />Safeguard an address</button></div></section>

        <section className="mt-6 rounded-2xl border border-primary/25 bg-card p-5 shadow-[0_12px_40px_-28px_hsl(var(--primary))] sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2"><WalletCards className="size-4 text-primary" /><h2 className="font-semibold">Add a wallet to monitor</h2></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Insert the public address below. Never enter a seed phrase or private key.</p></div><form onSubmit={handleAdd} className="grid w-full gap-3 sm:grid-cols-[150px_1fr_auto] lg:max-w-4xl"><label className="sr-only" htmlFor="inline-chain">Blockchain</label><select id="inline-chain" value={chain} onChange={(event) => setChain(event.target.value as Chain)} className="rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring">{Object.entries(chainNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label className="sr-only" htmlFor="inline-wallet-address">Public wallet address</label><input id="inline-wallet-address" name="walletAddress" type="text" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Paste the public wallet address" autoComplete="off" spellCheck={false} className="min-w-0 rounded-xl border border-input bg-background px-3 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring" /><button disabled={busy} type="submit" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Activating…' : 'Start monitoring'}</button></form></div></section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="Protected wallets" value={`${wallets.length}/${limit}`} detail="coverage slots" icon={WalletCards} /><Stat label="Radar status" value={wallets.length ? 'ONLINE' : 'IDLE'} detail={wallets.length ? 'watching continuously' : 'add an address to start'} icon={Radar} /><Stat label="Open alerts" value={String(activeAlerts.length)} detail={activeAlerts.length ? 'needs your attention' : 'no active threats'} icon={activeAlerts.length ? AlertTriangle : CheckCircle2} /></section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
          <section className="rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold">Safeguarded addresses</h2><p className="mt-1 text-xs text-muted-foreground">Public wallet addresses under observation</p></div><a href="/dashboard/profile" className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label="Manage safeguard"><Plus className="size-4" /></a></div>{wallets.length ? <div className="divide-y divide-border">{wallets.map((wallet) => <div key={wallet.id} className="flex items-center gap-3 px-5 py-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary font-mono text-[10px] font-bold text-secondary-foreground">{chainMarks[wallet.chain]}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-mono text-sm">{wallet.address}</p><button type="button" onClick={() => navigator.clipboard?.writeText(wallet.address)} className="text-muted-foreground hover:text-foreground" aria-label="Copy wallet address"><Copy className="size-3.5" /></button></div><p className="mt-1 text-xs text-muted-foreground">{chainNames[wallet.chain]} · <span className="text-primary">Active</span></p></div><button onClick={() => handleDelete(wallet.id)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button></div>)}</div> : <div className="px-5 py-12 text-center"><Radar className="mx-auto size-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-medium">No wallet is connected yet</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Choose a network and paste a public address. Never enter a seed phrase or private key.</p><button onClick={() => setModalOpen(true)} className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Add first wallet</button></div>}<div className="border-t border-border px-5 py-4"><button onClick={() => setModalOpen(true)} className="text-sm font-medium text-primary hover:underline">+ Add another wallet</button></div></section>

          <section className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Coverage plan</h2><p className="mt-1 text-xs text-muted-foreground">{isPremium ? 'Premium protection' : 'Free protection'}</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-bold text-primary">{isPremium ? 'PRO' : 'FREE'}</span></div><div className="mt-8 flex items-baseline gap-1"><span className="text-4xl font-semibold">{isPremium ? '$9' : '$0'}</span><span className="text-sm text-muted-foreground">/ month</span></div><div className="mt-6 flex justify-between text-xs text-muted-foreground"><span>Wallet coverage</span><span>{wallets.length} of {limit}</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usage}%` }} /></div><p className="mt-5 text-xs leading-5 text-muted-foreground">Every protected address is checked against incoming webhook events and suspicious transfer patterns.</p></section>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-3"><Bell className="size-4 text-primary" /><div><h2 className="font-semibold">Threat history</h2><p className="mt-1 text-xs text-muted-foreground">Verified events from your monitored wallets</p></div></div><span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] text-muted-foreground">{activeAlerts.length} open</span></div>{activeAlerts.length ? <div className="divide-y divide-border">{activeAlerts.map((alert) => <div key={alert.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-destructive/10 px-2 py-1 font-mono text-[10px] font-bold text-destructive">{alert.alertType.replaceAll('_', ' ')}</span><span className="text-xs text-muted-foreground">{alert.blockchain}</span></div><p className="mt-2 truncate font-mono text-xs text-muted-foreground">{alert.txHash}</p></div><div className="flex items-center justify-between gap-5 sm:justify-end"><div className="text-right text-xs text-muted-foreground"><p className="font-medium text-foreground">{alert.amount} {alert.tokenSymbol}</p><p className="mt-1">{new Date(alert.createdAt).toLocaleDateString('en-US')}</p></div><button onClick={() => handleResolve(alert.id)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">Resolve</button></div></div>)}</div> : <div className="flex flex-col items-center px-5 py-12 text-center"><CheckCircle2 className="size-8 text-primary" /><p className="mt-3 text-sm font-medium">No active threats</p><p className="mt-1 text-xs text-muted-foreground">Your monitored addresses look quiet.</p></div>}</section>
      </div>

      {modalOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/75 p-4 backdrop-blur-sm sm:items-center"><div role="dialog" aria-modal="true" aria-labelledby="wallet-dialog-title" className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="wallet-dialog-title" className="text-lg font-semibold">Connect a wallet to Solay39</h2><p className="mt-1 text-sm text-muted-foreground">We only need the public address. Your funds never leave the wallet.</p></div><button onClick={() => setModalOpen(false)} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="size-5" /></button></div><form onSubmit={handleAdd} className="mt-6 flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">Network<select value={chain} onChange={(event) => setChain(event.target.value as Chain)} className="rounded-xl border border-input bg-background px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-ring">{Object.entries(chainNames).map(([key, label]) => <option key={key} value={key}>{label} ({chainMarks[key as Chain]})</option>)}</select></label><label htmlFor="wallet-address" className="flex flex-col gap-2 text-sm font-medium">Public address<input id="wallet-address" name="walletAddress" type="text" required autoFocus value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Paste a public address" autoComplete="off" spellCheck={false} inputMode="text" className="w-full rounded-xl border border-input bg-background px-3 py-3 font-mono text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring" /></label><button disabled={busy} type="submit" className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? 'Activating radar…' : 'Start monitoring'}</button></form></div></div>}
    </main>
  )
}

function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Radar }) { return <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p><Icon className="size-4 text-primary" /></div><p className="mt-5 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div> }
