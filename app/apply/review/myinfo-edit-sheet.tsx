"use client";

import { useState } from "react";

import {
  defaultCpfRows,
  defaultNoaRows,
  generateCpfRows,
  validateCpfRows,
  validateNoaRows,
  type CpfRow,
  type NoaRow,
} from "@/lib/myinfo-edit";

/**
 * Staging-only: edit the CPF and NOA on the open application before it goes to
 * Ascend. Saved to the retrieved Singpass record, to our own database and to
 * the cookie the review page reads, so what is shown, kept and sent agree.
 *
 * Values start from what the application has now; where it has none, from a
 * default a tester can adjust rather than build from nothing.
 */

type Tab = "noa" | "cpf";

// Inputs hold text while being typed, so "" and "9." are allowed on the way.
type NoaDraft = Record<keyof NoaRow, string>;
type CpfDraft = { month: string; amount: string; employer: string };

const toNoaDraft = (row: NoaRow): NoaDraft => ({
  yearOfAssessment: row.yearOfAssessment,
  employmentIncome: String(row.employmentIncome),
  tradeIncome: String(row.tradeIncome),
  rentIncome: String(row.rentIncome),
  interestIncome: String(row.interestIncome),
});
const toCpfDraft = (row: CpfRow): CpfDraft => ({ month: row.month, amount: String(row.amount), employer: row.employer });

const num = (text: string) => (text.trim() === "" ? 0 : Number(text));
const noaRows = (drafts: NoaDraft[]): NoaRow[] =>
  drafts.map((d) => ({
    yearOfAssessment: d.yearOfAssessment.trim(),
    employmentIncome: num(d.employmentIncome),
    tradeIncome: num(d.tradeIncome),
    rentIncome: num(d.rentIncome),
    interestIncome: num(d.interestIncome),
  }));
const cpfRows = (drafts: CpfDraft[]): CpfRow[] =>
  drafts.map((d) => ({ month: d.month.trim(), amount: Number(d.amount), employer: d.employer.trim() }));

const money = (n: number) => `$${(Number.isFinite(n) ? n : 0).toLocaleString("en-SG")}`;

const input =
  "w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-[13px] text-neutral-900 focus:border-amber-500 focus:outline-none";
const label = "block text-[10px] font-semibold uppercase tracking-wide text-amber-800";
const ghost = "rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-amber-900 hover:bg-amber-100";

