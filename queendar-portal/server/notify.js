// Prefer Queen-specific token; fall back to NimbusOpsbot vault keys on Hostman.
const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.NIMBUS_TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_OPS_BOT_TOKEN ||
  ''
const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CHAT_ID ||
  process.env.NIMBUS_TELEGRAM_CHAT_ID ||
  process.env.TELEGRAM_OPS_CHAT_ID ||
  ''

export function telegramConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)
}

async function sendTelegram(text) {
  if (!telegramConfigured()) {
    console.log('[queendar][notify] Telegram not configured — skipping')
    return false
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Telegram send failed: ${res.status} ${body}`)
  }
  return true
}

export async function notifyBookingInquiry(booking) {
  const lines = [
    '🎭 Queendar booking inquiry',
    '',
    `Performer: ${booking.performerName} (@${booking.performerSlug})`,
    `From: ${booking.name} <${booking.email}>`,
    booking.eventDate ? `Date: ${booking.eventDate}` : null,
    booking.venue ? `Venue: ${booking.venue}` : null,
    booking.message ? `\n${booking.message}` : null,
    '',
    `ID: ${booking.id}`,
  ].filter(Boolean)

  return sendTelegram(lines.join('\n'))
}
