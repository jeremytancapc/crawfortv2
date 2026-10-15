"use client";

import { useCallback, useState } from "react";

import { MyinfoEditSheet } from "@/app/apply/review/myinfo-edit-sheet";
import type { CpfRow, NoaRow } from "@/lib/myinfo-edit";

type FieldState = "idle" | "saving" | "done" | "error";

/**
 * Staging-only, one-click "mark CPF/NOA unavailable" for the current
 * application - no separate page, no manual save. /api/dev/myinfo-strip does
 * the read-edit-write server-side; this just fires it and shows the result.
 *
 * Remove marks a field unavailable; Edit opens a panel to change the figures
 * themselves, starting from what the application has now or a default.
 *
 * The full editor at /auth/callback-result still exists for hand-editing
 * anything else in the payload - this widget only ever covers the two
 * fields testers actually reach for.
 */
export function MyinfoDebugWidget({
  rid,
  current,
}: {
  rid: string;
  /** What the application holds now, so the editor starts from it. */
  current: { cpf: CpfRow[]; noa: NoaRow[] };
}) {
  const [cpf, setCpf] = useState<FieldState>("idle");
  const [noa, setNoa] = useState<FieldState>("idle");
  const [editing, setEditing] = useState(false);

  const strip = useCallback(
    async (field: "cpfcontributions" | "noahistory", setState: (s: FieldState) => void) => {
      setState("saving");
      try {
        const res = await fetch("/api/dev/myinfo-strip", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rid, field }),
        });
        setState(res.ok ? "done" : "error");
      } catch {
        setState("error");
      }
    },
    [rid],
  );

  const label = (base: string, state: FieldState) =>
    state === "saving" ? "Removing…" : state === "done" ? `${base} ✓` : state === "error" ? "Failed - retry" : base;

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col gap-1.5 rounded-xl border border-amber-400 bg-amber-50 p-2 shadow-md">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        Staging - MyInfo
      </p>
      <button
        type="button"
        onClick={() => void strip("cpfcontributions", setCpf)}
        disabled={cpf === "saving"}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
      >
        {label("Remove CPF", cpf)}
      </button>
      <button
        type="button"
        onClick={() => void strip("noahistory", setNoa)}
        disabled={noa === "saving"}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
      >
        {label("Remove NOA", noa)}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-lg border border-amber-600 bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700"
      >
        Edit NOA / CPF…
      </button>
      {editing ? <MyinfoEditSheet rid={rid} current={current} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
