import { describe, expect, it } from "vitest";

import { detectLocale, isLocale, translateText } from "./i18n";

describe("locale selection", () => {
  it("detects Simplified Chinese and Malay from browser language tags", () => {
    expect(detectLocale(["zh-SG", "en-SG"])).toBe("zh-CN");
    expect(detectLocale(["ms-MY", "en-US"])).toBe("ms");
  });

  it("uses the first supported browser language and defaults to English", () => {
    expect(detectLocale(["fr-FR", "en-SG", "zh-CN"])).toBe("en");
    expect(detectLocale(["fr-FR", "zh-Hans-SG"])).toBe("zh-CN");
    expect(detectLocale(["fr-FR"])).toBe("en");
  });

  it("validates supported manual locale choices", () => {
    expect(isLocale("zh-CN")).toBe(true);
    expect(isLocale("ms")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});

describe("text translation", () => {
  it("translates known UI labels and preserves unknown copy in English", () => {
    expect(translateText("Choose your loan plan", "zh-CN")).toBe("选择您的贷款方案");
    expect(translateText("Selected", "ms")).toBe("Dipilih");
    expect(translateText("Untranslated legal copy", "ms")).toBe("Untranslated legal copy");
    expect(translateText("Selected", "en")).toBe("Selected");
  });

  it("translates primary loan setup and application review labels", () => {
    expect(translateText("Loan amount", "zh-CN")).toBe("贷款金额");
    expect(translateText("Your preferred payout time", "ms")).toBe("Masa pembayaran pilihan anda");
    expect(translateText("Submit Application", "ms")).toBe("Hantar permohonan");
    expect(translateText("Secure my slot", "zh-CN")).toBe("确认预约时段");
    expect(translateText("Collect your funds", "ms")).toBe("Terima dana anda");
  });

  it("translates plan selection and application progress details", () => {
    expect(translateText("Your own plan", "zh-CN")).toBe("自选方案");
    expect(translateText("86% of people choose this", "ms")).toBe("86% pelanggan memilih pelan ini");
    expect(translateText("Application not started yet. Show what happens next", "zh-CN"))
      .toBe("申请尚未开始。查看接下来的步骤");
    expect(translateText("Pick a date and time to visit.", "ms"))
      .toBe("Pilih tarikh dan masa untuk berkunjung.");
  });

  it("translates AXS, AIP, and booking-confirmation surfaces", () => {
    expect(translateText("Total outstanding amount", "zh-CN")).toBe("未偿还总额");
    expect(translateText("Approved in Principle", "ms")).toBe("Diluluskan secara prinsip");
    expect(translateText("Book your appointment", "zh-CN")).toBe("预约到访");
    expect(translateText("Appointment confirmed", "ms")).toBe("Janji temu disahkan");
    expect(translateText("Add to calendar", "ms")).toBe("Tambah ke kalendar");
  });

  it("translates income verification and customer outcome screens", () => {
    expect(translateText("Income Documents Required", "zh-CN")).toBe("需要收入证明文件");
    expect(translateText("Upload up to 3 months of documents", "ms")).toBe("Muat naik dokumen sehingga 3 bulan");
    expect(translateText("Wait for our call", "zh-CN")).toBe("请等待我们的来电");
    expect(translateText("Existing Crawfort Customers", "ms")).toBe("Pelanggan Crawfort sedia ada");
  });
});
