import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  launcherIntentUrl,
  playStoreUrl,
  schemeIntentUrl,
  validateAppLinkInput,
} from "@/lib/android-app-link";
import { platformToShow } from "@/lib/app-platform";
import { appStoreUrl, iosSchemeUrl, smartAppBannerContent, validateIosLinkInput } from "@/lib/ios-app-link";

// The iPhone app's App Store id, from where https://crawfort.com/mobileapp sends
// an iPhone.
const IOS_APP_ID = "6751946791";

export const metadata: Metadata = {
  title: "Open the Crawfort app (test)",
  robots: { index: false, follow: false },
  // Safari on iPhone shows an Open / Get banner for the app at the top of the page.
  other: { "apple-itunes-app": smartAppBannerContent(IOS_APP_ID) },
};

export const dynamic = "force-dynamic";

// Taken from the staging Play Store link (NEXT_PUBLIC_PLAY_STORE_URL). Not yet
// confirmed with whoever built the Android app.
const DEFAULT_PACKAGE = "com.crawfort.app";
// Confirmed by the app team as the app's scheme. Whether the Android app
// registers the same scheme is not yet confirmed.
const DEFAULT_SCHEME = "crawfort";
const DEFAULT_HOST = "open";

interface PageProps {
  searchParams: Promise<{
    package?: string | string[];
    scheme?: string | string[];
    host?: string | string[];
    show?: string | string[];
  }>;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

const button =
  "block w-full rounded-xl bg-[#0033AA] px-4 py-3.5 text-center text-[15px] font-bold text-white active:opacity-80";
const secondary =
  "block w-full rounded-xl border border-[#0033AA] px-4 py-3.5 text-center text-[15px] font-bold text-[#0033AA] active:opacity-80";
const code = "block break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-[12px] leading-relaxed text-neutral-800";
const input = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[14px] text-neutral-900";

/**
 * A test page for opening the Crawfort Android app from a tapped link.
 *
 * Open it in Chrome on an Android phone and tap a button. Typing an intent or a
 * scheme into the address bar does nothing, and a desktop or an iPhone cannot
 * open the app at all - those look like failures when the link is fine.
 */
export default async function OpenAppTestPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const packageId = first(sp.package) ?? DEFAULT_PACKAGE;
  const scheme = first(sp.scheme) ?? DEFAULT_SCHEME;
  const host = first(sp.host) ?? DEFAULT_HOST;

  // Show an Android phone the Android links and an iPhone the iPhone links, so
  // neither taps the other's store. `?show=all|android|ios` overrides it.
  const show = platformToShow(first(sp.show), (await headers()).get("user-agent"));
  const showAndroid = show !== "ios";
  const showIos = show !== "android";

  const problems = validateAppLinkInput({ package: packageId, scheme, hostAndPath: host });
  const ok = problems.length === 0;

  const launcher = ok ? launcherIntentUrl({ package: packageId }) : null;
  const deepLink = ok ? schemeIntentUrl({ scheme, hostAndPath: host, package: packageId }) : null;

  // iPhone links need no package, so a bad package name does not hide them.
  const iosOk = validateIosLinkInput({ scheme, hostAndPath: host }).length === 0;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-5 px-4 py-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Test page - not part of the apply journey</p>
        <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Open the Crawfort app</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-neutral-700">
          Open this page on the phone and <strong>tap</strong> a button. Typing a link into the address bar never launches
          an app. The Android buttons work only in Chrome on Android; the iPhone section is further down.
        </p>
      </header>

