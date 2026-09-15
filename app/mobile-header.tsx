"use client";

import Image from "next/image";

/**
 * Sticky mobile header - static hero-blue at all scroll positions, matching
 * the home page's theme-fresh chrome. Hidden on lg+ (desktop uses the
 * sidebar logo instead).
 */
export function MobileHeader() {
  return (
    <>
      <div className="ios-apply-header-slot lg:hidden" aria-hidden="true" />
      <div className="ios-apply-header hero-chrome flex items-center justify-center px-6 py-4 lg:hidden">
        <a href="/">
          <Image
            src="/images/crawfort-white.png"
            alt="Crawfort"
            width={151}
            height={20}
            className="h-5 w-auto"
            priority
          />
        </a>
      </div>
    </>
  );
}
