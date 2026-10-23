import { describe, expect, it } from "vitest";

import { appStoreUrl, iosSchemeUrl, smartAppBannerContent, validateIosLinkInput } from "./ios-app-link";

/**
 * An iPhone opens an installed app from a tapped link with the app's custom
 * scheme (`crawfort://`), after Safari asks "Open in Crawfort?". It has no
 * fallback of its own: with the app missing, Safari says the address is
 * invalid. So the page offers the App Store as a separate, tappable link
 * rather than guessing from a timer. The `intent:` links used on Android mean
 * nothing here.
 */

describe("the link that opens the app on an iPhone", () => {
  it("is the scheme on its own when no host is given", () => {
    expect(iosSchemeUrl({ scheme: "crawfort" })).toBe("crawfort://");
  });

  it("carries a host or path when one is given", () => {
    expect(iosSchemeUrl({ scheme: "crawfort", hostAndPath: "open" })).toBe("crawfort://open");
    expect(iosSchemeUrl({ scheme: "crawfort", hostAndPath: "loan/offer" })).toBe("crawfort://loan/offer");
  });

  it("refuses a scheme or host that could break out of the link", () => {
    expect(() => iosSchemeUrl({ scheme: "craw fort" })).toThrow();
    expect(() => iosSchemeUrl({ scheme: "crawfort", hostAndPath: "open;end" })).toThrow();
    expect(validateIosLinkInput({ scheme: "javascript:alert(1)//" })).not.toEqual([]);
  });

  it("accepts the scheme the app team confirmed", () => {
    expect(validateIosLinkInput({ scheme: "crawfort" })).toEqual([]);
  });
});

describe("the App Store listing", () => {
  it("is the address Crawfort's own mobile-app link sends an iPhone to", () => {
    // Read from https://crawfort.com/mobileapp requested as an iPhone, 22 Oct 2026.
    expect(appStoreUrl("6751946791")).toBe("https://apps.apple.com/sg/app/crawfort/id6751946791");
  });

  it("refuses an id that is not digits", () => {
    expect(() => appStoreUrl("67519;46791")).toThrow();
    expect(() => appStoreUrl("")).toThrow();
  });
});

describe("the Smart App Banner", () => {
  it("is the content Safari reads from the apple-itunes-app tag", () => {
    expect(smartAppBannerContent("6751946791")).toBe("app-id=6751946791");
  });
});
