import { redirect } from "next/navigation";

/**
 * The paid submission step is retired — MOTR is free for artists.
 *
 * A redirect rather than a deletion for the same reason as /apply: this URL
 * went out in email, and the people most likely to follow it are the artists
 * who were furthest along.
 */
export default function SubmitPage() {
  redirect("/artists");
}
