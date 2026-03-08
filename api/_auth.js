const crypto = require('crypto')

function nyDateString(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d)
  const pick = (t) => parts.find((p) => p.type === t)?.value || ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

function dailyPassword(secret, dateStr) {
  const sig = crypto.createHmac('sha256', secret).update(dateStr).digest('hex').slice(0, 10).toUpperCase()
  return `OPS-${sig}`
}

function checkAuth(req, res) {
  const provided = String(req.headers['x-ops-password'] || '')
  const secret = process.env.DASHBOARD_PASSWORD_SECRET || ''
  const masterPassword = process.env.DASHBOARD_MASTER_PASSWORD || 'BAENGJFK'

  if (!secret) {
    res.status(500).json({ ok: false, reason: 'missing_dashboard_password_secret' })
    return false
  }

  const valid = [
    dailyPassword(secret, nyDateString(0)),
    dailyPassword(secret, nyDateString(-1)),
    masterPassword
  ]

  if (!provided || !valid.includes(provided)) {
    res.status(401).json({ ok: false, reason: 'http_401' })
    return false
  }
  return true
}

module.exports = { checkAuth, dailyPassword, nyDateString }
