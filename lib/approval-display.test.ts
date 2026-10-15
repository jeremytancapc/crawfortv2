import { describe, expect, it } from "vitest";

import { approvalOfferDisplay } from "./approval-display";
import { initialLoanFormData, type LoanFormData } from "./loan-form";

const form = (over: Partial<LoanFormData> = {}): LoanFormData => ({
  ...initialLoanFormData,
  ...over,
});

describe("what the offer screens show", () => {
  it("offers Ascend's A-Card Limit, not a multiple of income", () => {
    // ADR-0001: Ascend owns the borrowable amount. Showing 6x income meant
    // offering a figure Ascend never approved - a real risk of promising an
    // applicant more than a licensed lender has agreed to lend.
    const { withdrawToday } = approvalOfferDisplay(
      form({ approvedLoanAmount: 8000, monthlyIncome: "4210" }),
      { aCardLimit: 8000, maximumLoanQuantum: 12000 },
    );

    expect(withdrawToday).toBe(8000);
  });

  it("never offers more than the MLCB ceiling", () => {
    // The regulatory cap across all licensed moneylenders. Ascend applies it
    // on their side; honouring it here as well costs nothing and means a
    // wrong A-Card Limit cannot become an unlawful offer.
    const { withdrawToday } = approvalOfferDisplay(
      form({ approvedLoanAmount: 20000 }),
      { aCardLimit: 20000, maximumLoanQuantum: 15000 },
    );

    expect(withdrawToday).toBe(15000);
  });

  it("offers nothing when Ascend named no limit", () => {
    // A decision without a limit is not an offer. Falling back to a multiple
    // of income would put our own number where Ascend's belongs.
    const { creditLimit, withdrawToday } = approvalOfferDisplay(
      form({ approvedLoanAmount: 0, monthlyIncome: "4210" }),
      { aCardLimit: null, maximumLoanQuantum: null },
    );

    expect(creditLimit).toBe(0);
    expect(withdrawToday).toBe(0);
  });

  it("falls back to the stored approved amount when no order is passed", () => {
    // Applicants from before Ascend was switched on still have an approved
    // amount on their assessment and nothing else. There is no order to
    // derive a reserve from, so the gauge shows none.
    const { creditLimit, withdrawToday } = approvalOfferDisplay(
      form({ approvedLoanAmount: 5000 }),
    );

    expect(creditLimit).toBe(5000);
    expect(withdrawToday).toBe(5000);
  });

  it("puts the offered amount on the data the screens render", () => {
    const { displayData } = approvalOfferDisplay(
      form({ approvedLoanAmount: 8000, amount: 20000 }),
      { aCardLimit: 8000, maximumLoanQuantum: null },
    );

    // The applicant asked for 20,000; the screen must show what was approved.
    expect(displayData.amount).toBe(8000);
  });

  describe("the gauge's reserve", () => {
    it("reserves double the approved amount when MLCB leaves room", () => {
      // Every real order seen so far: MLCB sits 5-50x the A-Card Limit, so
      // the reserve is the full double, uncapped by MLCB.
      const { creditLimit, withdrawToday } = approvalOfferDisplay(
        form({ approvedLoanAmount: 3500 }),
        { aCardLimit: 3500, maximumLoanQuantum: 171500 },
      );

      expect(withdrawToday).toBe(3500);
      expect(creditLimit).toBe(7000);
    });

    it("shrinks the reserve to MLCB when MLCB is tighter than double", () => {
      // MLCB allows more than what's approved, but not the full double -
      // the gauge's locked zone must stop at MLCB, not run past it.
      const { creditLimit, withdrawToday } = approvalOfferDisplay(
        form({ approvedLoanAmount: 8000 }),
        { aCardLimit: 8000, maximumLoanQuantum: 12000 },
      );

      expect(withdrawToday).toBe(8000);
      expect(creditLimit).toBe(12000);
    });

    it("shows no reserve when MLCB has already capped the approved amount", () => {
      // MLCB is at or below the A-Card Limit itself: there is no room to
      // grow at all, so creditLimit must equal withdrawToday and the gauge
      // must render no locked zone - never one with nothing behind it.
      const { creditLimit, withdrawToday } = approvalOfferDisplay(
        form({ approvedLoanAmount: 20000 }),
        { aCardLimit: 20000, maximumLoanQuantum: 15000 },
      );

      expect(withdrawToday).toBe(15000);
      expect(creditLimit).toBe(15000);
    });

    it("uses double the A-Card Limit when MLCB reports no ceiling", () => {
      const { creditLimit, withdrawToday } = approvalOfferDisplay(
        form({ approvedLoanAmount: 8000 }),
        { aCardLimit: 8000, maximumLoanQuantum: null },
      );

      expect(withdrawToday).toBe(8000);
      expect(creditLimit).toBe(16000);
    });
  });
});
