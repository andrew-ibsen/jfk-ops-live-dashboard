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
This app uses a **server-side Vite middleware proxy** so keys are not exposed in browser code.

1. Copy `.env.example` to `.env.local`
2. Set:
```env
AVIATIONSTACK_KEY=your_free_key_here
```
3. Restart `npm run dev`

Without a key, the app still works (schedule + ADS-B status), but registration/type enrichment may be limited.
