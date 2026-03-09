import { dailyPassword, nyDateString, headerValue } from './_auth.js'

export default async function handler(req, res) {
  const token = headerValue(req, 'x-admin-token')
  if (!process.env.PASSWORD_BOT_TOKEN || token !== process.env.PASSWORD_BOT_TOKEN) {
    return res.status(401).json({ ok: false, reason: 'unauthorized' })
  }
  const secret = process.env.DASHBOARD_PASSWORD_SECRET || ''
  if (!secret) return res.status(500).json({ ok: false, reason: 'missing_dashboard_password_secret' })
  const date = nyDateString(0)
  const password = dailyPassword(secret, date)
  res.status(200).json({ ok: true, date, password })
}
