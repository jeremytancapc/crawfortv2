import { describe, expect, it } from "vitest";

import { decide, type IncomeDocument, type Reported } from "./income-extraction";

/**
 * Metamorphic tests: take a report, change something that should NOT matter,
 * and check the decision does not change. No model, no cost, every push.
 *
 * They exist because the failures that got through were all of this kind - an
 * employee number beside a name, uneven months, a month not yet over - and a
 * unit test only ever checks the one input its author thought of. These check
 * a whole family of inputs against each other.
 */

const TODAY = new Date("2026-10-09T00:00:00Z");
const APPLICANT = { name: "TAN CAKEN" };

const docs = (n: number): IncomeDocument[] =>
  Array.from({ length: n }, (_, i) => ({ fileName: `doc-${i + 1}.pdf`, mediaType: "application/pdf", bytes: Buffer.alloc(1) }));

const monthRange = (m: number) => ({ start: `2026-${String(m).padStart(2, "0")}-01`, end: `2026-${String(m).padStart(2, "0")}-${[0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]}` });

function payslips(amounts: number[] = [5200, 5100, 5000], months = [9, 8, 7]): Reported {
  return {
    readable: true,
    note: "",
    documents: months.map((_, i) => ({ index: i + 1, kind: "payslip", holderName: "TAN CAKEN", issuer: "KIMSENG FOOD" })),
    periods: months.map((m, i) => ({ ...monthRange(m), gross: amounts[i], net: amounts[i] * 0.8, employer: "KIMSENG FOOD", document: i + 1 })),
    statements: [],
    credits: [],
  };
}

type Credit = Reported["credits"][number];
function bank(creditsByMonth: Record<number, Credit[]>): Reported {
  const months = Object.keys(creditsByMonth).map(Number);
  return {
    readable: true,
    note: "",
    documents: [{ index: 1, kind: "bank_statement", holderName: "TAN CAKEN", issuer: "DBS" }],
    periods: [],
    statements: months.map(monthRange),
    credits: months.flatMap((m) => creditsByMonth[m]),
  };
}
const c = (date: string, amount: number, category: string, payer = "X"): Credit => ({ date, amount, payer, category: category as Credit["category"] });

const EVEN_BANK = {
  7: [c("2026-07-25", 3000, "salary"), c("2026-07-03", 200, "transfer_from_others")],
  8: [c("2026-08-25", 3000, "salary"), c("2026-08-03", 200, "transfer_from_others")],
  9: [c("2026-09-25", 3000, "salary"), c("2026-09-03", 200, "transfer_from_others")],
};

const decideOf = (reported: Reported, n = reported.documents.length, extra: Record<string, unknown> = {}) =>
  decide(docs(n), { reported }, { today: TODAY, applicant: APPLICANT, employmentType: "EMPLOYED", ...extra });

const figures = (outcome: ReturnType<typeof decide>) =>
  outcome.kind === "usable" ? { kind: outcome.kind, m1: outcome.m1, m2: outcome.m2, m3: outcome.m3, type: outcome.incomeType } : { kind: outcome.kind };

describe("a number printed beside the name changes nothing", () => {
  const base = decideOf(payslips());

  it.each(["TAN CAKEN (100257)", "100257 TAN CAKEN", "TAN CAKEN S****083H", "TAN CAKEN (S****083H)"])("%s", (name) => {
    const r = payslips();
    r.documents = r.documents.map((d) => ({ ...d, holderName: name }));

    expect(decideOf(r)).toEqual(base);
  });

  it("but a different person's name with a number is still refused", () => {
    const r = payslips();
    r.documents = r.documents.map((d) => ({ ...d, holderName: "LIM WEI JIE (100257)" }));

    expect(decideOf(r).kind).toBe("needs_review");
  });
});

describe("how the name is written changes nothing", () => {
  const base = decideOf(payslips());

  it.each(["tan caken", "  TAN   CAKEN ", "CAKEN TAN", "Mr Tan Caken", "TAN, CAKEN"])("%s", (name) => {
    const r = payslips();
    r.documents = r.documents.map((d) => ({ ...d, holderName: name }));

    expect(decideOf(r)).toEqual(base);
  });
});

describe("the order the documents arrive in changes nothing", () => {
  it("payslips newest first, oldest first, or shuffled", () => {
    const base = figures(decideOf(payslips([5200, 5100, 5000], [9, 8, 7])));

    for (const order of [[0, 1, 2], [2, 1, 0], [1, 2, 0], [2, 0, 1]]) {
      const original = payslips([5200, 5100, 5000], [9, 8, 7]);
      // Renumber: the document listed first becomes document 1, and each
      // period says which document it came from.
      const documents = order.map((from, i) => ({ ...original.documents[from], index: i + 1 }));
      const periods = order.map((from, i) => ({ ...original.periods[from], document: i + 1 }));

      expect(figures(decideOf({ ...original, documents, periods }))).toEqual(base);
    }
  });

  it("bank credits in any order", () => {
    const original = bank(EVEN_BANK);
    const shuffled = { ...original, credits: [...original.credits].reverse() };

    expect(figures(decideOf(shuffled))).toEqual(figures(decideOf(original)));
  });
});

