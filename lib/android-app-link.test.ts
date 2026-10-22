import { describe, expect, it } from "vitest";

import {
  launcherIntentUrl,
  playStoreUrl,
  schemeIntentUrl,
  schemeOnlyIntentUrl,
  validateAppLinkInput,
} from "./android-app-link";

/**
 * Tapping an `intent://` link is how a web page opens a native Android app and
 * falls back to the Play Store when it is not installed. The strings below are
 * the shapes Android Chrome documents, written out in full rather than rebuilt
 * with the code under test: a link that is one character off does not launch
 * anything, and nothing reports why.
 */

describe("the Play Store address", () => {
  it("is the listing for the package", () => {
    expect(playStoreUrl("com.crawfort.app")).toBe("https://play.google.com/store/apps/details?id=com.crawfort.app");
  });
});

describe("a link that opens the app by its package alone", () => {
  it("asks Android to start the app's launcher screen, and falls back to the Play Store", () => {
    expect(launcherIntentUrl({ package: "com.crawfort.app" })).toBe(
      "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.crawfort.app;" +
        "S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.crawfort.app;end",
    );
  });
});

describe("a link that opens the app at its registered deep link", () => {
  it("has the exact shape the task gives, with the Play Store as the fallback", () => {
    expect(schemeIntentUrl({ scheme: "crawfort", hostAndPath: "open", package: "sg.crawfort.app" })).toBe(
      "intent://open#Intent;scheme=crawfort;package=sg.crawfort.app;" +
        "S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dsg.crawfort.app;end",
    );
  });

  it("carries a path as well as a host", () => {
    expect(schemeIntentUrl({ scheme: "crawfort", hostAndPath: "loan/offer", package: "com.crawfort.app" })).toMatch(
      /^intent:\/\/loan\/offer#Intent;scheme=crawfort;package=com\.crawfort\.app;/,
    );
  });
});

describe("a link that finds the app by its scheme alone", () => {
  // The installed app can have a different package name from its store listing
  // (a build from another channel, a flavour), which makes every link that
  // names the package fall through to the store. The scheme does not depend on it.
  it("names no package, and falls back to the address given", () => {
    expect(
      schemeOnlyIntentUrl({ scheme: "crawfort", hostAndPath: "open", fallbackUrl: "https://crawfort.com/mobileapp" }),
    ).toBe("intent://open#Intent;scheme=crawfort;S.browser_fallback_url=https%3A%2F%2Fcrawfort.com%2Fmobileapp;end");
  });

  it("will not take a fallback that is not an https address", () => {
    for (const bad of ["javascript:alert(1)", "http://crawfort.com/mobileapp", "intent://x#Intent;end", ""]) {
      expect(() => schemeOnlyIntentUrl({ scheme: "crawfort", hostAndPath: "open", fallbackUrl: bad }), bad).toThrow();
    }
  });

  it("still refuses a scheme or host that could break out of the link", () => {
    expect(() =>
      schemeOnlyIntentUrl({ scheme: "craw;fort", hostAndPath: "open", fallbackUrl: "https://crawfort.com/mobileapp" }),
    ).toThrow();
  });
});

describe("what a tester may type into the page", () => {
  it("accepts a normal package, scheme and host", () => {
    expect(validateAppLinkInput({ package: "com.crawfort.app", scheme: "crawfort", hostAndPath: "open" })).toEqual([]);
  });

  it("rejects a package that is not an Android application id", () => {
    for (const bad of ["", "crawfort", "com..app", "com.crawfort.app;end", "com.crawfort app", "1com.app"]) {
      expect(validateAppLinkInput({ package: bad }), bad).not.toEqual([]);
    }
  });

  it("rejects a scheme with characters that would break out of the link", () => {
    for (const bad of ["crawfort;end", "craw fort", "craw#fort", "://", "1crawfort"]) {
      expect(validateAppLinkInput({ package: "com.crawfort.app", scheme: bad }), bad).not.toEqual([]);
    }
  });

  it("rejects a host or path that would end the intent early", () => {
    for (const bad of ["open;end", "open#x", "op en", "open\nx"]) {
      expect(validateAppLinkInput({ package: "com.crawfort.app", scheme: "crawfort", hostAndPath: bad }), bad).not.toEqual([]);
    }
  });

  it("refuses to build a link from input it rejected", () => {
    expect(() => launcherIntentUrl({ package: "com.crawfort.app;end" })).toThrow();
    expect(() => schemeIntentUrl({ scheme: "craw;fort", hostAndPath: "open", package: "com.crawfort.app" })).toThrow();
  });
});