export function MyinfoEditSheet({
  rid,
  current,
  onClose,
}: {
  rid: string;
  current: { cpf: CpfRow[]; noa: NoaRow[] };
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("noa");
  const [noa, setNoa] = useState<NoaDraft[]>(() => (current.noa.length ? current.noa : defaultNoaRows()).map(toNoaDraft));
  const [cpf, setCpf] = useState<CpfDraft[]>(() => (current.cpf.length ? current.cpf : defaultCpfRows()).map(toCpfDraft));
  // Only what was actually touched is sent, so editing NOA never rewrites CPF.
  const [touched, setTouched] = useState<Record<Tab, boolean>>({ noa: false, cpf: false });
  const [gen, setGen] = useState(() => {
    const d = defaultCpfRows();
    return { employer: d[0].employer, amount: String(d[0].amount), months: "12", latestMonth: d[0].month };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const touch = (which: Tab) => setTouched((t) => ({ ...t, [which]: true }));
  // Nothing on file means the rows shown are a default to start from, not data.
  const onFile: Record<Tab, boolean> = { noa: current.noa.length > 0, cpf: current.cpf.length > 0 };
  const isDefault = (which: Tab) => !onFile[which] && !touched[which];

  const editNoa = (index: number, key: keyof NoaDraft, value: string) => {
    touch("noa");
    setNoa((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };
  const editCpf = (index: number, key: keyof CpfDraft, value: string) => {
    touch("cpf");
    setCpf((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  async function save() {
    setError(null);
    const body: { rid: string; noa?: NoaRow[]; cpf?: CpfRow[] } = { rid };
    if (touched.noa) {
      if (noa.length === 0) return setError("NOA: add at least one year, or use Remove NOA.");
      body.noa = noaRows(noa);
    }
    if (touched.cpf) {
      if (cpf.length === 0) return setError("CPF: add at least one month, or use Remove CPF.");
      body.cpf = cpfRows(cpf);
    }
    const problems = [...(body.noa ? validateNoaRows(body.noa) : []), ...(body.cpf ? validateCpfRows(body.cpf) : [])];
    if (problems.length > 0) return setError(problems.join(" "));

    setSaving(true);
    try {
      const res = await fetch("/api/dev/myinfo-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))) as { error?: string };
        setError(detail.error ?? `Save failed (${res.status}).`);
        return;
      }
      // The review page was drawn from the old figures; redraw it from the new.
      window.location.reload();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  const anyTouched = touched.noa || touched.cpf;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Edit MyInfo">
      <div className="flex max-h-[90vh] w-full max-w-[460px] flex-col rounded-t-2xl bg-amber-50 shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-amber-200 px-4 py-3">
          <div>
            <p className="text-[15px] font-bold text-amber-950">Edit MyInfo</p>
            <p className="text-[12px] leading-snug text-amber-800">
              Staging only. Saved in our database and sent to Ascend when you submit.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[20px] leading-none text-amber-900">
            ×
          </button>
        </header>

        <div className="flex gap-1 border-b border-amber-200 px-4 pt-2">
          {(["noa", "cpf"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-t-md px-3 py-1.5 text-[13px] font-semibold ${
                tab === t ? "bg-white text-amber-950" : "text-amber-800 hover:bg-amber-100"
              }`}
            >
              {t === "noa" ? "NOA" : "CPF"}{" "}
              {isDefault(t) ? "(none on file)" : `(${t === "noa" ? noa.length : cpf.length})`}
              {touched[t] ? " •" : ""}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-3">
          {isDefault(tab) ? (
            <p className="mb-3 rounded-md bg-amber-100 px-2.5 py-2 text-[12px] leading-snug text-amber-900">
              Nothing on file for {tab === "noa" ? "NOA" : "CPF"}. These are default values to start from - change
              anything, or tap Reset to default, to use them.
            </p>
          ) : null}
          {tab === "noa" ? (
            <div className="flex flex-col gap-3">
              {noa.map((row, i) => {
                const assessable = num(row.employmentIncome) + num(row.tradeIncome) + num(row.rentIncome) + num(row.interestIncome);
                return (
                  <div key={i} className="rounded-lg border border-amber-200 p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2">
                        <span className={label}>Year of assessment</span>
                        <input
                          className={`${input} !w-20`}
                          inputMode="numeric"
                          value={row.yearOfAssessment}
                          onChange={(e) => editNoa(i, "yearOfAssessment", e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          touch("noa");
                          setNoa((rows) => rows.filter((_, j) => j !== i));
                        }}
                        className="text-[12px] font-semibold text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["employmentIncome", "Employment"],
                          ["tradeIncome", "Trade"],
                          ["rentIncome", "Rent"],
                          ["interestIncome", "Interest"],
                        ] as const
                      ).map(([key, name]) => (
                        <label key={key}>
                          <span className={label}>{name} ($)</span>
                          <input className={input} inputMode="decimal" value={row[key]} onChange={(e) => editNoa(i, key, e.target.value)} />
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-[12px] text-neutral-600">
                      Assessable income <strong>{money(assessable)}</strong> · about {money(Math.round(num(row.employmentIncome) / 12))}/month employment
                    </p>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={ghost}
                  onClick={() => {
                    touch("noa");
                    const year = noa.length ? String(Math.min(...noa.map((r) => Number(r.yearOfAssessment) || 9999)) - 1) : String(new Date().getFullYear() - 1);
                    setNoa((rows) => [...rows, toNoaDraft({ yearOfAssessment: year, employmentIncome: 0, tradeIncome: 0, rentIncome: 0, interestIncome: 0 })]);
                  }}
                >
                  + Add year
                </button>
                <button
                  type="button"
                  className={ghost}
                  onClick={() => {
                    touch("noa");
                    setNoa(defaultNoaRows().map(toNoaDraft));
                  }}
                >
                  Reset to default
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <p className="mb-2 text-[12px] font-semibold text-amber-900">Fill the list</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2">
                    <span className={label}>Employer</span>
                    <input className={input} value={gen.employer} onChange={(e) => setGen({ ...gen, employer: e.target.value })} />
                  </label>
                  <label>
                    <span className={label}>Per month ($)</span>
                    <input className={input} inputMode="decimal" value={gen.amount} onChange={(e) => setGen({ ...gen, amount: e.target.value })} />
                  </label>
                  <label>
                    <span className={label}>How many months</span>
                    <input className={input} inputMode="numeric" value={gen.months} onChange={(e) => setGen({ ...gen, months: e.target.value })} />
                  </label>
                  <label className="col-span-2">
                    <span className={label}>Latest month</span>
                    <input className={input} type="month" value={gen.latestMonth} onChange={(e) => setGen({ ...gen, latestMonth: e.target.value })} />
                  </label>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className={ghost}
                    onClick={() => {
                      touch("cpf");
                      setCpf(
                        generateCpfRows({
                          latestMonth: gen.latestMonth,
                          months: Math.max(1, Math.min(24, Math.round(Number(gen.months) || 1))),
                          amount: Number(gen.amount),
                          employer: gen.employer.trim(),
                        }).map(toCpfDraft),
                      );
                    }}
                  >
                    Fill list
                  </button>
                  <button
                    type="button"
                    className={ghost}
                    onClick={() => {
                      touch("cpf");
                      setCpf(defaultCpfRows().map(toCpfDraft));
                    }}
                  >
                    Reset to default
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-[88px_1fr_28px] gap-2">
                  <span className={label}>Month</span>
                  <span className={label}>Amount ($) · employer</span>
                  <span />
                </div>
                {cpf.map((row, i) => (
                  <div key={i} className="grid grid-cols-[88px_1fr_28px] items-center gap-2">
                    <input className={input} value={row.month} onChange={(e) => editCpf(i, "month", e.target.value)} aria-label="Month" />
                    <div className="flex gap-1.5">
                      <input className={`${input} !w-24`} inputMode="decimal" value={row.amount} onChange={(e) => editCpf(i, "amount", e.target.value)} aria-label="Amount" />
                      <input className={input} value={row.employer} onChange={(e) => editCpf(i, "employer", e.target.value)} aria-label="Employer" />
                    </div>
                    <button
                      type="button"
                      aria-label="Remove month"
                      className="text-[16px] leading-none text-red-700"
                      onClick={() => {
                        touch("cpf");
                        setCpf((rows) => rows.filter((_, j) => j !== i));
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-amber-200 px-4 py-3">
          {error ? (
            <p role="alert" className="mb-2 text-[12px] font-semibold leading-snug text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-amber-800">
              {anyTouched ? `Changed: ${[touched.noa && "NOA", touched.cpf && "CPF"].filter(Boolean).join(" and ")}` : "No changes yet"}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={ghost}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!anyTouched || saving}
                className="rounded-md bg-amber-600 px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