describe("amounts scale", () => {
  it("doubling every payslip doubles every figure", () => {
    const one = decideOf(payslips([2600, 2550, 2500]));
    const two = decideOf(payslips([5200, 5100, 5000]));

    expect(one.kind === "usable" && two.kind === "usable" && two.m1 === 2 * one.m1 && two.m2 === 2 * one.m2 && two.m3 === 2 * one.m3).toBe(true);
  });

  it("doubling every bank credit doubles every figure", () => {
    const doubled = Object.fromEntries(
      Object.entries(EVEN_BANK).map(([m, list]) => [m, list.map((x) => ({ ...x, amount: x.amount * 2 }))]),
    ) as Record<number, Credit[]>;
    const one = decideOf(bank(EVEN_BANK));
    const two = decideOf(bank(doubled));

    expect(one.kind === "usable" && two.kind === "usable" && two.m1 === 2 * one.m1).toBe(true);
  });
});

describe("credits that are not income change nothing for an employed applicant", () => {
  const base = figures(decideOf(bank(EVEN_BANK)));

  it.each([
    ["interest", 0.31],
    ["refund_or_reversal", 36.9],
    ["own_account_transfer", 1500],
    ["loan_disbursement", 5000],
  ])("an extra %s credit in every month", (category, amount) => {
    const withExtra = Object.fromEntries(
      Object.entries(EVEN_BANK).map(([m, list]) => [m, [...list, c(`2026-0${m}-12`, amount, category)]]),
    ) as Record<number, Credit[]>;

    expect(figures(decideOf(bank(withExtra)))).toEqual(base);
  });

  it("the same credit reported twice is counted once", () => {
    const doubled = { ...bank(EVEN_BANK) };
    doubled.credits = [...doubled.credits, doubled.credits[0]];

    expect(figures(decideOf(doubled))).toEqual(base);
  });
});

describe("uneven months are not a reason to refuse a bank statement", () => {
  it.each([2, 7, 20])("the largest month %sx the smallest", (ratio) => {
    const lumpy = bank({
      7: [c("2026-07-10", 400, "transfer_from_others")],
      8: [c("2026-08-10", 400 * ratio, "transfer_from_others")],
      9: [c("2026-09-10", 400 * Math.ceil(ratio / 2), "transfer_from_others")],
    });

    expect(decideOf(lumpy).kind).toBe("usable");
  });

  it("though the same spread on payslips is still held for review as a likely year-to-date misread", () => {
    expect(decideOf(payslips([4000, 4000, 40000])).kind).toBe("needs_review");
  });
});

describe("a statement printed past today", () => {
  const credits = {
    8: [c("2026-08-10", 3000, "transfer_from_others")],
    9: [c("2026-09-10", 2900, "transfer_from_others")],
    10: [c("2026-10-05", 430, "transfer_from_others")],
  };

  it("gives the same decision whether it is printed to the end of the month or to today", () => {
    const toMonthEnd = bank(credits);
    const toToday = { ...bank(credits), statements: [...bank(credits).statements.slice(0, 2), { start: "2026-10-01", end: "2026-10-09" }] };

    expect(figures(decideOf(toMonthEnd))).toEqual(figures(decideOf(toToday)));
  });

  it("never counts the unfinished month, whatever it holds", () => {
    const big = bank({ ...credits, 10: [c("2026-10-05", 90000, "transfer_from_others")] });
    const outcome = decideOf(big);

    expect(outcome.kind === "usable" && outcome.months.map((m) => m.month)).toEqual(["2026-09", "2026-08"]);
  });
});

describe("the day of the month does not matter, the month does", () => {
  it("a September payslip is taken on the 2nd or the 28th of October", () => {
    const early = figures(decideOf(payslips([5200], [9]), 1, { today: new Date("2026-10-02T00:00:00Z") }));
    const late = figures(decideOf(payslips([5200], [9]), 1, { today: new Date("2026-10-28T00:00:00Z") }));

    expect(early).toEqual(late);
  });

  it("and stops being enough once it is more than two months old", () => {
    const november = decideOf(payslips([5200], [9]), 1, { today: new Date("2026-11-20T00:00:00Z") });
    const december = decideOf(payslips([5200], [9]), 1, { today: new Date("2026-12-02T00:00:00Z") });

    expect(november.kind).toBe("usable");
    expect(december.kind).toBe("needs_review");
  });
});

describe("a document outside the months wanted does not change the figures", () => {
  it("an extra old payslip leaves the three recent figures as they were", () => {
    const base = figures(decideOf(payslips([5200, 5100, 5000], [9, 8, 7])));
    const extra = payslips([5200, 5100, 5000, 9999], [9, 8, 7, 3]);

    expect(figures(decideOf(extra))).toEqual(base);
  });
});
