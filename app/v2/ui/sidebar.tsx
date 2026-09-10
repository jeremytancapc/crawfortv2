"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "@phosphor-icons/react";

import { useApplyPath } from "@/app/use-apply-path";
import { V2_STAGES, V2_STAGE_META } from "@/app/v2/ui/progress";
import { useV2Progress } from "@/app/v2/ui/progress-store";
import { cx } from "@/app/v2/ui/screen";

const WHATSAPP_URL = "https://wa.me/6560119380";

/**
 * Desktop-only left rail (hidden below 1024px in `v2.css`): wordmark, a
 * vertical stepper with room for words, and the licence line. It reads the
 * current stage from the progress store that each screen's header feeds.
 */
export function V2Sidebar() {
  const applyHref = useApplyPath();
  const progress = useV2Progress();
  const currentIndex = progress ? V2_STAGES.indexOf(progress.stage) : 0;

  return (
    <aside className="v2-sidebar" aria-label="Application progress">
      <Link href={applyHref("/")} aria-label="Crawfort home" className="self-start">
        <Image
          src="/images/crawfort-white-color-dot.png"
          alt="Crawfort"
          width={1024}
          height={120}
          className="h-[22px] w-auto"
          priority
        />
      </Link>

      <div className="mt-12">
        <p className="v2-sidebar-kicker">Personal loan</p>
        <h2 className="v2-sidebar-title">Apply in minutes. Collect in person.</h2>
      </div>

      <ol className="v2-rail-steps" aria-label="Steps">
        {V2_STAGES.map((stage, index) => {
          const meta = V2_STAGE_META[stage];
          const state =
            index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
          return (
            <li
              key={stage}
              className={cx("v2-rail-step", `is-${state}`)}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="v2-rail-step-marker" aria-hidden="true">
                {state === "done" ? <Check size={12} weight="bold" /> : index + 1}
              </span>
              <span className="v2-rail-step-text">
                <span className="v2-rail-step-label">{meta.label}</span>
                <span className="v2-rail-step-detail">{meta.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto flex flex-col gap-3">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="v2-sidebar-link"
        >
          Need a hand? WhatsApp us
        </a>
        <p className="v2-note">
          CF Money Pte. Ltd. Licensed moneylender, Licence No. 86/2026.
        </p>
      </div>
    </aside>
  );
}
