# Mirror Project Deploy (Free Plan)

Use this when you want the shareable Vercel URL updated fast.

## 60-second checklist

1. Open Vercel → **jfk-ops-live-dashboard** (mirror project)
2. Go to **Deployments**
3. Click latest deployment → **Redeploy**
4. Wait for **Ready**
5. Open live URL and confirm:
   - dashboard loads
   - login works with `BAENGJFK`
   - OpenSky/Weather/Enrichment status is not all red

## Environment Variables (mirror project)

Set these in Project Settings → Environment Variables:

- `DASHBOARD_MASTER_PASSWORD=BAENGJFK`
- `DASHBOARD_PASSWORD_SECRET=<random-long-string>`
- `AVIATIONSTACK_KEY=<your-key>`
- `PASSWORD_BOT_TOKEN=<optional>`

## If API shows 500 again

1. Confirm latest commit deployed
2. Redeploy with fresh build
3. Check Deployment → Functions logs for `/api/opensky`
4. Share first error line with Loki
