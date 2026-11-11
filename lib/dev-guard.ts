/**
 * The /api/dev/* MyInfo tools (capture, editor, strip, preview) are developer
 * aids for staging and local work. They must never run in production, whatever
 * the MYINFO_* flags happen to say there: a flag left set on the production
 * deployment must not reopen them. Production is the single hard stop here;
 * everywhere else each route keeps its own flag logic.
 *
 * VERCEL_ENV is set by Vercel - "production" on the production deployment,
 * "preview" on preview/stg, and unset for local `next dev` - so this gate is
 * decided by where the code runs, never by anything in a request.
 */
export function devEndpointsBlocked(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production";
}
