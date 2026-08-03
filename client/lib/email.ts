import { Resend } from "resend";

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
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

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

export function curatorApprovedEmail(username: string) {
  return {
    subject: "You're in — welcome to MOTR",
    html: shell(
      "You're approved",
      `<p style="margin:0 0 12px">Hi ${username}, we looked at your outlet and we'd like you curating.</p>
       <p style="margin:0 0 12px">Sign in with the email you applied with and you'll find your queue — tracks that already cleared the fan vote in your genres.</p>
       <p style="margin:0">You earn a flat fee for every share that sticks: a playlist add or a TikTok/Reel/Short held four days, or a published piece.</p>`,
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
  trackTitle: string;
  artistName: string;
  genre: string | null;
  submitterEmail: string;
}) {
  const { trackTitle, artistName, genre, submitterEmail } = params;
  return {
    subject: `New submission: ${trackTitle} — ${artistName}`,
    html: shell(
      "A track just went live",
      `<p style="margin:0 0 12px"><strong style="color:#fff">${trackTitle}</strong> by ${artistName} is now in the feed.</p>
       <p style="margin:0 0 12px;color:#a3a3a3">Genre: ${genre ?? "not set"}<br/>Submitted by: ${submitterEmail}</p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">If it isn't their music, or the genre looks wrong, you can pull it from the Tracks section of the dashboard.</p>`,
      { label: "Open the dashboard", url: `${APP_URL}/admin` }
    ),
  };
}

export async function sendEmail(to: string, template: { subject: string; html: string }) {
  return send(to, template.subject, template.html);
}
