/**
 * The address this app is actually reached at.
 *
 * Not `req.nextUrl.origin`. On Netlify that resolves to the deploy-specific
 * host, so a sign-in that began on app.musicontherox.com was finishing on
 * 6ad162b9e451efb5f3c57279--motrapp.netlify.app. localStorage is per origin,
 * which means the listener landed on a different site with none of their
 * history and no sign of the session they had just created.
 *
 * APP_URL set in the dashboard is the answer. The production fallback is the
 * real domain rather than localhost, because every place this is used — an
 * emailed link, an OAuth return — is somewhere a wrong address cannot be
 * taken back.
 */
export const APP_URL: string =
  process.env.APP_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://app.musicontherox.com"
    : "http://localhost:3000");