      {!ok ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
          {problems.join(" ")}
        </p>
      ) : null}

      <p className="text-[12px] text-neutral-500">
        Showing: <strong>{show === "all" ? "Android and iPhone" : show === "android" ? "Android" : "iPhone"}</strong>
        {" - "}
        <a href="?show=android" className="underline">Android</a>
        {" | "}
        <a href="?show=ios" className="underline">iPhone</a>
        {" | "}
        <a href="?show=all" className="underline">both</a>
      </p>

      {showAndroid ? (
        <>
      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold text-neutral-900">Android 1. Open by package name</h2>
        <p className="text-[13px] leading-relaxed text-neutral-600">
          Starts the app&apos;s main screen. It needs only the package name, so it works even if the app registers no deep
          link. If the app is not installed, Android goes to the Play Store.
        </p>
        {launcher ? (
          <a href={launcher} className={button}>
            Open the Crawfort app
          </a>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold text-neutral-900">
          Android 2. Open at the deep link {scheme}://{host}
        </h2>
        <p className="text-[13px] leading-relaxed text-neutral-600">
          Only works if the app&apos;s manifest declares this scheme. <strong>{scheme}://</strong> was a guess. If tapping
          this does nothing, or lands on the Play Store with the app installed, that scheme is not registered.
        </p>
        {deepLink ? (
          <a href={deepLink} className={secondary}>
            Open with {scheme}://{host}
          </a>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold text-neutral-900">Android 3. Play Store</h2>
        <a href={playStoreUrl(packageId)} className={secondary}>
          Open the Play Store listing
        </a>
        <a href={`market://details?id=${packageId}`} className={secondary}>
          Open it in the Play Store app (market://)
        </a>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold text-neutral-900">Android 4. App Link (a plain https link that opens the app)</h2>
        <p className="text-[13px] leading-relaxed text-neutral-600">
          No Crawfort domain publishes an <code>assetlinks.json</code> yet, so this opens the website, not the app, until
          App Links are set up and verified.
        </p>
        <a href="https://app.crawfort.com/" className={secondary}>
          https://app.crawfort.com/
        </a>
      </section>
        </>
      ) : null}

      {showIos ? (
      <section className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
        <h2 className="text-[15px] font-bold text-neutral-900">iPhone</h2>
        <p className="text-[13px] leading-relaxed text-neutral-600">
          The Android buttons above do nothing on an iPhone. Tapping the first button here makes Safari ask
          &quot;Open in Crawfort?&quot;. If the app is not installed, Safari says the address is invalid - use the App Store
          button instead. Safari may also show an Open / Get banner at the top of this page.
        </p>
        {iosOk ? (
          <>
            <a href={iosSchemeUrl({ scheme })} className={button}>
              Open the Crawfort app ({scheme}://)
            </a>
            <a href={iosSchemeUrl({ scheme, hostAndPath: host })} className={secondary}>
              Open with {scheme}://{host}
            </a>
          </>
        ) : null}
        <a href={appStoreUrl(IOS_APP_ID)} className={secondary}>
          Get the app on the App Store
        </a>
      </section>
      ) : null}

      <section className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
        <h2 className="text-[15px] font-bold text-neutral-900">Try other values</h2>
        <form method="get" className="flex flex-col gap-2">
          <label className="text-[12px] font-semibold text-neutral-600">
            Package name
            <input name="package" defaultValue={packageId} className={input} autoCapitalize="none" autoCorrect="off" />
          </label>
          <label className="text-[12px] font-semibold text-neutral-600">
            Scheme
            <input name="scheme" defaultValue={scheme} className={input} autoCapitalize="none" autoCorrect="off" />
          </label>
          <label className="text-[12px] font-semibold text-neutral-600">
            Host and path
            <input name="host" defaultValue={host} className={input} autoCapitalize="none" autoCorrect="off" />
          </label>
          <button type="submit" className={secondary}>
            Update the links
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
        <h2 className="text-[15px] font-bold text-neutral-900">Check from a computer (USB debugging)</h2>
        <p className="text-[13px] leading-relaxed text-neutral-600">Opens the app by package:</p>
        <code className={code}>adb shell monkey -p {packageId} -c android.intent.category.LAUNCHER 1</code>
        <p className="text-[13px] leading-relaxed text-neutral-600">
          Tests whether the scheme is registered (nothing happens, or a chooser appears, if it is not):
        </p>
        <code className={code}>
          adb shell am start -a android.intent.action.VIEW -d {scheme}://{host} {packageId}
        </code>
        <p className="text-[13px] leading-relaxed text-neutral-600">Is the app installed?</p>
        <code className={code}>adb shell pm list packages {packageId}</code>
      </section>
    </main>
  );
}
