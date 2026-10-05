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

export type SendResult = { ok: boolean; id?: string; error?: string };

/** A file to travel with the message, for when a link to it isn't enough. */
export type Attachment = { filename: string; content: Buffer };

async function send(
  to: string,
  subject: string,
  html: string,
  attachments?: Attachment[]
): Promise<SendResult> {
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
      // Attached as well as shown. Most clients block remote images until the
      // reader allows them, so an artist opening this on a phone would
      // otherwise be told about a card they cannot see — and a file they can
      // save is the thing they actually need to post it.
      ...(attachments?.length
        ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) }
        : {}),
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
/**
 * The weekly contest, stated once.
 *
 * Every artist email that asks someone to share needs a reason why sharing
 * matters this week rather than in general, and this is it. Defined here so
 * the prize can't end up described three different ways.
 */
const WEEKLY_PRIZE = `
  <p style="margin:16px 0 0;padding:14px;background:#0d0d0c;border:1px solid #262625;border-radius:10px">
    <strong style="color:#dcb55f">New: a weekly winner.</strong>
    Every week, the artist whose music gets saved the most on MOTR wins a full
    write-up on Music On The Rox: a real piece of editorial on a real site,
    not a playlist slot. Your own fans swiping is what decides it, so the most
    useful thing you can do is send them over.
  </p>`;

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
      `<p style="margin:0 0 12px"><strong style="color:#fff">${trackTitle}</strong> by ${artistName} won over ${Math.round(approvalRate * 100)}% of the listeners who heard it${approvals > 0 ? ` (${approvals} of them)` : ""}. None of them knew who made it.</p>
       <p style="margin:0 0 14px">It stays in the feed and keeps climbing. There is nothing to pay and nothing you need to do.</p>
       <p style="margin:0 0 10px"><strong style="color:#fff">Send your own fans to it.</strong> That is the single thing that moves a track here, and the link below opens straight on your song rather than a random one, so everyone you send lands on it.</p>
       <p style="margin:0 0 14px;font-size:14px"><a href="${APP_URL}/?track=${trackId}" style="color:#dcb55f;word-break:break-all">${APP_URL.replace(/^https?:\/\//, "")}/?track=${trackId}</a></p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">Tell them to let the full thirty seconds play. A listener who hears it out counts double, so one patient fan is worth two who skip early.</p>`,
      { label: "Open your track", url: `${APP_URL}/?track=${trackId}` }
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
        `<li style="margin:0 0 6px"><strong style="color:#fff">${t.title}</strong> by ${t.artistName} <span style="color:#8b8b8b">(${t.genre ?? "no genre"})</span></li>`
    )
    .join("");

  return {
    subject: many
      ? `New submission: ${tracks.length} tracks from ${submitterEmail}`
      : `New submission: ${first.title} by ${first.artistName}`,
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
       <p style="margin:0;color:#8b8b8b;font-size:13px">If the link is right, add it from the dashboard: Tracks, then Replace audio, and paste this Spotify link.</p>`,
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
  attachments?: Attachment[];
}) {
  const { tracks, requiredVotes, requiredRate, attachments } = params;
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
    attachments,
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
       <p style="margin:0 0 12px">To break through, a track needs <strong style="color:#fff">${Math.round(requiredRate * 100)}% approval across at least ${requiredVotes} listens</strong>. Nobody can buy past that. MOTR is free, so there is nothing to buy.</p>
       <p style="margin:0 0 6px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">${many ? "YOUR LINKS" : "YOUR LINK"}</p>
       <p style="margin:0 0 10px;font-size:14px">${many ? "Each link opens straight on that track" : "This link opens straight on your track"} rather than a random one, so everyone you send lands on it.</p>
       ${list}
       <p style="margin:14px 0 12px"><strong style="color:#fff">Send your own fans to ${many ? "these links" : "that link"}.</strong> It is the single thing that moves a track here, and your own audience are the listeners most likely to swipe right.</p>
       <p style="margin:0 0 12px">Ask them to let the full thirty seconds play. A listener who hears it out counts double, so one patient fan is worth two who skip early.</p>
       ${WEEKLY_PRIZE}
       <p style="margin:16px 0 0;color:#8b8b8b;font-size:13px">We'll email you the moment ${many ? "one of them breaks" : "it breaks"} through. Nothing to do until then.</p>`,
      { label: many ? "Open your first track" : "Open your track", url: `${APP_URL}/?track=${first.id}` }
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
        `<p style="margin:0 0 12px">Hi ${username}.${
          newTracks > 0
            ? ` <strong style="color:#fff">${newTracks}</strong> new track${newTracks === 1 ? " has" : "s have"} landed in the feed since you were last here.`
            : " there's new music in the feed since you were last here."
        }</p>
         ${
           saved.length > 0
             ? `<p style="margin:0 0 10px">You backed ${saved.length === 1 ? "this" : "these"} early:</p>${list}
                <p style="margin:12px 0 0">Tracks only climb if enough listeners push them there. Yours are still going.</p>`
             : `<p style="margin:0">Thirty seconds each, no artist names, and the ones you like are saved for you.</p>`
         }`,
        { label: "Pick up where you left off", url: APP_URL }
      ) +
      `<p style="max-width:520px;margin:8px auto 0;color:#6b6b6b;font-size:11px;text-align:center">
         Not interested? <a href="${unsubscribeUrl}" style="color:#8b8b8b">Unsubscribe</a> and we won't email you again.
       </p>`,
  };
}

