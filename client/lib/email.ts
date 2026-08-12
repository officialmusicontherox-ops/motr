import { Resend } from "resend";
import {
  CURATORS_PER_TRACK,
  FEATURE_FEE_CENTS,
  MIN_WITHDRAWAL_CENTS,
  PAYOUT_MATURITY_DAYS,
  SHARE_HOLD_DAYS,
  WITHDRAWAL_FEE_CENTS,
} from "./economics";

/**
 * Transactional email. Two moments in the product depend on it: telling an
 * approved curator they're in, and telling an artist their track cleared the
 * fan vote. Both were silent no-ops before this existed.
 *
 * Sending never throws into the caller — an email failure must not roll back
 * an approval or a swipe that already succeeded.
 */

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM ?? "MOTR <onboarding@resend.dev>";
const REPLY_TO = process.env.EMAIL_REPLY_TO;
/**
 * Where the links in these emails point.
 *
 * The localhost default is only correct on a dev machine, and an email is the
 * one place a wrong URL is unrecoverable — it's already in someone's inbox.
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment, so a missing
 * APP_URL in the dashboard degrades to the real domain rather than to a link
 * that opens nothing on the recipient's machine.
 */
const APP_URL =
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.NODE_ENV === "production"
      ? "https://app.musicontherox.com"
      : "http://localhost:3000");

const dollars = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

export type SendResult = { ok: boolean; id?: string; error?: string };

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  if (!resend) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    });

    if (error) {
      console.error(`[email failed] to=${to}: ${error.message}`);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error(`[email threw] to=${to}: ${message}`);
    return { ok: false, error: message };
  }
}

/** Dark shell matching the app, with inline styles since mail clients ignore <style>. */
function shell(heading: string, body: string, cta?: { label: string; url: string }) {
  return `
<div style="background:#09090a;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#131312;border:1px solid #262625;border-radius:20px;overflow:hidden">
    <div style="padding:28px 28px 0;text-align:center">
      <div style="color:#dcb55f;font-size:12px;letter-spacing:3px;font-weight:700">M O T R</div>
      <div style="color:#8b8b8b;font-size:11px;letter-spacing:1px;margin-top:4px">MUSICONTHEROX.COM</div>
    </div>
    <div style="padding:24px 28px 28px">
      <h1 style="color:#fff;font-size:22px;margin:0 0 12px">${heading}</h1>
      <div style="color:#c9c9c9;font-size:15px;line-height:1.6">${body}</div>
      ${
        cta
          ? `<div style="margin-top:24px"><a href="${cta.url}" style="display:inline-block;background:#dcb55f;color:#09090a;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;font-size:14px">${cta.label}</a></div>`
          : ""
      }
    </div>
  </div>
  <p style="max-width:520px;margin:16px auto 0;color:#6b6b6b;font-size:12px;text-align:center">
    Sent by MOTR · <a href="https://musicontherox.com" style="color:#8b8b8b">musicontherox.com</a>
  </p>
</div>`;
}

/**
 * The welcome email, and the only complete explanation of the job a curator
 * ever gets — there's no onboarding screen and no handbook.
 *
 * Every number in it comes from lib/payouts.ts rather than being typed into
 * the copy, because an email that quietly disagrees with what the app pays is
 * worse than one that says nothing. Retuning the economics retunes this.
 */
