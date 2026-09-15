import type { Metadata } from "next";
import { AscendPendingQueueView } from "./pending-queue-view";

export const metadata: Metadata = {
  title: "Credit review | Crawfort",
  description: "Applications Ascend returned PENDING, awaiting credit officer resolution.",
};

export default function AscendPendingPage() {
  return <AscendPendingQueueView />;
}
