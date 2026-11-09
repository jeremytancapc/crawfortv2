/**
 * A ceiling on how many applications may be created in a short window.
 *
 * This is a blunt global cap, not per-IP: a serverless isolate keeps no state
 * another isolate can see, so "this caller again" cannot be judged in-process,
 * and the one identifier that would let the edge judge it - the client IP -
 * belongs to the Vercel WAF, not here. What the database can answer is "how
 * many applications already exist in the last N minutes", and that is enough to
 * turn an open endpoint being scripted (42 applications over five hours on
 * 8 Nov 2026, in bursts of fifteen in ten minutes) into a hard stop.
 *
 * The ceiling sits far above real volume - this funnel sees single digits a day
 * - so a genuine applicant never meets it. It is deliberately a throttle on the
 * abnormal, not a limit on the normal, and it is the weaker sibling of
 * authenticating the caller (AUTH_CALLBACK_SECRET): keep it until that is live,
 * and after.
 */

/** Recent-application count over the window, injected so this is testable without a database. */
export type RecentCountFn = (windowMinutes: number) => Promise<number>;

export type ThrottleDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

function windowMinutes(): number {
  const n = Number(process.env.APPLY_THROTTLE_WINDOW_MIN);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function ceiling(): number {
  const n = Number(process.env.APPLY_THROTTLE_MAX);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

/**
 * Whether another application may be created right now.
 *
 * Fails open: if the count cannot be read, the applicant is let through rather
 * than turned away by our own outage. The cap exists to blunt an abnormal
 * flood, and a flood will still be visible even if one check could not run; a
 * real applicant stopped by a database hiccup is a worse outcome than one more
 * request during an incident.
 */
export async function throttleApplication(recentCount: RecentCountFn): Promise<ThrottleDecision> {
  const window = windowMinutes();
  const max = ceiling();

  let count: number;
  try {
    count = await recentCount(window);
  } catch {
    return { allowed: true };
  }

  if (count >= max) {
    console.warn("[apply-throttle] application rate ceiling reached - refusing", {
      count,
      max,
      windowMinutes: window,
    });
    return { allowed: false, retryAfterSeconds: window * 60 };
  }
  return { allowed: true };
}
