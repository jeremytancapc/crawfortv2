"use client";

import dynamic from "next/dynamic";
import { CircleLoader } from "@/components/ui/circle-loader";

/**
 * The workspace generates its mock dataset from Date.now()/Math.random(),
 * so it must never be server-rendered (would cause a hydration mismatch).
 * Loading it with ssr: false guarantees it only ever runs in the browser.
 */
const Workspace = dynamic(() => import("./workspace").then((mod) => mod.Workspace), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <CircleLoader size={40} />
      <p className="text-sm font-medium text-[var(--text-tertiary)]">Loading AirConnect...</p>
    </div>
  ),
});

export function AirConnectLoader() {
  return <Workspace />;
}