/**
 * The artist progress email, sent when a track crosses a round number.
 *
 * Every figure is a running total, never a change since last time. A weekly
 * "3 more than last week" invites the question of what happened the week it
 * was 0; "27 right swipes" is simply a good number, and the artist can be
 * pleased with it whenever it arrives.
 *
 * The ask is the point of the email as much as the news is. An artist who
 * has just been told strangers are saving their song is the likeliest person
 * in the world to send their own audience over — and their audience swiping
 * is what the vote pool actually needs.
 */
export function trackMilestoneEmail(params: {
  artistName: string;
  tracks: { title: string; rightSwipes: number; milestone: number }[];
  appUrl: string;
  unsubscribeUrl: string;
}) {
  const { artistName, tracks, appUrl, unsubscribeUrl } = params;
  const lead = tracks[0];
  const first = lead.milestone === 1;

  // A long list of small numbers reads as thinner than a short one. Six is
  // enough to show a catalogue is moving without turning the email into a
  // spreadsheet.
  const shown = tracks.slice(0, 6);
  const hidden = tracks.length - shown.length;

  const list =
    shown
      .map(
        (t) =>
          `<div style="margin:0 0 8px;padding:12px 14px;background:#0d0d0c;border:1px solid #262625;border-radius:10px">
             <div style="color:#fff;font-weight:600;font-size:15px">${t.title}</div>
             <div style="color:#dcb55f;font-size:13px;margin-top:3px;font-weight:600">
               ${t.rightSwipes} right swipe${t.rightSwipes === 1 ? "" : "s"}
             </div>
           </div>`
      )
      .join("") +
    (hidden > 0
      ? `<p style="margin:4px 0 0;color:#8b8b8b;font-size:13px">and ${hidden} more of yours in rotation.</p>`
      : "");

  return {
    subject: first
      ? `Someone saved "${lead.title}" on MOTR`
      : `"${lead.title}" has ${lead.rightSwipes} right swipes on MOTR`,
    html:
      shell(
        first ? "Your music is landing" : "Your music keeps climbing",
        `<p style="margin:0 0 12px">Hi ${leadName(artistName)},</p>
         <p style="margin:0 0 14px">${
           first
             ? `Someone heard <strong style="color:#fff">${lead.title}</strong> with no artist name attached, no idea who made it, and swiped right. That is the whole point of MOTR, and it just happened to you.`
             : `${tracks.length === 1 ? "Your track has" : "Your tracks have"} picked up more support from listeners who had no idea who made ${tracks.length === 1 ? "it" : "them"}.`
         }</p>
         ${list}
         <p style="margin:14px 0 0">Every one of those is a stranger who heard thirty seconds blind and chose to keep it.</p>
         <p style="margin:16px 0 0;padding:14px;background:#0d0d0c;border:1px solid #262625;border-radius:10px">
           <strong style="color:#fff">We're still in early access.</strong>
           The listener base is small and growing, which is exactly why this is a good moment to
           be on it. There is far less to compete with than there will be in six months, and the
           fans you bring now decide which tracks rise to the top of the charts.
         </p>
         <p style="margin:16px 0 0"><strong style="color:#fff">So here's the ask.</strong> Send your own fans to MOTR. Every one of them who swipes right pushes ${
           tracks.length === 1 ? "your track" : "your tracks"
         } further up, and it costs you nothing but a share.</p>
         <p style="margin:10px 0 0;color:#8b8b8b;font-size:14px">${appUrl.replace(/^https?:\/\//, "")}</p>
         ${WEEKLY_PRIZE}`,
        { label: "Share MOTR with your fans", url: appUrl }
      ) +
      `<p style="max-width:520px;margin:8px auto 0;color:#6b6b6b;font-size:11px;text-align:center">
         Don't want these updates? <a href="${unsubscribeUrl}" style="color:#8b8b8b">Unsubscribe</a>. Your music stays in rotation either way.
       </p>`,
  };
}

