import Image from "next/image";

/**
 * Mobile-only legal footer - matches the home page's chrome and copy so
 * every consumer apply-funnel page ends with the same licensed-moneylender
 * disclosures. Hidden on lg+ (desktop uses the sidebar instead).
 */
export function MobileLegalFooter() {
  return (
    <footer className="hero-chrome lg:hidden px-5 pb-10 pt-12 text-[var(--text-on-brand)]">
      <Image
        src="/images/crawfort-white.png"
        alt="Crawfort"
        width={151}
        height={20}
        className="mb-4 h-5 w-auto"
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
        <span className="opacity-75">
          Copyright © 2026 CF Money Pte. Ltd. All rights reserved
        </span>
      </div>

      <p className="mt-4 text-xs leading-relaxed opacity-70">
        CF Money Pte. Ltd. (UEN No. 201406595W) is a company incorporated under the laws of Singapore. Customers are advised to read the{" "}
        <a
          href="https://crawfort.com/sg/terms/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 opacity-100"
        >
          Terms and Conditions
        </a>{" "}
        and{" "}
        <a
          href="https://crawfort.com/sg/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 opacity-100"
        >
          Privacy Policy
        </a>{" "}
        carefully. If you have any concerns or further queries about how we are handling your personal data or queries regarding the Terms and Conditions and the Privacy Policy, please contact our Data Protection Officer at{" "}
        <a
          href="mailto:dposg@crawfort.com"
          className="underline underline-offset-2 opacity-100"
        >
          dposg@crawfort.com
        </a>
        .
      </p>

      <p className="mt-4 text-xs font-semibold">
        For loan enquiries, please contact us at{" "}
        <a href="tel:+6567778080" className="underline underline-offset-2">+65 6777 8080</a>
        {" "}or{" "}
        <a href="mailto:hellosg@crawfort.com" className="underline underline-offset-2">hellosg@crawfort.com</a>
      </p>
    </footer>
  );
}
