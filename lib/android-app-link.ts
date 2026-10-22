/**
 * Links that open the Crawfort Android app from a tapped web link.
 *
 * A web page cannot launch a native app from a typed address or a script:
 * Android Chrome only follows an `intent://` link the person taps. The intent
 * names the app by its package, and `S.browser_fallback_url` sends someone
 * without the app to the Play Store instead of an error.
 *
 * Two forms, because we do not yet know which the app supports:
 *  - by package alone, which starts the app's launcher screen and needs no deep
 *    link to be registered;
 *  - by scheme and host, which needs the app's manifest to declare that scheme.
 */

const PACKAGE_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i;
const SCHEME = /^[a-z][a-z0-9+.-]*$/i;
// Characters that may appear in a host and path - and none that can end the
// intent (`;`, `#`) or break out of the attribute it sits in.
const HOST_AND_PATH = /^[A-Za-z0-9._~!$&'()*+,=:@%/-]+$/;

export type AppLinkInput = { package: string; scheme?: string; hostAndPath?: string };

/** What is wrong with the input, in words; empty when it can be used. */
export function validateAppLinkInput(input: AppLinkInput): string[] {
  const errors: string[] = [];
  if (!PACKAGE_ID.test(input.package)) {
    errors.push(`"${input.package}" is not an Android package name (like com.example.app).`);
  }
  if (input.scheme !== undefined && !SCHEME.test(input.scheme)) {
    errors.push(`"${input.scheme}" is not a URL scheme (letters, digits, + - . and starting with a letter).`);
  }
  if (input.hostAndPath !== undefined && !HOST_AND_PATH.test(input.hostAndPath)) {
    errors.push(`"${input.hostAndPath}" is not a host or path (no spaces, ; or #).`);
  }
  return errors;
}

function checked(input: AppLinkInput): void {
  const errors = validateAppLinkInput(input);
  if (errors.length > 0) throw new Error(errors.join(" "));
}

export function playStoreUrl(packageId: string): string {
  return `https://play.google.com/store/apps/details?id=${packageId}`;
}

const fallback = (packageId: string) => `S.browser_fallback_url=${encodeURIComponent(playStoreUrl(packageId))}`;

/** Opens the app's launcher screen, whatever deep links it registers. */
export function launcherIntentUrl(input: { package: string }): string {
  checked(input);
  return (
    "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;" +
    `package=${input.package};${fallback(input.package)};end`
  );
}

/** Opens the app at a deep link it registers: `<scheme>://<hostAndPath>`. */
export function schemeIntentUrl(input: { scheme: string; hostAndPath: string; package: string }): string {
  checked(input);
  return `intent://${input.hostAndPath}#Intent;scheme=${input.scheme};package=${input.package};${fallback(input.package)};end`;
}
