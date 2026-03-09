import { checkAuth } from './_auth.js'

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return
  res.status(200).json({ ok: true, service: 'jfk-ops-live-dashboard' })
}
