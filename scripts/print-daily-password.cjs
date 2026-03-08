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

const secret = process.env.DASHBOARD_PASSWORD_SECRET || ''
if (!secret) {
  console.error('Missing DASHBOARD_PASSWORD_SECRET')
  process.exit(1)
}

const date = nyDateString(0)
const sig = crypto.createHmac('sha256', secret).update(date).digest('hex').slice(0, 10).toUpperCase()
const password = `OPS-${sig}`
console.log(`${date} ${password}`)
