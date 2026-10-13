'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'

type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void
  }
}

export default function TelegramLoginButton() {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const botUsername = 'sentinella_shield_bot'
    if (!botUsername) {
      setError('Telegram login is not configured.')
      return
    }

    window.onTelegramAuth = async (user) => {
      setError('')
      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...user, id: String(user.id), auth_date: String(user.auth_date) }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(result.error ?? 'Telegram identity validation failed.')
        return
      }
      router.replace('/')
      router.refresh()
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?7'
    script.async = true
    script.dataset.telegramLogin = botUsername
    script.dataset.size = 'large'
    script.dataset.radius = '10'
    script.dataset.requestAccess = 'write'
    script.dataset.onAuth = 'onTelegramAuth(user)'
    containerRef.current?.appendChild(script)

    return () => {
      script.remove()
      delete window.onTelegramAuth
    }
  }, [router])

  return (
    <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card/90 shadow-2xl shadow-black/20">
      <div className="border-b border-border px-6 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
          <div><p className="font-mono text-xs font-bold tracking-[0.2em] text-primary">SOLAY39</p><p className="text-xs text-muted-foreground">Blockchain protection network</p></div>
        </div>
      </div>
      <div className="px-6 py-9 sm:px-8 sm:py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Private monitoring network</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Protect your wallet before the threat arrives.</h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Connect with Telegram to open your private security console. Your public addresses stay monitored; private keys never leave your wallet.</p>
        <div className="mt-8 rounded-2xl border border-border bg-background/70 p-5">
          <div className="flex items-center gap-2 text-sm font-medium"><LockKeyhole className="size-4 text-primary" />Secure Telegram sign-in</div>
          <div ref={containerRef} className="mt-5 flex min-h-12 justify-center" aria-label="Telegram login widget" />
          {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">{error}</p>}
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ArrowRight className="size-3.5 text-primary" />No passwords. No private keys. Just verified access.</div>
      </div>
    </section>
  )
}