export function curatorApprovedEmail(username: string, email?: string) {
  const signInNote = email
    ? `Sign in with Google using <strong style="color:#fff">${email}</strong> — the address you applied with. A different Google account won't find your account. <strong style="color:#fff">If that address isn't a Google account</strong>, reply to this email with one that is and we'll switch it over.`
    : `Sign in with Google using the address you applied with. A different Google account won't find your account.`;

  return {
    subject: "You're in — here's how curating on MOTR works",
    html: shell(
      "You're approved",
      `<p style="margin:0 0 18px">Hi ${username} — we looked at your outlet and we'd like you curating. Here's everything you need.</p>

       <p style="margin:0 0 6px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">GETTING IN</p>
       <p style="margin:0 0 18px">${signInNote}</p>

       <p style="margin:0 0 6px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">WHAT LANDS IN YOUR QUEUE</p>
       <p style="margin:0 0 18px">Nothing unsolicited. A track only reaches you after real listeners voted it through on blind 30-second clips, the artist paid to put it in front of curators, and it matched your genres. It goes to ${CURATORS_PER_TRACK} curators, so you're one opinion of ${CURATORS_PER_TRACK} — not a gatekeeper.</p>

       <p style="margin:0 0 6px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">YOUR TWO OPTIONS</p>
       <p style="margin:0 0 10px"><strong style="color:#fff">Share it</strong> — add it to a playlist, post a short-form video, play it on air or on your podcast, or write about it. You paste the link as proof.</p>
       <p style="margin:0 0 18px"><strong style="color:#fff">Pass</strong> — perfectly fine, and often the right call. We ask for a sentence or two on why, and it goes to the artist with your name on it. When the answer is no, that explanation is most of what they paid for.</p>

       <p style="margin:0 0 6px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">GETTING PAID</p>
       <p style="margin:0 0 10px">A flat <strong style="color:#fff">${dollars(FEATURE_FEE_CENTS)}</strong> per verified share. Same fee whatever the track — nobody can pay you more for a better verdict.</p>
       <p style="margin:0 0 10px">Playlist adds, videos, radio and podcast proof have to stay up for <strong style="color:#fff">${SHARE_HOLD_DAYS} days</strong> before they count. A published article clears straight away. After that, earnings sit for <strong style="color:#fff">${PAYOUT_MATURITY_DAYS} days</strong> before they can be withdrawn.</p>
       <p style="margin:0 0 10px">Cash out from <strong style="color:#fff">${dollars(MIN_WITHDRAWAL_CENTS)}</strong>, with a ${dollars(WITHDRAWAL_FEE_CENTS)} transfer fee taken off each payout. It goes out through PayPal in US dollars wherever you are — if your account holds another currency, PayPal converts it at their rate. Your balance and every pending item are on your earnings page.</p>
       <p style="margin:0 0 18px">You're independent, not employed by us, and payouts are gross: we don't withhold tax. What you owe on it is between you and the tax authority where you live. Full detail is in the <a href="${APP_URL}/terms" style="color:#dcb55f">terms</a>.</p>

       <p style="margin:0;color:#8b8b8b;font-size:13px">Questions, or something looks wrong? Just reply to this email.</p>`,
      { label: "Open your queue", url: `${APP_URL}/curate` }
    ),
  };
}

export function curatorDeclinedEmail(username: string) {
  return {
    subject: "About your MOTR curator application",
    html: shell(
      "Not this time",
      `<p style="margin:0 0 12px">Hi ${username}, thanks for applying to curate on MOTR.</p>
       <p style="margin:0">We're not moving forward right now, but outlets grow — you're welcome to apply again later.</p>`
    ),
  };
}

export function trackBrokeThroughEmail(params: {
  trackTitle: string;
  artistName: string;
  approvals: number;
  approvalRate: number;
  trackId: string;
}) {
  const { trackTitle, artistName, approvals, approvalRate, trackId } = params;
  return {
    subject: `"${trackTitle}" broke through`,
    html: shell(
      "Fans pushed your track through",
      `<p style="margin:0 0 12px"><strong style="color:#fff">${trackTitle}</strong> by ${artistName} won over ${Math.round(approvalRate * 100)}% of the ${approvals > 0 ? "fans who heard it" : "vote"} (${approvals} approvals) — enough to clear the fan vote.</p>
       <p style="margin:0 0 12px">You can now submit it to five curators who work in your genre. That fee buys their time and attention, not a guaranteed placement — what they do with it is their call.</p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">No pressure, and nothing changes if you skip it. Your track stays in the feed either way.</p>`,
      { label: "Submit to curators", url: `${APP_URL}/submit/${trackId}` }
    ),
  };
}

/**
 * Tells the operator a track just went into the feed.
 *
 * Submissions publish immediately, so without this the first anyone knows of
 * a questionable one is when a fan sees it. Names the submitter, because the
 * common problem isn't bad audio — it's someone submitting music that isn't
 * theirs.
 */
