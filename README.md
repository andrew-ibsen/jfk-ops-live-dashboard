# JFK Ops Live Dashboard

British Airways Line Maintenance operational dashboard.

## Features
- Daily roster + flight assignment board
- Station selector (scalable model)
- Auto ADS-B status polling (30s)
- Gantt timeline with now-line and peak-load overlay
- User filter on Gantt (show assigned flights only)

## Run
```powershell
npm install
npm run dev
```

## Optional enrichment (Reg/Type)
This app uses a **server-side proxy/API** so keys are not exposed in browser code.

1. Copy `.env.example` to `.env.local`
2. Set:
```env
AVIATIONSTACK_KEY=your_free_key_here
```
3. Restart `npm run dev`

Without a key, the app still works (schedule + ADS-B status), but registration/type enrichment may be limited.

## Password protection (daily rotating)
This dashboard now requires a daily password (header-auth to `/api/*`).

Set these env vars locally and in Vercel Project Settings → Environment Variables:
```env
DASHBOARD_PASSWORD_SECRET=long_random_secret
PASSWORD_BOT_TOKEN=random_admin_token
```

Daily password format is derived server-side as:
`OPS-<10-char HMAC digest from NY date>`

### Generate today’s password locally
```powershell
node scripts/print-daily-password.cjs
```

## Vercel deploy (password-protected)
1. Push this repo to GitHub
2. Import to Vercel
3. Add env vars in Vercel:
   - `AVIATIONSTACK_KEY`
   - `DASHBOARD_PASSWORD_SECRET`
   - `PASSWORD_BOT_TOKEN`
4. Deploy and share URL
