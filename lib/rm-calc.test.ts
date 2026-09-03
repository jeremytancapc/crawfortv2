import { describe, it, expect } from "vitest";
import {
  GRADE_CONFIG,
  MONTHLY_RATE,
  MIN_MONTHLY_RATE,
  MAX_MONTHLY_RATE,
  DEFAULT_FEE_PCT,
  MAX_FEE_PCT,
  MIN_LOAN_AMOUNT,
  AMOUNT_STEP,
  buildSchedule,
  feePctForTargetEir,
  monthlyRateForTargetEir,
  solveQuickSelect,
  enforceEirFloor,
  amountForTargetInstalment,
  type Grade,
} from "./rm-calc";

const DISBURSED = new Date(2026, 8, 3);
const AMOUNT = 5000;
const MAX_AMOUNT = 80_000;

function displayedEir(eir: number): string {
  return eir.toFixed(1);
}

function eirClose(eir: number, target: number) {
  expect(
    displayedEir(eir) === displayedEir(target) || Math.abs(eir - target) < 0.15,
  ).toBe(true);
}

describe("feePctForTargetEir", () => {
  it("recovers ~10% fee at grade max tenure (monthly)", () => {
    const grade = GRADE_CONFIG.A;
    const solved = feePctForTargetEir(
      AMOUNT,
      grade.maxTenureMonths,
      "monthly",
      DISBURSED,
      grade.refEirPct,
    );
    expect(solved.reachable).toBe(true);
    expect(solved.feePct).toBeGreaterThan(9.9);
    expect(solved.feePct).toBeLessThanOrEqual(MAX_FEE_PCT);
    eirClose(solved.eir, grade.refEirPct);
  });

  it("lowers the fee when tenure is shortened so EIR still matches", () => {
    const grade = GRADE_CONFIG.S;
    const atMax = feePctForTargetEir(
      AMOUNT,
      grade.maxTenureMonths,
      "monthly",
      DISBURSED,
      grade.refEirPct,
    );
    const atShort = feePctForTargetEir(AMOUNT, 1, "monthly", DISBURSED, grade.refEirPct);
    expect(atShort.reachable).toBe(true);
    expect(atShort.feePct).toBeLessThan(atMax.feePct);
    eirClose(atShort.eir, grade.refEirPct);
  });
});

describe("monthlyRateForTargetEir", () => {
  it("reduces the monthly rate below 3.92% at mid tenure with a 10% fee", () => {
    const grade = GRADE_CONFIG.A;
    const solved = monthlyRateForTargetEir(
      AMOUNT,
      6,
      "monthly",
      DISBURSED,
      grade.refEirPct,
      MAX_FEE_PCT,
    );
    expect(solved.reachable).toBe(true);
    expect(solved.monthlyRate).toBeLessThan(MONTHLY_RATE);
    expect(solved.monthlyRate).toBeGreaterThanOrEqual(MIN_MONTHLY_RATE);
    eirClose(solved.eir, grade.refEirPct);
  });

  it("is unreachable at 1 month with a 10% fee (even the 1% rate floor overshoots ref EIR)", () => {
    const grade = GRADE_CONFIG.A;
    const solved = monthlyRateForTargetEir(
      AMOUNT,
      1,
      "monthly",
      DISBURSED,
      grade.refEirPct,
      MAX_FEE_PCT,
    );
    expect(solved.reachable).toBe(false);
  });
});