export function newSubmissionEmail(params: {
  tracks: { title: string; artistName: string; genre: string | null }[];
  submitterEmail: string;
}) {
  const { tracks, submitterEmail } = params;
  const many = tracks.length > 1;
  const first = tracks[0];

  const list = tracks
    .map(
      (t) =>
        `<li style="margin:0 0 6px"><strong style="color:#fff">${t.title}</strong> — ${t.artistName} <span style="color:#8b8b8b">(${t.genre ?? "no genre"})</span></li>`
    )
    .join("");

  return {
    subject: many
      ? `New submission: ${tracks.length} tracks from ${submitterEmail}`
      : `New submission: ${first.title} — ${first.artistName}`,
    html: shell(
      many ? `${tracks.length} tracks just went live` : "A track just went live",
      `<ul style="margin:0 0 12px;padding-left:18px;color:#c9c9c9">${list}</ul>
       <p style="margin:0 0 12px;color:#a3a3a3">Submitted by: ${submitterEmail}</p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">If any of it isn't their music, or a genre looks wrong, you can pull it from the Tracks section of the dashboard.</p>`,
      { label: "Open the dashboard", url: `${APP_URL}/admin` }
    ),
  };
}

/**
 * A submission the lookup refused.
 *
 * Refusals are the cases most worth seeing: the artist did everything right
 * and we still turned them away, so someone has to add the track by hand.
 * Without this the only signal is whether they bother to write in.
 */
export function refusedSubmissionEmail(params: {
  spotifyUrl: string;
  artistEmail: string;
  reason: string;
}) {
  const { spotifyUrl, artistEmail, reason } = params;
  return {
    subject: "Submission needs adding by hand",
    html: shell(
      "We couldn't verify a submission",
      `<p style="margin:0 0 12px">Someone submitted a track and we refused it rather than risk attaching the wrong audio.</p>
       <p style="margin:0 0 12px;color:#a3a3a3">From: ${artistEmail}<br/>Link: <a href="${spotifyUrl}" style="color:#dcb55f">${spotifyUrl}</a></p>
       <p style="margin:0 0 12px;color:#a3a3a3">Reason: ${reason}</p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">If the link is right, add it from the dashboard — Tracks, then Replace audio, and paste this Spotify link.</p>`,
      { label: "Open the dashboard", url: `${APP_URL}/admin` }
    ),
  };
}

/**
 * Confirms a submission to the artist, and asks them to share it.
 *
 * They received nothing at all before — the only emails on submission went
 * to the operator. This is also the one moment they're most motivated to
 * tell people, and their own fans are the listeners most likely to swipe
 * right, so the ask belongs here rather than in a later nudge.
 */
export function submissionReceivedEmail(params: {
  tracks: { id: string; title: string; artistName: string }[];
  requiredVotes: number;
  requiredRate: number;
}) {
  const { tracks, requiredVotes, requiredRate } = params;
  const many = tracks.length > 1;
  const first = tracks[0];

  // One email per batch, not one per track. Someone adding five songs in a
  // sitting shouldn't get five near-identical emails — and a single one can
  // carry every share link, which five separate ones can't.
  const list = tracks
    .map(
      (t) =>
        `<div style="margin:0 0 10px;padding:12px 14px;background:#0d0d0c;border:1px solid #262625;border-radius:10px">
           <div style="color:#fff;font-weight:600">${t.title}</div>
           <div style="color:#8b8b8b;font-size:13px;margin-top:2px">${t.artistName}</div>
           <a href="${APP_URL}/?track=${t.id}" style="color:#dcb55f;font-size:13px;word-break:break-all">${APP_URL.replace(/^https?:\/\//, "")}/?track=${t.id}</a>
         </div>`
    )
    .join("");

  return {
    subject: many
      ? `Your ${tracks.length} tracks are live on MOTR`
      : `"${first.title}" is live on MOTR`,
    html: shell(
      many ? "Your tracks are in the feed" : "Your track is in the feed",
      `<p style="margin:0 0 12px">${
        many
          ? `All <strong style="color:#fff">${tracks.length}</strong> are now playing in the MOTR feed`
          : `<strong style="color:#fff">${first.title}</strong> by ${first.artistName} is now playing in the MOTR feed`
      }, where listeners hear thirty seconds with no artist name attached and decide on the music alone.</p>
       <p style="margin:0 0 12px">To reach curators, a track needs <strong style="color:#fff">${Math.round(requiredRate * 100)}% approval across at least ${requiredVotes} listens</strong>. Nobody can buy past that — it's the one gate money doesn't open.</p>
       <p style="margin:0 0 6px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">${many ? "YOUR LINKS" : "YOUR LINK"}</p>
       <p style="margin:0 0 10px;font-size:14px">${many ? "Each link opens straight on that track" : "This link opens straight on your track"} rather than a random one, so everyone you send lands on it.</p>
       ${list}
       <p style="margin:14px 0 12px"><strong style="color:#fff">Ask them to let it play out.</strong> A listener who hears the full thirty seconds before deciding counts double, so one patient fan is worth two who skip early. It's the single most useful thing you can tell them.</p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">We'll email you the moment ${many ? "one of them breaks" : "it breaks"} through. Nothing to do until then.</p>`,
      { label: "See the feed", url: APP_URL }
    ),
  };
}

