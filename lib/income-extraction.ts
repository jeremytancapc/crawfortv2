/**
 * Reading an applicant's income off the payslips they uploaded.
 *
 * The figures this produces become m1, m2 and m3 on /openApi/income/credit,
 * which is what Ascend re-scores a PENDING order against. A misread payslip
 * is therefore a wrong credit decision about a real person, so the rule
 * throughout is: when the documents do not clearly say, do not guess - hand
 * it to a human instead.
 *
 * Verified against the live API on 2026-09-17 with generated Singapore
 * payslips carrying three traps at once - a year-to-date column beside the
 * monthly figure, a net-pay line below it, and a payment date a month after
 * the pay period. Gross for the right month came back on all three, and the
 * two refusal paths held: a bank letter returned unreadable with a reason an
 * applicant could act on, and two payslips were refused rather than padded
 * to three.
 */

export type ExtractedMonth = {
  /** YYYY-MM, the month the pay is FOR, not the month it was paid. */
  month: string;
  amount: number;
  employer: string | null;
};

export type ExtractionReview =
  | {
      kind: "usable";
      /** The three months the income is judged on, most recent first - Ascend's shape. */
      m1: number;
      m2: number;
      m3: number;
      months: ExtractedMonth[];
    }
  | {
      kind: "needs_review";
      reason: string;
      months: ExtractedMonth[];
    };

/**
 * A month more than six times the smallest is almost never a pay rise. It is
 * the year-to-date column read as one month's pay - the most common way a
 * payslip is misread, by a person or a model.
 */
const YTD_RATIO = 6;

/** Months apart, e.g. 2026-08 and 2026-06 are 2. */
function monthsBetween(later: string, earlier: string): number {
  const [ly, lm] = later.split("-").map(Number);
  const [ey, em] = earlier.split("-").map(Number);
  return (ly - ey) * 12 + (lm - em);
}

export function reviewExtraction(months: ExtractedMonth[]): ExtractionReview {
  const ordered = [...months].sort((a, b) => b.month.localeCompare(a.month));

  if (ordered.length < 3) {
    return {
      kind: "needs_review",
      reason: `Only ${ordered.length} month(s) could be read; Ascend needs 3 months.`,
      months: ordered,
    };
  }

  const three = ordered.slice(0, 3);
  const amounts = three.map((m) => m.amount);

  if (amounts.some((a) => !Number.isFinite(a) || a <= 0)) {
    return {
      kind: "needs_review",
      reason: "One of the months has no usable amount.",
      months: three,
    };
  }

  const highest = Math.max(...amounts);
  const lowest = Math.min(...amounts);
  if (highest / lowest > YTD_RATIO) {
    return {
      kind: "needs_review",
      reason:
        `One month (${highest.toLocaleString("en-SG")}) is far larger than the others ` +
        `(lowest ${lowest.toLocaleString("en-SG")}) - this is usually a year-to-date total read as one month.`,
      months: three,
    };
  }

  if (monthsBetween(three[0].month, three[1].month) !== 1 ||
      monthsBetween(three[1].month, three[2].month) !== 1) {
    return {
      kind: "needs_review",
      reason: `The months read (${three.map((m) => m.month).join(", ")}) are not consecutive - a payslip may be missing.`,
      months: three,
    };
  }

  return { kind: "usable", m1: amounts[0], m2: amounts[1], m3: amounts[2], months: three };
}

// ── Reading the documents ─────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";

import {
  assembleMonths,
  bankStatementMonths,
  incomeWindow,
  nextUploadAsk,
  type Assembly,
  type IncomeSource,
  type PayPeriod,
} from "./income-periods";

export type { IncomeSource } from "./income-periods";

/**
 * The incomeType /openApi/income/credit takes for each kind of document.
 *
 * Payslips stay PANEL_PAYSLIP, what every submission sent before bank and
 * earnings statements were read at all.
 */
export function ascendIncomeType(source: IncomeSource): string {
  switch (source) {
    case "bank_statement":
      return "BANK_STATEMENT_OTHER_INCOME";
    case "earnings_statement":
      return "INCOME_STATEMENT";
    default:
      return "PANEL_PAYSLIP";
  }
}

export type IncomeDocument = {
  fileName: string;
  /** application/pdf, image/jpeg or image/png. */
  mediaType: string;
  bytes: Buffer;
};

/**
 * What the model is asked to produce.
 *
 * `strict: true` makes the API guarantee the arguments validate against this
 * schema, so the code below never has to defend against a missing field -
 * only against the figures being wrong, which is what reviewExtraction is
 * for.
 */
