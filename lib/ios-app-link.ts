/**
 * Links that open the Crawfort iPhone app from a tapped web link.
 *
 * The `intent:` links used on Android mean nothing to Safari. On iPhone the
 * installed app is opened by its custom scheme (`crawfort://`, confirmed by the
 * app team): Safari asks "Open in Crawfort?" and launches it. There is no
 * fallback built in - without the app, Safari reports the address as invalid -
 * so the App Store listing is offered as a separate link instead of guessed at
 * from a timer, which cannot tell "no app" from "the person is still reading
 * the prompt".
 */

import { validateDeepLinkParts } from "./android-app-link";

const APP_STORE_ID = /^\d+$/;

/** What is wrong with a scheme and host or path, in words; empty when usable. */
export function validateIosLinkInput(input: { scheme: string; hostAndPath?: string }): string[] {
  return validateDeepLinkParts(input);
}

/** `crawfort://` or `crawfort://open`. */
export function iosSchemeUrl(input: { scheme: string; hostAndPath?: string }): string {
  const errors = validateIosLinkInput(input);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return `${input.scheme}://${input.hostAndPath ?? ""}`;
}

/**
 * The App Store listing. This is the address https://crawfort.com/mobileapp
 * sends an iPhone to (read 22 Oct 2026): Singapore storefront, app id 6751946791.
 */
export function appStoreUrl(appId: string): string {
  if (!APP_STORE_ID.test(appId)) throw new Error(`"${appId}" is not an App Store id (digits only).`);
  return `https://apps.apple.com/sg/app/crawfort/id${appId}`;
}

/** The content of `<meta name="apple-itunes-app">`, which makes Safari show an Open / Get banner. */
export function smartAppBannerContent(appId: string): string {
  if (!APP_STORE_ID.test(appId)) throw new Error(`"${appId}" is not an App Store id (digits only).`);
  return `app-id=${appId}`;
}
