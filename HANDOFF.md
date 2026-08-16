# MOTR — project brief

Paste this into a new Claude chat to bring it up to speed. Nothing secret is in
here: no keys, no passwords, no listener data.

## What it is

**MOTR (Music On The Rox)** — a music discovery platform at
**app.musicontherox.com**, run by Jerrett Franklin, alongside the existing site
musicontherox.com.

Fans swipe on blind 30-second clips with no artist name attached. Tracks that
win over enough listeners "break through", at which point the artist may pay a
flat fee to put the track in front of curators. Curators earn $2 per verified
share.

The premise, in the owner's words: *"it is crowdsourcing A&R information for
artists, for free, at no cost to us or the listeners. It's free data."* The one
thing money cannot buy is the fan vote — that's the whole differentiator from
SubmitHub and Groover.

## Stack

- Next.js 16 (App Router, Turbopack) — **read `client/AGENTS.md` first; this
  version has breaking changes from what you may expect**
- Prisma 7 + Neon Postgres
- Tailwind v4, brand gold `#dcb55f` on near-black `#09090a`
- Vercel (Root Directory = `client`), Resend for email, Stripe for artist fees
- Single `client/` app inside an npm workspace — deps hoist to repo-root
  `node_modules`, which is expected

## How the pipeline works

1. Artist pastes a Spotify link. The app finds a matching 30-second preview on
   Apple, verifying **both artist and title**, and refuses rather than risk
   attaching the wrong recording.
2. The track enters the fan feed. Listeners swipe blind.
3. **A verdict reached after hearing the full clip counts double**, left or
   right — it rewards attention, not agreement.
4. At 75 weighted votes with 33% approval, the track breaks through and the
   artist is invited to pay.
5. Paid tracks route to up to 5 genre-matched curators, who either share it
   (playlist, video, radio, podcast, or write-up, with a proof link) or pass
   **with a written reason that goes to the artist with the curator's name on
   it**.
6. A verified share earns the curator $2. Playlist/video/radio/podcast proof
   must survive 4 days; earnings mature 7 days; cash out at $50 less a $2 fee.

## Current state

Working: fan feed, artist submission (batches of up to 5), curator
applications and approval, admin dashboard, transactional email.

**Never run in production:** the entire paid half. No track has broken through,
so no fee request, no Stripe checkout, no curator assignment and no payout has
ever executed. Stripe is in **live mode** — never complete a real checkout while
testing.

## Things that will bite you

- **Migrations default to localhost.** `DATABASE_URL` is local; production is
  `DATABASE_URL_NEON`. Run `DATABASE_URL="$NEON" npx prisma migrate deploy`.
- **Vercel takes 1–2 minutes to deploy.** Testing production straight after a
  push tests the previous build.
- **UI copy is client-rendered**, so it won't appear in `curl` output even when
  it's live.
- **The machine has 2.7GB RAM and no swap.** Don't run a dev server and a
  browser at once.
- **iTunes preview URLs are permanent; Deezer's expire within a day.** Never
  store a Deezer link.
- **iTunes search rate-limits at roughly 20 calls a minute.**

## Decisions that look strange without the reason

- Audio must match artist **and** title — matching on artist alone once played
  Patty Loveless under another artist's name.
- Economic figures live in `lib/economics.ts`; email templates import them so
  the copy can never disagree with what the app actually pays.
- Curator sessions are signed httpOnly cookies. Before that, every curator
  endpoint trusted a user id from the request body — including the one that
  sets where money is sent.
- Curators sign in with Google **or** an emailed link, because outlet addresses
  frequently aren't Google accounts.
- Come-back emails are sent by hand from the dashboard; a scheduled version
  silently never ran on Vercel's Hobby plan.
- Samsung Internet is steered to Chrome for install — its PWA wrapper targets
  an old Android SDK and Play Protect blocks it.

## How the owner likes to work

- Decide and execute; don't stack up questions.
- A fix isn't finished until the same bug has been swept for elsewhere **and**
  you've checked what the fix itself breaks. He has had to point this out.
- Say something once. He tracks his own follow-ups.
- Don't recite his own numbers back at him as caution. It's a new app and he
  knows where it stands.

## Open items

- Migrate Neon → DigitalOcean Postgres (**must** use the pooled connection
  string; Vercel exhausts a small instance's direct connections)
- Recruit curators — the pool is the bottleneck on the paid half
- Low-cost growth: artists bring their own audiences via per-track share links,
  which is the cheapest acquisition available
