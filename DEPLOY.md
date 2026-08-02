# Deploying MOTR to app.musicontherox.com

Everything in the codebase is ready. What's left needs your accounts, so it's
written out step by step.

---

## 1. Put the code on GitHub

Go to <https://github.com/new>:

- **Repository name:** `motr`
- **Private** (it has your business logic in it)
- Do **not** tick "Add a README" — the repo already has files

GitHub then shows you a page of commands. Ignore it and tell me the URL it
gives you (`https://github.com/YOURNAME/motr.git`) — I'll push from here.

---

## 2. Deploy on Vercel

1. Sign up at <https://vercel.com> with your GitHub account.
2. **Add New → Project**, pick the `motr` repo.
3. Change one setting: **Root Directory → `client`**. This matters — the app
   lives in a subfolder and the build fails without it.
4. Paste in the environment variables (below) *before* clicking Deploy.
5. Deploy.

You'll get a working URL like `motr.vercel.app` within a couple of minutes.

### Cost note

Vercel's free Hobby plan forbids commercial use, and MOTR takes payments.
You'll need **Pro, $20/month**. Neon's free tier is fine to start.

### Environment variables

Copy these from `client/.env`, with three changes:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your Neon URL — but use the **pooled** one (it has `-pooler` in the hostname). Serverless opens too many connections for a direct URL. |
| `APP_URL` | `https://app.musicontherox.com` |
| `SPOTIFY_REDIRECT_URI` | `https://app.musicontherox.com/api/auth/spotify/callback` |
| `GOOGLE_REDIRECT_URI` | `https://app.musicontherox.com/api/auth/google/callback` |
| `ADMIN_SESSION_SECRET` | Generate a **new** one for production, don't reuse the dev value |
| Everything else | Same as `client/.env` |

`STRIPE_WEBHOOK_SECRET` is filled in at step 5.

---

## 3. Point the domain at it

**In Vercel:** Project → Settings → Domains → add `app.musicontherox.com`.
It'll show you a CNAME record to create.

**In GoDaddy:** My Products → musicontherox.com → DNS → Add New Record:

| Field | Value |
| --- | --- |
| Type | `CNAME` |
| Name | `app` |
| Value | `cname.vercel-dns.com` (use whatever Vercel shows you) |
| TTL | 1 hour |

Save. It usually goes live in 10–30 minutes. Vercel issues the HTTPS
certificate automatically once it sees the record.

This does not touch your existing `musicontherox.com` website or your email.

---

## 4. Update the sign-in redirect URLs

Both of these will silently fail until the live URL is registered.

**Spotify** — <https://developer.spotify.com/dashboard> → your app → Settings
→ Redirect URIs → add:

```
https://app.musicontherox.com/api/auth/spotify/callback
```

**Google** (only needed once you fill in the Google keys) —
<https://console.cloud.google.com/apis/credentials> → your OAuth client →
Authorised redirect URIs → add:

```
https://app.musicontherox.com/api/auth/google/callback
```

---

## 5. Turn on the Stripe webhook

Without this, artists can pay and their track won't move forward.

Stripe Dashboard → Developers → Webhooks → **Add endpoint**:

- **URL:** `https://app.musicontherox.com/api/payments/webhook`
- **Events:** `checkout.session.completed`

Stripe shows a **signing secret** starting `whsec_`. Put it in Vercel as
`STRIPE_WEBHOOK_SECRET` and redeploy.

---

## 6. Push the database schema

The Neon database needs the tables. From here:

```
cd client && npx prisma migrate deploy
```

Run it against the production `DATABASE_URL`.

---

## After it's live

- Visit the site on your phone → you'll be offered "Add to home screen".
- Your admin dashboard is at `https://app.musicontherox.com/admin`.
- Clear out the test data (20 anonymous fans, 6 swipes, one $2 payout)
  before real people arrive.

---

## About the App Store and Google Play

MOTR is a web app, so:

- **Google Play** accepts it more or less as-is. <https://pwabuilder.com>
  wraps a PWA into a Play-ready package (a "Trusted Web Activity") in a few
  clicks. Cost: $25, one time.
- **Apple** requires a native binary, so it needs a wrapper (Capacitor or
  PWABuilder). Cost: $99/year. Guideline 4.2 rejects apps that are "just a
  website", so this is the harder of the two.
- **Watch out on iOS:** Apple requires digital goods to be sold through
  In-App Purchase and takes **30%**. The $20 artist fee paid via Stripe
  inside an iOS app is a likely rejection. Common workaround: artists submit
  and pay on the web, and the iOS app is fans-only.

None of that blocks launching on the web first, which is the right order
anyway — real usage before store review.
