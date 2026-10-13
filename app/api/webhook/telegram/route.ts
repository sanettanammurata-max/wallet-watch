import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { securityUser } from '@/lib/db/schema'
import { publicDashboardUrl, sendTelegramMessage } from '@/lib/telegram-bot'

export async function POST(request: Request) {
  const update = await request.json().catch(() => null) as { message?: { chat?: { id?: number }; text?: string } } | null
  const chatId = update?.message?.chat?.id
  const text = update?.message?.text?.trim() ?? ''
  if (!chatId) return NextResponse.json({ ok: true })

  if (text === '/start' || text === '/help') {
    await sendTelegramMessage(String(chatId), `Sentinella monitora i tuoi wallet pubblici e ti invia un avviso quando rileva movimenti.\n\nApri la dashboard per collegare Telegram e aggiungere un wallet:\n${publicDashboardUrl()}\n\nNon inviare mai seed phrase o chiavi private.`)
  } else if (text === '/dashboard') {
    await sendTelegramMessage(String(chatId), `Dashboard Sentinella:\n${publicDashboardUrl()}\n\nDopo l'accesso, incolla un indirizzo pubblico e premi “Start monitoring”.`)
  } else if (text) {
    const user = await db.select({ id: securityUser.id }).from(securityUser).where(eq(securityUser.telegramChatId, String(chatId))).limit(1)
    if (user[0]) await sendTelegramMessage(String(chatId), `Ho ricevuto il messaggio. Per aggiungere o gestire un wallet usa la dashboard:\n${publicDashboardUrl()}`)
  }

  return NextResponse.json({ ok: true })
}
