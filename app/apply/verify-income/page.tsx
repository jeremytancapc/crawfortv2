import type { Viewport } from "next";
import Image from "next/image";

import { SidebarTrustFeatures } from "@/app/sidebar-trust-features";
import { ApplyProgressPanel } from "@/app/apply-gate/ios-ui";
import { APPLY_PROGRESS, APPLY_PROGRESS_TOTAL } from "@/lib/apply-progress";
import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";

import { VerifyIncomeForm } from "@/app/apply/verify-income/verify-income-form";

export const dynamic = "force-dynamic";

/**
 * Route-scoped so the sticky footer can clear the home indicator, matching `/`.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function VerifyIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  await enforceApplyFunnel("/apply/verify-income");
  const params = await searchParams;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;

  return (
    <div className="theme-ios flex min-h-[100dvh] flex-col bg-[var(--surface-primary)] lg:flex-row">
      <aside className="relative hidden overflow-hidden bg-[var(--accent)] p-12 lg:flex lg:w-[42%] lg:flex-col lg:justify-between xl:w-[38%] xl:p-16">
        <div className="relative z-10">
          <div className="mb-16">
            <Image
              src="/images/crawfort-white.png"
              alt="Crawfort"
              width={1261}
              height={155}
              className="h-6 w-auto"
              priority
            />
          </div>

          <p className="max-w-[420px] text-[44px] font-bold leading-[1.08] tracking-[-0.024em] text-white">
            Get the funds you need, in 8 minutes
          </p>

          <p className="mt-5 max-w-[380px] text-[17px] leading-[1.45] text-white/70">
            One simple application. Licensed and trusted by over 200,000
            Singaporeans since 2011.
          </p>
        </div>

        <ApplyProgressPanel
          current={APPLY_PROGRESS.verifyOrIdentity}
          total={APPLY_PROGRESS_TOTAL}
        />

        <SidebarTrustFeatures />
      </aside>

      <main className="flex flex-1 flex-col overflow-x-clip">
        <div className="flex flex-1 flex-col lg:justify-start lg:px-12 lg:py-10 xl:px-20">
          <div className="flex w-full flex-1 flex-col lg:mx-auto lg:max-w-[520px] lg:flex-none">
            <VerifyIncomeForm initialShowResults={view === "results"} />
          </div>
        </div>

        <LandingLegalFooter />
      </main>
    </div>
  );
}

function LandingLegalFooter() {
  return (
    <footer className="ios-apply-gutter pb-10 pt-8 text-[13px] leading-[1.5] text-[var(--text-secondary)] lg:hidden">
      <p>
        CF Money Pte. Ltd. (UEN No. 201406595W) is a company incorporated under
        the laws of Singapore. Customers are advised to read the{" "}
        <a
          href="https://crawfort.com/sg/terms/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Terms and Conditions
        </a>{" "}
        and{" "}
        <a
          href="https://crawfort.com/sg/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Privacy Policy
        </a>{" "}
        carefully.
      </p>
    </footer>
  );
}