describe("solveQuickSelect", () => {
  const grades: Grade[] = ["S", "A", "B", "C", "D"];

  it.each(grades)("longest tenure is standard pricing at grade %s max term", (gradeId) => {
    const grade = GRADE_CONFIG[gradeId];
    const result = solveQuickSelect(
      "longest_tenure",
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result.tenureMonths).toBe(grade.maxTenureMonths);
    expect(result.feePct).toBe(DEFAULT_FEE_PCT);
    expect(result.monthlyRate).toBe(MONTHLY_RATE);
  });

  it("lowest interest locks the 10% fee and cuts the monthly rate", () => {
    const grade = GRADE_CONFIG.A;
    const result = solveQuickSelect(
      "lowest_interest",
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result.feePct).toBe(MAX_FEE_PCT);
    expect(result.monthlyRate).toBeLessThan(MONTHLY_RATE);
    expect(result.monthlyRate).toBeGreaterThanOrEqual(MIN_MONTHLY_RATE);
    expect(result.tenureMonths).toBeLessThan(grade.maxTenureMonths);
    expect(result.tenureMonths).toBeGreaterThan(1);
    eirClose(result.eir, grade.refEirPct);

    const schedule = buildSchedule(
      AMOUNT,
      result.tenureMonths,
      "monthly",
      DISBURSED,
      result.monthlyRate,
      result.feePct,
    );
    const longest = solveQuickSelect(
      "longest_tenure",
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    const longSchedule = buildSchedule(
      AMOUNT,
      longest.tenureMonths,
      "monthly",
      DISBURSED,
      longest.monthlyRate,
      longest.feePct,
    );
    expect(schedule.totalInterest).toBeLessThan(longSchedule.totalInterest);
  });

  it("lowest fee locks the 3.92% rate and discounts the processing fee", () => {
    const grade = GRADE_CONFIG.A;
    const lowestFee = solveQuickSelect(
      "lowest_fee",
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    const lowestInterest = solveQuickSelect(
      "lowest_interest",
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(lowestFee.monthlyRate).toBe(MONTHLY_RATE);
    expect(lowestFee.feePct).toBeLessThan(MAX_FEE_PCT);
    expect(lowestFee.feePct).toBeLessThan(lowestInterest.feePct);
    expect(lowestFee.monthlyRate).toBeGreaterThan(lowestInterest.monthlyRate);
    eirClose(lowestFee.eir, grade.refEirPct);
  });

  it("lowest interest and lowest fee are different offers", () => {
    const grade = GRADE_CONFIG.A;
    const interest = solveQuickSelect(
      "lowest_interest",
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    const fee = solveQuickSelect(
      "lowest_fee",
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(interest.feePct).not.toBe(fee.feePct);
    expect(interest.monthlyRate).not.toBe(fee.monthlyRate);
    expect(interest.tenureMonths).not.toBe(fee.tenureMonths);
  });

  it("shortens biweekly longest tenure when max + standard pricing is below ref EIR", () => {
    const grade = GRADE_CONFIG.S;
    const result = solveQuickSelect(
      "longest_tenure",
      AMOUNT,
      "biweekly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result.feePct).toBe(MAX_FEE_PCT);
    expect(result.monthlyRate).toBe(MONTHLY_RATE);
    expect(result.tenureMonths).toBeLessThanOrEqual(grade.maxTenureMonths);
  });

  it("locks payday tenure at 1 month", () => {
    const grade = GRADE_CONFIG.B;
    const result = solveQuickSelect(
      "longest_tenure",
      AMOUNT,
      "payday",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result.tenureMonths).toBe(1);
  });

  it.each(grades)(
    "never offers below the 1%% interest-rate floor on any of the 3 plans for grade %s",
    (gradeId) => {
      const grade = GRADE_CONFIG[gradeId];
      const goals: Array<"longest_tenure" | "lowest_interest" | "lowest_fee"> = [
        "longest_tenure",
        "lowest_interest",
        "lowest_fee",
      ];
      for (const goal of goals) {
        const result = solveQuickSelect(
          goal,
          AMOUNT,
          "monthly",
          DISBURSED,
          grade.maxTenureMonths,
          grade.refEirPct,
        );
        expect(result.monthlyRate).toBeGreaterThanOrEqual(MIN_MONTHLY_RATE);
      }
    },
  );
});

describe("enforceEirFloor", () => {
  function liveEirOf(state: {
    tenureMonths: number;
    feePct: number;
    monthlyRate: number;
  }) {
    return buildSchedule(
      AMOUNT,
      state.tenureMonths,
      "monthly",
      DISBURSED,
      state.monthlyRate,
      state.feePct,
    ).eir;
  }

  it("leaves an already-compliant combination untouched", () => {
    const grade = GRADE_CONFIG.S;
    const state = { tenureMonths: 6, feePct: DEFAULT_FEE_PCT, monthlyRate: MONTHLY_RATE };
    const result = enforceEirFloor(
      "tenure",
      state,
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result).toEqual(state);
  });

  it("reproduces and fixes the reported bug: preset leftovers + a longer tenure drop below the floor", () => {
    // Grade S "Lowest interest paid" leaves fee=10%, rate=0% (tenure=3). If the
    // staff then drags tenure out to 12 months without re-solving, live EIR
    // collapses to ~19.9% — the exact scenario reported against the ref of 65.5%.
    const grade = GRADE_CONFIG.S;
    const brokenState = { tenureMonths: 12, feePct: DEFAULT_FEE_PCT, monthlyRate: 0 };
    expect(liveEirOf(brokenState)).toBeLessThan(grade.refEirPct);

    const result = enforceEirFloor(
      "tenure",
      brokenState,
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result.tenureMonths).toBe(12);
    expect(result.feePct).toBe(DEFAULT_FEE_PCT);
    expect(result.monthlyRate).toBeGreaterThan(0);
    expect(liveEirOf(result)).toBeGreaterThanOrEqual(grade.refEirPct - 0.15);
  });

  it("raises fee (not the just-edited rate) when a dropped rate breaches the floor", () => {
    const grade = GRADE_CONFIG.A;
    // monthlyRate: 0 simulates a stale value from before the 1% rate floor
    // existed — enforceEirFloor snaps it up to MIN_MONTHLY_RATE even though
    // "rate" is the lever the staff just touched; 1% is an absolute floor,
    // not just a matter of respecting field ownership. Fee then compensates
    // (and, since 2% fee + 1% rate can't clear the floor at 6 months even
    // with fee maxed, tenure shrinks too).
    const state = { tenureMonths: 6, feePct: 2, monthlyRate: 0 };
    expect(liveEirOf(state)).toBeLessThan(grade.refEirPct);

    const result = enforceEirFloor(
      "rate",
      state,
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result.monthlyRate).toBe(MIN_MONTHLY_RATE); // snapped up to 1%, never 0...
    expect(result.feePct).toBeGreaterThan(2); // ...and fee still compensates on top
    expect(liveEirOf(result)).toBeGreaterThanOrEqual(grade.refEirPct - 0.15);
  });

  it("raises rate (not the just-edited fee) when a dropped fee breaches the floor", () => {
    const grade = GRADE_CONFIG.A;
    // fee=6% at 6 months is low enough to breach the floor, but a rate within
    // [0, 3.92%] can still fully compensate — no escalation needed here.
    const state = { tenureMonths: 6, feePct: 6, monthlyRate: 0.01 };
    expect(liveEirOf(state)).toBeLessThan(grade.refEirPct);

    const result = enforceEirFloor(
      "fee",
      state,
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result.feePct).toBe(6);
    expect(result.monthlyRate).toBeGreaterThan(0.01);
    expect(liveEirOf(result)).toBeGreaterThanOrEqual(grade.refEirPct - 0.15);
  });

  it("shrinks tenure as a last resort once both pricing levers are pinned", () => {
    const grade = GRADE_CONFIG.A;
    // Rate is the just-edited (fixed) lever — but 0 gets snapped to the 1%
    // floor first; fee is already at its ceiling, so tenure has to shrink.
    const state = { tenureMonths: 12, feePct: MAX_FEE_PCT, monthlyRate: 0 };
    const result = enforceEirFloor(
      "rate",
      state,
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(result.monthlyRate).toBe(MIN_MONTHLY_RATE);
    expect(result.feePct).toBe(MAX_FEE_PCT);
    expect(result.tenureMonths).toBeLessThan(12);
    expect(liveEirOf(result)).toBeGreaterThanOrEqual(grade.refEirPct - 0.15);
  });

  it("overrides even the just-edited lever when the floor is otherwise unreachable", () => {
    // A 1% fee typed directly is too low to hit Grade S's 65.5% floor at any
    // tenure, even with the rate maxed out — the floor invariant wins over
    // strictly respecting the edited field, as a last resort.
    const grade = GRADE_CONFIG.S;
    const state = { tenureMonths: 12, feePct: 1, monthlyRate: MAX_MONTHLY_RATE };
    for (let t = 1; t <= grade.maxTenureMonths; t++) {
      expect(liveEirOf({ ...state, tenureMonths: t })).toBeLessThan(grade.refEirPct);
    }

    const result = enforceEirFloor(
      "fee",
      state,
      AMOUNT,
      "monthly",
      DISBURSED,
      grade.maxTenureMonths,
      grade.refEirPct,
    );
    expect(liveEirOf(result)).toBeGreaterThanOrEqual(grade.refEirPct - 0.15);
  });

  it("never returns a combination below the floor across a grid of broken inputs", () => {
    const grades: Grade[] = ["S", "A", "B", "C", "D"];
    const levers: Array<"tenure" | "fee" | "rate"> = ["tenure", "fee", "rate"];
    const feeSamples = [0, 1, 5, MAX_FEE_PCT];
    const rateSamples = [0, 0.01, 0.02, MAX_MONTHLY_RATE];

    for (const gradeId of grades) {
      const grade = GRADE_CONFIG[gradeId];
      for (const changed of levers) {
        for (const feePct of feeSamples) {
          for (const monthlyRate of rateSamples) {
            for (const tenureMonths of [1, Math.ceil(grade.maxTenureMonths / 2), grade.maxTenureMonths]) {
              const result = enforceEirFloor(
                changed,
                { tenureMonths, feePct, monthlyRate },
                AMOUNT,
                "monthly",
                DISBURSED,
                grade.maxTenureMonths,
                grade.refEirPct,
              );
              const eir = liveEirOf(result);
              expect(eir).toBeGreaterThanOrEqual(grade.refEirPct - 0.15);
              expect(result.monthlyRate).toBeGreaterThanOrEqual(MIN_MONTHLY_RATE);
            }
          }
        }
      }
    }
  });
});

describe("amountForTargetInstalment", () => {
  it("shrinks the loan amount so the instalment fits a fixed monthly budget", () => {
    const result = amountForTargetInstalment(
      500,
      6,
      "monthly",
      DISBURSED,
      MONTHLY_RATE,
      DEFAULT_FEE_PCT,
      MIN_LOAN_AMOUNT,
      MAX_AMOUNT,
    );
    expect(result.reachable).toBe(true);
    expect(result.amount).toBeLessThan(MAX_AMOUNT);
    expect(result.amount % AMOUNT_STEP).toBe(0);
    expect(result.instalment).toBeLessThanOrEqual(500);

    // The actual schedule at that amount must match — and one more step up
    // must blow the budget, otherwise we under-shot the customer's room.
    const atAmount = buildSchedule(result.amount, 6, "monthly", DISBURSED, MONTHLY_RATE, DEFAULT_FEE_PCT);
    expect(atAmount.rows[0].payment).toBe(result.instalment);
    const oneStepUp = buildSchedule(result.amount + AMOUNT_STEP, 6, "monthly", DISBURSED, MONTHLY_RATE, DEFAULT_FEE_PCT);
    expect(oneStepUp.rows[0].payment).toBeGreaterThan(500);
  });

  it("reports unreachable when even the minimum loan amount exceeds the budget", () => {
    const result = amountForTargetInstalment(
      10,
      6,
      "monthly",
      DISBURSED,
      MONTHLY_RATE,
      DEFAULT_FEE_PCT,
      MIN_LOAN_AMOUNT,
      MAX_AMOUNT,
    );
    expect(result.reachable).toBe(false);
    expect(result.amount).toBe(MIN_LOAN_AMOUNT);
    expect(result.instalment).toBeGreaterThan(10);
  });

  it("caps at the max approved amount when the budget is generous enough", () => {
    const result = amountForTargetInstalment(
      100_000,
      6,
      "monthly",
      DISBURSED,
      MONTHLY_RATE,
      DEFAULT_FEE_PCT,
      MIN_LOAN_AMOUNT,
      MAX_AMOUNT,
    );
    expect(result.reachable).toBe(true);
    expect(result.amount).toBe(MAX_AMOUNT);
  });

  it("works for biweekly frequency too", () => {
    const result = amountForTargetInstalment(
      200,
      6,
      "biweekly",
      DISBURSED,
      MONTHLY_RATE,
      DEFAULT_FEE_PCT,
      MIN_LOAN_AMOUNT,
      MAX_AMOUNT,
    );
    expect(result.reachable).toBe(true);
    expect(result.instalment).toBeLessThanOrEqual(200);
    const schedule = buildSchedule(result.amount, 6, "biweekly", DISBURSED, MONTHLY_RATE, DEFAULT_FEE_PCT);
    expect(schedule.rows[0].payment).toBe(result.instalment);
  });

  it("never produces an instalment above the target across a grid of tenures and fees", () => {
    for (const tenureMonths of [1, 3, 6, 12, 15]) {
      for (const feePct of [0, 1.75, 5, 10]) {
        for (const target of [50, 200, 500, 2000]) {
          const result = amountForTargetInstalment(
            target,
            tenureMonths,
            "monthly",
            DISBURSED,
            MONTHLY_RATE,
            feePct,
            MIN_LOAN_AMOUNT,
            MAX_AMOUNT,
          );
          if (result.reachable) {
            expect(result.instalment).toBeLessThanOrEqual(target + 1e-6);
          }
        }
      }
    }
  });
});
