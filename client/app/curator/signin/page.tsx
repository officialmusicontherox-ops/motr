import { redirect } from "next/navigation";

/** Curator sign-in is retired; see app/curate/page.tsx. */
export default function CuratorSignInPage() {
  redirect("/");
}
