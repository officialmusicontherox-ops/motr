import { redirect } from "next/navigation";

/**
 * The curator queue is retired along with the rest of the programme.
 *
 * A redirect rather than a deletion because this address appeared in every
 * curator welcome email that went out, and because the server side is intact
 * — restoring the page later is a git revert, not a rebuild.
 */
export default function CuratePage() {
  redirect("/");
}
