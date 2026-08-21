import {
  Buildings,
  ClockCountdown,
  Warning,
  type Icon,
} from "@phosphor-icons/react";

// All customer-facing copy for the acceptance page, kept out of the components
// so the contract wording can be reviewed in one place.

export const DRAWDOWN_NOTICE =
  "Final drawdown of funds must be completed face to face at our office, as required by anti-money laundering (AML) and know-your-customer (KYC) regulations. If the loan is not drawn down within 3 business days, this loan agreement will be void and a re-application will be required. Every re-application may affect your subsequent approval.";

export interface KeyTermAck {
  key: string;
  Icon: Icon;
  /** Written in the first person: the customer is making this statement, not reading one. */
  title: string;
  terms: readonly string[];
}

// The three facts that most often catch customers out. They're pulled out of
// the fine print and confirmed one card at a time (see `terms-deck.tsx`) so
// nobody can tick a single blanket "I agree" without seeing them. The terms
// under each are kept short and literal so they still hold up as contract
// wording.
export const KEY_TERM_ACKS = [
  {
    key: "collectInPerson",
    Icon: Buildings,
    title: "I need to collect my funds in person",
    terms: [
      "Final drawdown is completed face to face at our office.",
      "This is required under anti-money laundering (AML) and know-your-customer (KYC) regulations.",
    ],
  },
  {
    key: "drawdownWindow",
    Icon: ClockCountdown,
    title: "I need to draw down within 3 business days",
    terms: [
      "After 3 business days, this agreement is void and a new application is required.",
      "Every re-application may affect your next approval.",
    ],
  },
  {
    key: "lateCharges",
    Icon: Warning,
    title: "I will make payments on time",
    terms: [
      "Late interest of up to 4% per month on the overdue amount.",
      "A late fee of $60 for every month a payment is late.",
    ],
  },
] as const satisfies readonly KeyTermAck[];

export const DISBURSEMENT_NOTICE_ITEMS = [
  "Funds are disbursed via PayNow on the spot at your appointment.",
  "Your PayNow must be linked to your NRIC - we'll pay out to your NRIC-linked PayNow, not your mobile number.",
  "Cash disbursement is strongly discouraged.",
];

/** First-person statement used as the schedule card's header. */
export const SCHEDULE_ACK_STATEMENT =
  "I agree to repay as per this payment schedule.";

/** Affirmative statement shown above the confirm button on the disbursement card. */
export const DISBURSEMENT_ACK_STATEMENT =
  "I acknowledge that my PayNow is linked to my NRIC number so the funds can be disbursed to me.";

export const SCHEDULE_CAVEAT =
  "The actual repayment dates may change depending on your actual loan disbursement date and plan accepted.";

export const TC_ITEMS = [
  "This loan is granted by CF Money Pte Ltd, a licensed moneylender (Licence No. 86/2026) under the Moneylenders Act (Cap. 188).",
  "Repayment is in equal monthly instalments. Interest is charged at your agreed monthly rate on a reducing-balance basis.",
  "Late payments incur late interest (up to 4%/month) and a late fee of $60 per month. Repayments are applied to late charges first, then interest, then principal.",
  "If you default, the full outstanding balance becomes immediately payable and all recovery costs (including legal costs) are borne by you.",
  "No partial early redemption is allowed. Full early settlement may incur one month's interest at the moneylender's discretion.",
  "You authorise CF Money Pte Ltd to conduct credit checks and disclose your loan information to the Moneylenders Credit Bureau, Credit Bureau (Singapore), and related regulatory agencies.",
  "Additional loan amount and loan tenure requests in previous screen will be discussed with you physically during the loan assessment appointment at our office.",
];

export const TC_CLOSING =
  "The full Note of Contract will be explained and signed at your appointment. You will receive a copy, together with your repayment schedule, before funds are disbursed.";

// Everything the customer isn't asked to confirm card by card, kept verbatim
// (the drawdown notice included) so the complete terms remain on the page.
export const FINE_PRINT_ITEMS = [DRAWDOWN_NOTICE, ...TC_ITEMS];
