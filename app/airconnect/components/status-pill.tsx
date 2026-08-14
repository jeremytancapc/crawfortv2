import { STATUS_LABELS, type LeadStatus } from "@/lib/airconnect/types";

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-600",
  assigned: "bg-blue-50 text-blue-700",
  "no-response": "bg-red-50 text-red-600",
  qualifying: "bg-violet-50 text-violet-700",
  "pending-booking": "bg-amber-50 text-amber-700",
  booked: "bg-emerald-50 text-emerald-700",
  "not-eligible": "bg-red-100 text-red-700",
  done: "bg-slate-200 text-slate-600",
};

export function StatusPill({ status, className = "" }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        STATUS_STYLES[status],
        className,
      ].join(" ")}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