const PERIOD_ITEM = {
  type: "object",
  additionalProperties: false,
  properties: {
    start: {
      type: "string",
      description: "YYYY-MM-DD, the first day the period pays for, as printed.",
    },
    end: {
      type: "string",
      description: "YYYY-MM-DD, the last day the period pays for, inclusive, as printed.",
    },
    gross: {
      type: "number",
      description:
        "GROSS pay for THIS period alone, in SGD. Never a year-to-date total, " +
        "never a net or take-home figure, never a sum of several periods.",
    },
    employer: { type: "string", description: "Employer or platform name as printed, or empty." },
  },
  required: ["start", "end", "gross", "employer"],
} as const;

const REPORT_INCOME_TOOL: Anthropic.Tool = {
  name: "report_income",
  description:
    "Report the income shown on the applicant's documents. Call this once, " +
    "after reading every document provided.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      documentType: {
        type: "string",
        enum: ["payslip", "bank_statement", "earnings_statement", "mixed", "other"],
        description:
          "What the documents are, taken together. `mixed` when they are more than one of " +
          "payslip, bank statement and earnings statement; `other` when none of them is any of these.",
      },
      readable: {
        type: "boolean",
        description:
          "false if the documents are illegible, or state no period and no amount.",
      },
      note: {
        type: "string",
        description:
          "If readable is false, or documentType is mixed or other, what is wrong, in one " +
          "sentence an applicant could act on.",
      },
      periods: {
        type: "array",
        description:
          "Payslips and earnings statements only: one entry per pay period found, exactly as " +
          "printed. Several may come from one document. Empty for bank statements.",
        items: PERIOD_ITEM,
      },
      statements: {
        type: "array",
        description:
          "Bank statements only: the dates each statement covers, as printed. Empty otherwise.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            start: { type: "string", description: "YYYY-MM-DD, the statement's first day." },
            end: { type: "string", description: "YYYY-MM-DD, the statement's last day, inclusive." },
          },
          required: ["start", "end"],
        },
      },
      credits: {
        type: "array",
        description:
          "Bank statements only: every credit that is income, one entry per transaction line. " +
          "Empty otherwise.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            date: { type: "string", description: "YYYY-MM-DD, the date the credit was posted." },
            amount: { type: "number", description: "The amount credited, in SGD, as printed." },
            payer: {
              type: "string",
              description:
                "The company or person who paid it, as named in the transaction description - " +
                "the name only, without references, dates or codes. Empty if none is named.",
            },
          },
          required: ["date", "amount", "payer"],
        },
      },
    },
    required: ["documentType", "readable", "note", "periods", "statements", "credits"],
  },
};

const SYSTEM = `You read Singapore income documents - payslips, bank statements, and
earnings statements from platforms like Grab, Gojek or Foodpanda - and report
the income printed on them.

These figures decide how much someone is lent, so report only what the
document says. The arithmetic is done elsewhere.

Say what the documents are. If they are more than one kind - payslips and a
bank statement together - set documentType to mixed and report nothing else:
one kind is assessed at a time. If none is a payslip, bank statement or
earnings statement, set documentType to other.

PAYSLIPS
- Report the pay PERIOD as printed - its first and last day. Do not convert it
  to a month, do not round it to month boundaries, and do not merge periods.
  A payslip for 16-31 August is start 2025-08-16, end 2025-08-31.
- If a payslip names a month but no dates, use that month's first and last day.
- Report GROSS pay for that period - before CPF and deductions. Ascend scores
  on gross.
- The period is what the pay is FOR, never the date it was paid. A payslip for
  August paid on 1 September is 2025-08-01 to 2025-08-31.
- Never report a year-to-date or cumulative total as a period's pay. Payslips
  often show both, sometimes as "345.00 / 7795.00" where the second figure is
  the running total. The larger one is not what is wanted.
- Exclude expense reimbursements. They are not income.

EARNINGS STATEMENTS (ride-hailing, delivery and other platform work)
- Report them as periods, like payslips: the dates the statement covers and
  the earnings for them.
- Report what the worker earned for the period after the platform's own
  commission or service fee - the figure the statement gives as their
  earnings. Leave out cash collected from customers that is not earnings,
  and leave out tips only when the statement lists them apart from earnings.

BANK STATEMENTS
- Report the dates each statement covers, as printed.
- Report every credit that is income, one entry per transaction line, with
  its posting date, amount and payer as printed. Income is salary, wages,
  commission, or a platform payout paid in by an employer or platform -
  usually a GIRO or FAST credit described as salary, SAL, payroll, or naming
  a company that pays on a regular date.
- Leave out everything else: transfers between the account holder's own
  accounts, PayNow or FAST from individuals, cash deposits, refunds and
  reversals, interest, dividends, loan disbursements, insurance payouts and
  government payouts. When you cannot tell whether a credit is income, leave
  it out - counting money that is not income lends someone more than they
  can repay.
- Do not add credits up, and report a credit once even when two documents
  both show it.

ALL DOCUMENTS
- One document may hold several periods. Report every one you can read.
- Do not add up periods, do not average, and do not infer a period you cannot
  see. A missing month is handled by asking the applicant for it.
- If a document is unreadable, or states no period and no amount, set
  readable to false and say why.

Call report_income exactly once when you have read every document.`;

