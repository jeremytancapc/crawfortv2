"use client";

import { formatCurrency, formatDate, type LoanSchedule } from "@/lib/rm-calc";

interface SchedulePanelProps {
  schedule: LoanSchedule;
  loanAmount: number;
  feePct: number;
  monthlyRatePct: number;
}

/** Summary strip + full amortisation table for the currently selected terms. */
export function SchedulePanel({ schedule, loanAmount, feePct, monthlyRatePct }: SchedulePanelProps) {
  const summary: { label: string; value: string }[] = [
    { label: "Loan amount", value: formatCurrency(loanAmount) },
    { label: `Processing fee (${parseFloat(feePct.toFixed(2))}%)`, value: formatCurrency(schedule.feeAmount) },
    { label: "Net disbursed", value: formatCurrency(schedule.netDisbursed) },
    { label: "Interest rate", value: `${parseFloat(monthlyRatePct.toFixed(2))}% / month` },
    { label: "Total interest", value: formatCurrency(schedule.totalInterest) },
    { label: "Total repayment", value: formatCurrency(schedule.totalPayment) },
  ];

  return (
    <section aria-label="Repayment schedule" className="rm-offer-enter flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-white px-5 py-4 sm:grid-cols-3">
        {summary.map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="truncate text-[11.5px] font-medium leading-none text-[var(--rm-ink-3)]">{label}</dt>
            <dd className="mt-1.5 truncate text-[15px] font-bold leading-none tabular-nums text-[var(--rm-ink)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="overflow-hidden rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--rm-ink-3)]">
                <th className="w-10 px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Due date</th>
                <th className="px-4 py-3 text-right font-semibold">Payment</th>
                <th className="px-4 py-3 text-right font-semibold">Principal</th>
                <th className="px-4 py-3 text-right font-semibold">Interest</th>
                <th className="px-4 py-3 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {schedule.rows.map((row) => (
                <tr key={row.period} className="border-t border-[var(--rm-line)]">
                  <td className="px-4 py-2.5 font-medium text-[var(--rm-ink-3)]">{row.period}</td>
                  <td className="px-4 py-2.5 font-medium text-[var(--rm-ink)]">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-[var(--rm-ink)]">
                    {formatCurrency(row.payment)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[var(--rm-ink-2)]">{formatCurrency(row.principal)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--rm-ink-2)]">{formatCurrency(row.interest)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--rm-ink-2)]">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
