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
      /** The three months before this one, most recent first - Ascend's shape. */
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
  nextUploadAsk,
  type Assembly,
  type PayPeriod,
} from "./income-periods";

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
const REPORT_INCOME_TOOL: Anthropic.Tool = {
  name: "report_income",
  description:
    "Report the pay periods printed on the applicant's payslips. Call this once, " +
    "after reading every document provided.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      readable: {
        type: "boolean",
        description:
          "false if the documents are not payslips, are illegible, or do not state a pay period and an amount.",
      },
      note: {
        type: "string",
        description:
          "If readable is false, what is wrong, in one sentence an applicant could act on.",
      },
      periods: {
        type: "array",
        description:
          "One entry per pay period found, exactly as printed. Several may come from one " +
          "document. Empty when readable is false.",
        items: {
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
            employer: { type: "string", description: "Employer name as printed, or empty." },
          },
          required: ["start", "end", "gross", "employer"],
        },
      },
    },
    required: ["readable", "note", "periods"],
  },
};

const SYSTEM = `You read Singapore payslips and report the pay periods printed on them.

These figures decide how much someone is lent, so report only what the
document says. The arithmetic is done elsewhere.

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
- One document may hold several periods. Report every one you can read.
- Do not add up periods, do not average, and do not infer a period you cannot
  see. A missing month is handled by asking the applicant for it.
- If a document is not a payslip, is unreadable, or states no period and
  amount, set readable to false and say why.

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
 * Both shapes carry `periods` and `assembly`: the pay periods as printed and
 * the arithmetic that turned them into months. A lending decision has to be
 * explainable after the fact, and these are what make it replayable.
 */
export type ExtractionOutcome =
  | (ExtractionReview & {
      note: string | null;
      periods: PayPeriod[];
      assembly: Assembly;
    })
  | {
      kind: "unreadable";
      reason: string;
      months: ExtractedMonth[];
      periods: PayPeriod[];
      assembly: Assembly;
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
  options?: { client?: Anthropic },
): Promise<ExtractionOutcome> {
  if (documents.length === 0) {
    return {
      kind: "unreadable",
      reason: "No documents were provided.",
      months: [],
      periods: [],
      assembly: { months: [], incomplete: [], overlapping: [] },
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
    text: `Read the ${documents.length} document(s) above and report every pay period on them.`,
  });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    // Reading a payslip correctly is worth thinking about: the YTD column and
    // the month's pay sit next to each other and look alike.
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
      reason: "The documents could not be read. Please upload clear payslips.",
      months: [],
      periods: [],
      assembly: { months: [], incomplete: [], overlapping: [] },
    };
  }

  const reported = call.input as {
    readable: boolean;
    note: string;
    periods: Array<{ start: string; end: string; gross: number; employer: string }>;
  };

  const periods: PayPeriod[] = reported.periods.map((p) => ({
    start: p.start,
    end: p.end,
    gross: p.gross,
    employer: p.employer || null,
  }));

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
        "The documents could not be read as payslips.",
      months,
      periods,
      assembly,
    };
  }

  // Under MONTHLY_ONLY a month assembled from weekly payslips is complete but
  // not underwritable, so the ask comes before the review: telling someone
  // their October is short is wrong when what we want is October's monthly
  // payslip.
  const ask = nextUploadAsk(assembly, { monthlyOnly: MONTHLY_ONLY });
  if (ask) {
    return {
      kind: "needs_review",
      reason: ask,
      months: MONTHLY_ONLY ? months.filter((_, i) => assembly.months[i].exact) : months,
      note: applicantSafeNote(reported.note),
      periods,
      assembly,
    };
  }

  return {
    ...reviewExtraction(months),
    note: applicantSafeNote(reported.note),
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