/**
 * Makes the model's free-text note safe to show an applicant, or returns null.
 *
 * On the `unreadable` path this note becomes the reason on the applicant's
 * screen, so it is the one model-authored string a customer actually reads.
 * Reading eighteen real payslips on 2026-09-17, two of them - both slow,
 * scanned images - came back with the model's own tool-call syntax in this
 * field instead of a sentence, e.g. a `<parameter name="months">` tag followed
 * by the JSON array. Structure in a sentence field is never something an
 * applicant should act on, so it is dropped rather than tidied: no note at all
 * leaves the caller's own wording in place, which is always readable.
 *
 * Angle-bracket tags are stripped from otherwise good prose (a note may
 * legitimately quote a payslip line), but a note that is *made of* markup or
 * JSON is discarded whole.
 */
export function applicantSafeNote(note: string | null | undefined): string | null {
  if (!note) return null;

  const trimmed = note.trim();
  if (!trimmed) return null;

  // Structural leftovers: a closing tag for a parameter/function/invoke block,
  // or an opening one. These only appear when the model has spilled its own
  // call syntax into prose.
  if (/<\/?(?:antml|parameter|function_calls|invoke)/i.test(trimmed)) return null;

  // A note that is really a JSON object or array, not a sentence.
  if (/^[[{]/.test(trimmed) && /[\]}]\s*$/.test(trimmed)) return null;

  const withoutTags = trimmed.replace(/<[^>]*>/g, "").trim();
  if (!withoutTags) return null;

  // After stripping tags, a "sentence" with no letters is not a sentence.
  if (!/\p{L}/u.test(withoutTags)) return null;

  return withoutTags;
}

/**
 * Crawfort accepts monthly payslips only, so a month assembled from weekly or
 * fortnightly ones is read and shown but never offered for underwriting - the
 * applicant is asked for the monthly payslip instead. Flip this to accept
 * apportioned months; nothing else has to change.
 */
const MONTHLY_ONLY = true;

/**
 * Every shape carries `periods` and `assembly`: the pay periods as printed (or,
 * for bank statements, the months their income credits sum to) and the
 * arithmetic that turned them into months. A lending decision has to be
 * explainable after the fact, and these are what make it replayable.
 *
 * `source` is the kind of document the figures came from, which decides the
 * incomeType Ascend is told.
 */
export type ExtractionOutcome =
  | (ExtractionReview & {
      note: string | null;
      source: IncomeSource;
      periods: PayPeriod[];
      assembly: Assembly;
    })
  | {
      kind: "unreadable";
      reason: string;
      source: IncomeSource;
      months: ExtractedMonth[];
      periods: PayPeriod[];
      assembly: Assembly;
    };

const EMPTY_ASSEMBLY: Assembly = { months: [], incomplete: [], overlapping: [] };

type Reported = {
  documentType: IncomeSource | "mixed" | "other";
  readable: boolean;
  note: string;
  periods: Array<{ start: string; end: string; gross: number; employer: string }>;
  statements: Array<{ start: string; end: string }>;
  credits: Array<{ date: string; amount: number; payer: string }>;
};

/**
 * Reads the documents and returns figures that have been checked.
 *
 * Never throws for a bad reading - an unreadable payslip is an outcome the
 * caller has to show the applicant, not an exception. It does throw if the
 * API itself is unreachable, which is a different problem with a different
 * answer.
 */
