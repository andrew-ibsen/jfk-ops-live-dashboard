import { headerValue } from './_auth.js'

export default async function handler(req, res) {
  const token = headerValue(req, 'x-admin-token')
  if (!process.env.PASSWORD_BOT_TOKEN || token !== process.env.PASSWORD_BOT_TOKEN) {
    return res.status(401).json({ ok: false, reason: 'unauthorized' })
  }
  const password = process.env.DASHBOARD_DAILY_PASSWORD || ''
  if (!password) return res.status(500).json({ ok: false, reason: 'missing_dashboard_daily_password' })
  res.status(200).json({ ok: true, password })
}
