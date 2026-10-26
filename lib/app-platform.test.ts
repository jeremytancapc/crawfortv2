import { describe, expect, it } from "vitest";

import { platformFromUserAgent, platformToShow } from "./app-platform";

/**
 * The test page should show an Android phone the Android links and an iPhone
 * the iPhone links: both side by side let a tester on one tap the other's
 * button and land in the wrong store. Detection is from the user agent, so it
 * can be wrong, and the page can always be told which to show.
 */

const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const ANDROID_DESKTOP_SITE = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

describe("platformFromUserAgent", () => {
  it("recognises Android browsers", () => {
    expect(platformFromUserAgent(CHROME_ANDROID)).toBe("android");
    expect(platformFromUserAgent(SAMSUNG)).toBe("android");
  });

  it("recognises iPhone and older iPad browsers", () => {
    expect(platformFromUserAgent(IPHONE)).toBe("ios");
    expect(platformFromUserAgent(IPAD)).toBe("ios");
  });

  it("says nothing about a computer, a missing header, or Android's 'desktop site' mode", () => {
    expect(platformFromUserAgent(MAC)).toBe("other");
    expect(platformFromUserAgent(ANDROID_DESKTOP_SITE)).toBe("other");
    expect(platformFromUserAgent(null)).toBe("other");
    expect(platformFromUserAgent("")).toBe("other");
  });
});

describe("platformToShow", () => {
  it("follows the device when nobody has asked for one", () => {
    expect(platformToShow(undefined, CHROME_ANDROID)).toBe("android");
    expect(platformToShow(undefined, IPHONE)).toBe("ios");
    expect(platformToShow(undefined, MAC)).toBe("all");
  });

  it("does what the tester asks, whatever the device says", () => {
    expect(platformToShow("ios", CHROME_ANDROID)).toBe("ios");
    expect(platformToShow("android", IPHONE)).toBe("android");
    expect(platformToShow("all", CHROME_ANDROID)).toBe("all");
  });

  it("ignores a request it does not understand", () => {
    expect(platformToShow("windows", CHROME_ANDROID)).toBe("android");
  });
});