export async function extractIncome(
  documents: IncomeDocument[],
  options?: { client?: Anthropic; today?: Date },
): Promise<ExtractionOutcome> {
  if (documents.length === 0) {
    return {
      kind: "unreadable",
      reason: "No documents were provided.",
      source: "payslip",
      months: [],
      periods: [],
      assembly: EMPTY_ASSEMBLY,
    };
  }

  const client = options?.client ?? new Anthropic();

  const content: Anthropic.ContentBlockParam[] = documents.map((doc) =>
    doc.mediaType === "application/pdf"
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: doc.bytes.toString("base64"),
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: doc.mediaType as "image/jpeg" | "image/png",
            data: doc.bytes.toString("base64"),
          },
        },
  );

  content.push({
    type: "text",
    text: `Read the ${documents.length} document(s) above and report the income on them.`,
  });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    // Reading a payslip correctly is worth thinking about: the YTD column and
    // the month's pay sit next to each other and look alike. A bank statement
    // is worse - which of forty credits is salary is a judgement.
    thinking: { type: "adaptive" },
    system: SYSTEM,
    tools: [REPORT_INCOME_TOOL],
    messages: [{ role: "user", content }],
  });

  const call = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === "report_income",
  );

  if (!call) {
    return {
      kind: "unreadable",
      reason: "The documents could not be read. Please upload clear payslips or bank statements.",
      source: "payslip",
      months: [],
      periods: [],
      assembly: EMPTY_ASSEMBLY,
    };
  }

  const reported = call.input as Reported;

  // Ascend takes one incomeType per submission, so a payslip and a bank
  // statement cannot be scored together.
  if (reported.documentType === "mixed") {
    return {
      kind: "needs_review",
      reason:
        "Please upload one kind of document: your last 3 payslips, or your last 3 months of " +
        "bank statements.",
      months: [],
      note: applicantSafeNote(reported.note),
      source: "payslip",
      periods: [],
      assembly: EMPTY_ASSEMBLY,
    };
  }
  if (reported.documentType === "other") {
    return {
      kind: "unreadable",
      reason:
        applicantSafeNote(reported.note) ??
        "These do not look like payslips, bank statements or earnings statements.",
      source: "payslip",
      months: [],
      periods: [],
      assembly: EMPTY_ASSEMBLY,
    };
  }

  const source: IncomeSource = reported.documentType;

  let periods: PayPeriod[];
  let withoutIncome: string[] = [];
  if (source === "bank_statement") {
    ({ periods, withoutIncome } = bankStatementMonths(
      reported.statements,
      reported.credits.map((c) => ({ date: c.date, amount: c.amount, payer: c.payer || null })),
    ));
  } else {
    periods = reported.periods.map((p) => ({
      start: p.start,
      end: p.end,
      gross: p.gross,
      employer: p.employer || null,
    }));
  }

  const assembly = assembleMonths(periods);
  const months: ExtractedMonth[] = assembly.months.map((m) => ({
    month: m.month,
    amount: m.amount,
    employer: m.employer,
  }));

  if (!reported.readable) {
    return {
      kind: "unreadable",
      reason:
        applicantSafeNote(reported.note) ??
        "The documents could not be read. Please upload clear copies.",
      source,
      months,
      periods,
      assembly,
    };
  }

  const askOptions = { monthlyOnly: MONTHLY_ONLY, today: options?.today, source };
  const window = incomeWindow(assembly, askOptions);

  // A statement month with nothing paid in is not a missing statement, and
  // asking for it again would send the applicant looking for a document they
  // have already given us.
  const empty = withoutIncome.filter((m) => window.includes(m)).sort();
  if (empty.length > 0) {
    const names = empty.map((m) => monthParts(m).label).join(" and ");
    return {
      kind: "needs_review",
      reason:
        `We could not find salary or other income paid in during ${names}. ` +
        "If you were paid into another account, please upload that account's statements, " +
        "or upload your payslips instead.",
      months,
      note: applicantSafeNote(reported.note),
      source,
      periods,
      assembly,
    };
  }

  // Under MONTHLY_ONLY a month assembled from weekly payslips is complete but
  // not underwritable, so the ask comes before the review: telling someone
  // their October is short is wrong when what we want is October's monthly
  // payslip.
  const ask = nextUploadAsk(assembly, askOptions);
  if (ask) {
    return {
      kind: "needs_review",
      reason: ask,
      months: MONTHLY_ONLY ? months.filter((_, i) => assembly.months[i].exact) : months,
      note: applicantSafeNote(reported.note),
      source,
      periods,
      assembly,
    };
  }

  // Only the window's months are underwritten. A payslip dated after this
  // month, or one older than the three, is read and kept but never scored.
  return {
    ...reviewExtraction(months.filter((m) => window.includes(m.month))),
    note: applicantSafeNote(reported.note),
    source,
    periods,
    assembly,
  };
}

/**
 * Splits an ISO month ("2026-08") into the parts the results screen renders.
 *
 * Month numbers are 1-based on the wire and 0-based in Date, which is the
 * classic place this goes wrong by one.
 */
export function monthParts(iso: string): { label: string; month: string; year: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(iso);
  if (!match) return { label: iso, month: iso, year: "" };

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  if (Number.isNaN(date.getTime())) return { label: iso, month: iso, year: "" };

  return {
    label: date.toLocaleDateString("en-SG", { month: "long", year: "numeric" }),
    month: date.toLocaleDateString("en-SG", { month: "long" }),
    year: date.toLocaleDateString("en-SG", { year: "numeric" }),
  };
}
