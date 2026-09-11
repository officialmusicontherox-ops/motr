import { redirect } from "next/navigation";

/**
 * The curator application is retired.
 *
 * Kept as a redirect rather than deleted: the address was in emails, in the
 * sitemap and on the sign-in screen for months, and a 404 for someone who
 * followed an old link is a worse answer than the page that replaced it.
 */
export default function ApplyPage() {
  redirect("/artists");
}
