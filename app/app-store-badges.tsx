/** Shared "download the app" artwork - the App Store / Google Play badges
 *  plus the link they all point to. Used on the booked confirmation and on
 *  the bad-case staging pages that end the web flow (existing customer). */
export const MOBILE_APP_URL = "https://crawfort.com/mobileapp";

export function AppStoreBadges() {
  return (
    <div className="flex items-center justify-center gap-2">
      <a
        href={MOBILE_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-opacity duration-150 hover:opacity-80 active:scale-[0.98]"
      >
        {/* Official Apple badge — do not restyle the artwork. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/download-on-app-store.svg"
          alt="Download on the App Store"
          width={120}
          height={40}
          className="h-12 w-auto"
        />
      </a>
      <a
        href={MOBILE_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-opacity duration-150 hover:opacity-80 active:scale-[0.98]"
      >
        {/* Official Google badge — extra PNG padding, sized to match Apple. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/get-it-on-google-play.png"
          alt="Get it on Google Play"
          width={155}
          height={58}
          className="h-[70px] w-auto"
        />
      </a>
    </div>
  );
}