/**
 * Sign-in link for the A&R portal.
 *
 * Says who it is for and how long it lasts, because a login email that
 * explains itself is one people click rather than report.
 */
export function scoutLoginLinkEmail(params: { name: string; url: string; minutes: number }) {
  const { name, url, minutes } = params;
  return {
    subject: "Your MOTR A&R sign-in link",
    html: shell(
      "Sign in to MOTR",
      `<p style="margin:0 0 12px">Hi ${leadName(name)},</p>
       <p style="margin:0 0 12px">Here's your link into the MOTR A&amp;R portal. It works once and expires in ${minutes} minutes.</p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">If you didn't ask for it, ignore this email. Nothing happens until the link is opened.</p>`,
      { label: "Open the portal", url }
    ),
  };
}

/**
 * The name to greet someone by.
 *
 * Artist names arrive as full credits, so "NOR.BE, Vinnie Colaiuta, John
 * Patitucci, Fawzi Chekili" is one artist as far as the database is
 * concerned. Greeting them with all of it reads like a mail merge that went
 * wrong, which is exactly what the reader will assume it is.
 */
function leadName(name: string): string {
  const lead = name.split(/[,&]| and /i)[0].trim();
  return lead || name;
}

export function artistLoginLinkEmail(params: { name: string; url: string; minutes: number }) {
  const { name, url, minutes } = params;
  return {
    subject: "Your MOTR artist page",
    html: shell(
      "Your page",
      `<p style="margin:0 0 12px">Hi ${leadName(name)},</p>
       <p style="margin:0 0 12px">Here's your way in. It works once and expires in ${minutes} minutes, and once you're in you'll stay signed in on that device.</p>
       <p style="margin:0;color:#8b8b8b;font-size:13px">If you didn't ask for it, ignore this email. Nothing happens until the link is opened.</p>`,
      { label: "Open your page", url }
    ),
  };
}

/**
 * Tells an artist their page exists, and shows them the card rather than
 * describing it.
 *
 * The image is the whole argument: an artist who can see what they would be
 * posting decides in a second, where a paragraph about a share card gets
 * skimmed and closed.
 */
