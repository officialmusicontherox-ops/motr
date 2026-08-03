import type { Instrumentation } from "next";

/**
 * Catches every server-side error Next.js surfaces — route handlers, server
 * components, server actions — without needing a try/catch in each one.
 *
 * Only loaded in the Node runtime: the logger talks to Postgres through
 * Prisma, which the Edge runtime can't do.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logError } = await import("./lib/errorLog");

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined;

  const ua = request.headers["user-agent"];

  await logError({
    source: "SERVER",
    message: `${message}${context.routeType ? ` (${context.routeType})` : ""}`,
    path: request.path,
    method: request.method,
    stack,
    digest,
    userAgent: Array.isArray(ua) ? ua[0] : ua,
  });
};
