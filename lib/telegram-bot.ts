const telegramApi = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  const response = await fetch(`${telegramApi()}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  })

  if (!response.ok) {
    console.error('[v0] Telegram message failed:', await response.text())
    return false
  }
  return true
}

export function publicDashboardUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://wallet-watch-snowy.vercel.app'
}

export async function setTelegramWebhook() {
  const response = await fetch(`${telegramApi()}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: `${publicDashboardUrl()}/api/webhook/telegram` }),
  })
  return response.ok
}
