# Self-hosting

Mosaic needs a Couchbase Capella cluster (the free tier is enough), Node.js 24 or Docker, and optionally a Groq
API key for the assistant, Redis for more than one backend instance, and Cloudinary for image uploads.

## 1. Database

1. Create a free cluster at [cloud.couchbase.com](https://cloud.couchbase.com).
2. Create a bucket named `whiteboard` (100 MB is plenty). Bucket creation needs cluster-admin rights, so do it in
   the Capella UI.
3. Create a **Database Access** credential with read and write on that bucket, and allow your backend's address
   (or "Allow Access from Anywhere" for a host without a static IP).

The `app` scope, every collection and every index are created when the backend first starts.

## 2. Configure

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

| Setting                                                                | Where    | Value                              |
| ---------------------------------------------------------------------- | -------- | ---------------------------------- |
| `CB_CONNECTION_STRING`, `CB_USERNAME`, `CB_PASSWORD`, `CB_BUCKET_NAME` | backend  | From step 1                        |
| `JWT_SECRET`                                                           | backend  | `openssl rand -base64 48`          |
| `FRONTEND_SERVER_KEY`                                                  | both     | The same long random value in each |
| `PUBLIC_APP_URL`                                                       | backend  | The frontend's public address      |
| `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`                                 | frontend | The same public address            |
| `NEXT_PUBLIC_API_URL`                                                  | frontend | The backend's public address       |
| `NEXTAUTH_SECRET`                                                      | frontend | Another long random value          |
| `GROQ_API_KEY`                                                         | backend  | Optional; turns the assistant on   |

Every other setting is optional and documented in the two `.env.example` files.

## 3. Run

```bash
docker compose up --build        # backend on :5000, frontend on :3000
```

Or without Docker, in two terminals:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

`NEXT_PUBLIC_*` values are built into the frontend bundle, so pass them as build arguments when they aren't
the localhost defaults: `NEXT_PUBLIC_API_URL=https://api.example.com NEXT_PUBLIC_SITE_URL=https://example.com
docker compose up --build`.

## 4. More than one backend instance

```bash
docker compose -f docker-compose.scale.yml up --build --scale backend=2
```

This starts Redis and nginx as well. With `REDIS_URL` set, rooms, broadcasts and rate limits are shared, so
nginx round-robins connections with no session affinity. nginx resolves the `backend` name on every request
(a `resolver` plus a variable in `proxy_pass`): a static upstream resolves once at startup and pins every
request to one replica. A short connect timeout lets a client reconnect elsewhere quickly when a replica dies.

## Production

The reference deployment is the frontend on Vercel, the backend on Render and the database on Capella, all on
free tiers. Any container host can run `backend/Dockerfile` and `frontend/Dockerfile` as they are.

### Backend on Render

1. In Render, create a Blueprint from the repository. `render.yaml` defines one Docker web service built from
   the repo root, with `/healthz` as its health check.
2. Fill in the settings it asks for: the Capella connection, `PUBLIC_APP_URL` (the Vercel address) and a long
   random `FRONTEND_SERVER_KEY`. `JWT_SECRET` is generated for you. The rest are optional features.
3. Note the service address, such as `https://mosaic-backend.onrender.com`.

### Frontend on Vercel

1. Import the repository and set the Root Directory to `frontend`. Keep "Include files outside the root
   directory" on, since the frontend imports `shared/`.
2. Set `NEXT_PUBLIC_API_URL` to the Render address, `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` to the Vercel
   address, a long random `NEXTAUTH_SECRET`, and `FRONTEND_SERVER_KEY` equal to the backend's. Google and GitHub
   sign-in need their client ids and secrets, with callbacks at `/api/auth/callback/google` and `/github`.
3. `NEXT_PUBLIC_*` values are inlined at build time, so redeploy after changing one.

### Notes

- **Cold starts.** Render stops an idle free backend after 15 minutes, and waking it takes under a minute,
  sometimes a few. Every page probes the backend as it opens, which starts the wake, and a status pill says the
  server is starting until it answers. `.github/workflows/uptime.yml` calls `/healthz` every 10 minutes once
  the `BACKEND_URL` repository variable is set, which also keeps Capella from deleting an idle cluster after
  30 days.
- **Proxies.** Set `TRUST_PROXY` to the number of proxies in front of each service (it defaults to 1 in
  production) so rate limits see the visitor's own address.
- **Operations.** Set `ALERT_WEBHOOK_URL` to post alerts (save failures, error spikes, database or Redis down,
  AI quota spent) to Slack or any JSON webhook, and `DASHBOARD_TOKEN` to open `/admin/dashboard`.
- **Search engines and AI assistants** find the site through `/sitemap.xml`, `/robots.txt` and `/llms.txt`,
  all built from `NEXT_PUBLIC_SITE_URL`.