/**
 * A curator's reasons for passing, sent to the artist.
 *
 * Named, because "a curator passed" is a verdict from nowhere while "Sarah
 * at Basement Tapes passed, and here's why" is a person's opinion — which is
 * what was actually paid for, and the only part of a no that's any use.
 */
export function curatorPassedEmail(params: {
  trackTitle: string;
  curatorName: string;
  reason: string;
}) {
  const { trackTitle, curatorName, reason } = params;
  return {
    subject: `${curatorName} passed on "${trackTitle}"`,
    html: shell(
      "A curator's decision",
      `<p style="margin:0 0 12px"><strong style="color:#fff">${curatorName}</strong> listened to <strong style="color:#fff">${trackTitle}</strong> and decided not to feature it.</p>
       <div style="margin:0 0 16px;padding:14px 16px;background:#0d0d0c;border-left:3px solid #dcb55f;border-radius:8px">
         <p style="margin:0;color:#e6e6e6;font-style:italic">${reason.replace(/</g, "&lt;")}</p>
       </div>
       <p style="margin:0 0 12px">That's one curator's take, not a verdict on the track. Others may hear it differently, and their decisions come separately.</p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">Your fee bought their time and their honest opinion — including this one.</p>`
    ),
  };
}

/**
 * The come-back email, for a listener who swiped and then stopped.
 *
 * Built around what they already backed rather than "we miss you": the tracks
 * they saved, and how those are doing since. That's the one thing MOTR knows
 * about them that nowhere else does, and it's the reason they'd open it.
 *
 * The unsubscribe link isn't optional decoration — a recurring email has to
 * carry one, and it has to work.
 */
export function comeBackEmail(params: {
  username: string;
  saved: { title: string; artistName: string; votes: number }[];
  newTracks: number;
  unsubscribeUrl: string;
}) {
  const { username, saved, newTracks, unsubscribeUrl } = params;

  const list = saved
    .map(
      (t) =>
        `<div style="margin:0 0 8px;padding:10px 12px;background:#0d0d0c;border:1px solid #262625;border-radius:10px">
           <div style="color:#fff;font-weight:600;font-size:14px">${t.title}</div>
           <div style="color:#8b8b8b;font-size:12px;margin-top:2px">${t.artistName}${
             t.votes > 0 ? ` · ${t.votes} vote${t.votes === 1 ? "" : "s"} so far` : ""
           }</div>
         </div>`
    )
    .join("");

  return {
    subject: newTracks > 0 ? `${newTracks} new tracks since you were last on MOTR` : "Still swiping?",
    html:
      shell(
        saved.length > 0 ? "The ones you backed" : "There's new music waiting",
        `<p style="margin:0 0 12px">Hi ${username} —${
          newTracks > 0
            ? ` <strong style="color:#fff">${newTracks}</strong> new track${newTracks === 1 ? " has" : "s have"} landed in the feed since you were last here.`
            : " there's new music in the feed since you were last here."
        }</p>
         ${
           saved.length > 0
             ? `<p style="margin:0 0 10px">You backed ${saved.length === 1 ? "this" : "these"} early:</p>${list}
                <p style="margin:12px 0 0">Tracks only reach curators if enough listeners push them there. Yours are still climbing.</p>`
             : `<p style="margin:0">Thirty seconds each, no artist names, and the ones you like are saved for you.</p>`
         }`,
        { label: "Pick up where you left off", url: APP_URL }
      ) +
      `<p style="max-width:520px;margin:8px auto 0;color:#6b6b6b;font-size:11px;text-align:center">
         Not interested? <a href="${unsubscribeUrl}" style="color:#8b8b8b">Unsubscribe</a> and we won't email you again.
       </p>`,
  };
}

export async function sendEmail(to: string, template: { subject: string; html: string }) {
  return send(to, template.subject, template.html);
}
