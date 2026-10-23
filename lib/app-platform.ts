/**
 * Which phone a page is open on, from the browser's user agent.
 *
 * Only to decide which app links to show: an Android phone has no use for the
 * App Store link, and showing both lets a tester tap the wrong one. It can be
 * wrong - a phone in "desktop site" mode, or an iPad that reports itself as a
 * Mac - so it only ever narrows what is shown, and the page can be told which
 * to show.
 */

export type DevicePlatform = "android" | "ios" | "other";
export type PlatformToShow = "android" | "ios" | "all";

export function platformFromUserAgent(userAgent: string | null | undefined): DevicePlatform {
  const ua = userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** What to show: what the tester asked for if it is one of ours, else what the device suggests. */
export function platformToShow(requested: string | undefined, userAgent: string | null | undefined): PlatformToShow {
  if (requested === "android" || requested === "ios" || requested === "all") return requested;
  const detected = platformFromUserAgent(userAgent);
  return detected === "other" ? "all" : detected;
}