export function artistSharePageEmail(params: {
  name: string;
  tracks: { id: string; title: string }[];
  attachments?: Attachment[];
}) {
  const { name, tracks, attachments } = params;
  const first = tracks[0];
  const more = tracks.length - 1;

  // Named after their own song, and after the thing they are getting.
  //
  // "Card" read as a payment card, which filters weigh and which tells an
  // artist nothing. Their own title is the one phrase guaranteed to stop them
  // scrolling, and "ready to post" says the work is already done.
  const subject = first
    ? `"${first.title}" is ready to post`
    : "Your MOTR graphics are ready";

  return {
    subject,
    attachments,
    html: shell(
      "Post this to your story",
      `<p style="margin:0 0 12px">Hi ${leadName(name)},</p>
       <p style="margin:0 0 18px">Your graphic is attached. Put it on your story and anyone who follows you can scan it and hear the track.</p>
       ${
         first
           ? `<div style="margin:0 0 18px;text-align:center">
                <img src="${APP_URL}/api/share-card/${first.id}?shape=post" width="464" alt="Your MOTR graphic for ${first.title}" style="width:100%;max-width:464px;border-radius:14px;display:block;margin:0 auto" />
              </div>`
           : ""
       }
       <p style="margin:0 0 12px">On MOTR nobody sees your name while they listen. They get thirty seconds and decide on the song, then find out it was you once they have kept it.</p>
       <p style="margin:0">Your page has ${
         more > 0 ? `all ${tracks.length} of your tracks` : "your track"
       }, a graphic for each one, and how many people opened your link and kept the song.</p>`,
      { label: "Open your page", url: `${APP_URL}/artist` }
    ),
  };
}

/**
 * A one-off note to everyone who has signed in, describing what MOTR is.
 *
 * Written forward-looking on purpose. Nobody outside the building needs an
 * account of what changed, and an email explaining a feature someone never
 * used is an email that raises a question they didn't have. This says what
 * the app is now and gives both audiences a reason to open it.
 */
export function whatMotrIsEmail(params: { unsubscribeUrl: string }) {
  const { unsubscribeUrl } = params;
  return {
    subject: "What MOTR is, and what's new",
    html:
      shell(
        "Music before anyone tells you who made it",
        `<p style="margin:0 0 14px">A quick note on what MOTR is, because the app has grown a lot since you signed in.</p>
         <p style="margin:0 0 14px">Every track plays as a <strong style="color:#fff">thirty-second clip with no artist name attached</strong>. You decide on the music, then find out who it was once you have kept it. Swipe right to keep it, left to move on. Nothing in the feed was paid to be there, and there is no way to buy a place in it.</p>
         <p style="margin:0 0 6px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">NEW: CHARTS</p>
         <p style="margin:0 0 14px">There's now a Charts tab showing the tracks listeners backed hardest this week and this month. Every position on it was earned by people keeping the song, which makes it a genuinely different chart from the ones you already see.</p>
         <p style="margin:0 0 14px">At the end of every week we'll email you the week's Top Artists. If you want your favorite to make the cut, the way to do it is to play their track and swipe right.</p>
         <p style="margin:0 0 6px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">IF YOU MAKE MUSIC</p>
         <p style="margin:0 0 14px">Submitting is free and always will be. Paste a Spotify link and your song goes into the same blind rotation as everyone else's, judged on how it sounds rather than on how many followers you have.</p>
         <p style="margin:0 0 14px">One thing worth knowing either way: a listener who hears the full thirty seconds before deciding counts double. Patience is the most useful thing anyone can bring to it.</p>
         <p style="margin:0;color:#8b8b8b;font-size:13px">Thanks for being here early.</p>`,
        { label: "Open MOTR", url: APP_URL }
      ) +
      `<p style="max-width:520px;margin:8px auto 0;color:#6b6b6b;font-size:11px;text-align:center">
         Not interested? <a href="${unsubscribeUrl}" style="color:#8b8b8b">Unsubscribe</a> and we won't email you again.
       </p>`,
  };
}

/**
 * The weekly chart, sent to listeners and artists alike.
 *
 * Ranks only, matching the Charts tab. The counts behind them are small at
 * this stage and printing them undercuts the thing the chart is for, which is
 * giving an artist something worth showing people.
 *
 * The ask is built into the format rather than bolted on the end: someone who
 * wants their favourite higher next week already knows what to do about it.
 */
