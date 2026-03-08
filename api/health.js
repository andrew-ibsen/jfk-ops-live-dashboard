const { checkAuth } = require('./_auth')

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return
  res.status(200).json({ ok: true, service: 'jfk-ops-live-dashboard' })
}