export function weeklyChartEmail(params: {
  songs: { title: string; artistName: string }[];
  artists: { name: string }[];
  unsubscribeUrl: string;
}) {
  const { songs, artists, unsubscribeUrl } = params;

  const rows = (items: string[]) =>
    items
      .map(
        (label, i) =>
          `<div style="display:flex;gap:12px;padding:9px 12px;margin:0 0 6px;background:#0d0d0c;border:1px solid #262625;border-radius:8px">
             <span style="color:${i < 3 ? "#dcb55f" : "#8b8b8b"};font-weight:700;width:18px">${i + 1}</span>
             <span style="color:#fff">${label}</span>
           </div>`
      )
      .join("");

  return {
    subject: artists.length > 0 ? `This week on MOTR: ${artists[0].name} at number one` : "This week on MOTR",
    html:
      shell(
        "This week's charts",
        `<p style="margin:0 0 16px">Here's where the last seven days landed. Every position was earned by listeners who heard thirty seconds with no artist name attached and chose to keep the song.</p>
         ${
           artists.length > 0
             ? `<p style="margin:0 0 8px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">TOP ARTISTS</p>${rows(artists.map((a) => a.name))}`
             : ""
         }
         ${
           songs.length > 0
             ? `<p style="margin:16px 0 8px;color:#dcb55f;font-size:13px;font-weight:700;letter-spacing:1px">TOP SONGS</p>${rows(songs.map((t) => `${t.title} <span style="color:#8b8b8b">${t.artistName}</span>`))}`
             : ""
         }
         <p style="margin:18px 0 0"><strong style="color:#fff">Want your favorite higher next week?</strong> Play their track and swipe right. That is the only thing that moves this list, and a listener who hears the full thirty seconds counts double.</p>`,
        { label: "Open the charts", url: `${APP_URL}/charts` }
      ) +
      `<p style="max-width:520px;margin:8px auto 0;color:#6b6b6b;font-size:11px;text-align:center">
         <a href="${unsubscribeUrl}" style="color:#8b8b8b">Unsubscribe</a> from these weekly emails.
       </p>`,
  };
}

/**
 * The come-back email for artists: send us more music.
 *
 * Leads with what their existing tracks did, not with the ask. "Your music
 * picked up 40 saves, got anything else?" is a different email from "got
 * anything else?", and only one of them is worth opening.
 */
export function submitMoreMusicEmail(params: {
  name: string;
  tracks: number;
  saves: number;
  appUrl: string;
  unsubscribeUrl: string;
}) {
  const { name, tracks, saves, appUrl, unsubscribeUrl } = params;
  const plural = tracks === 1 ? "is" : "are";

  return {
    subject:
      saves > 0
        ? `Your music has ${saves} save${saves === 1 ? "" : "s"} on MOTR`
        : "Got anything new for MOTR?",
    html:
      shell(
        saves > 0 ? "Your music is still working" : "Room for more",
        `<p style="margin:0 0 12px">Hi ${leadName(name)},</p>
         <p style="margin:0 0 14px">${
           saves > 0
             ? `Your ${tracks === 1 ? "track" : `${tracks} tracks`} on MOTR ${plural} still in rotation, and ${saves === 1 ? "one listener has" : `${saves} listeners have`} saved ${tracks === 1 ? "it" : "them"} after hearing thirty seconds with no name attached.`
             : `Your ${tracks === 1 ? "track is" : `${tracks} tracks are`} in rotation on MOTR, playing to listeners who hear thirty seconds with no idea who made ${tracks === 1 ? "it" : "them"}.`
         }</p>
         <p style="margin:0 0 14px"><strong style="color:#fff">If you've released anything since, send it over.</strong> It's free, it always will be, and a second track doubles the chances one of them catches. Paste a Spotify link and it's in the feed the same day.</p>
         ${WEEKLY_PRIZE}
         <p style="margin:16px 0 0;color:#8b8b8b;font-size:13px">Nothing to pay, no queue to jump, and no limit on how often you come back.</p>`,
        { label: "Submit another song", url: `${appUrl}/artists` }
      ) +
      `<p style="max-width:520px;margin:8px auto 0;color:#6b6b6b;font-size:11px;text-align:center">
         <a href="${unsubscribeUrl}" style="color:#8b8b8b">Unsubscribe</a> and we won't email you again.
       </p>`,
  };
}

export async function sendEmail(
  to: string,
  template: { subject: string; html: string; attachments?: Attachment[] }
) {
  return send(to, template.subject, template.html, template.attachments);
}
