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
    "Report the monthly income read from the applicant's payslips. Call this once, " +
    "after reading every document provided.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      readable: {
        type: "boolean",
        description:
          "false if the documents are not payslips, are illegible, or do not state a monthly amount.",
      },
      note: {
        type: "string",
        description:
          "If readable is false, what is wrong, in one sentence an applicant could act on.",
      },
      months: {
        type: "array",
        description: "One entry per month found. Empty when readable is false.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            month: { type: "string", description: "YYYY-MM, the month the pay is FOR." },
            amount: {
              type: "number",
              description:
                "GROSS pay for that month alone, in SGD. Never a year-to-date total, " +
                "never a net or take-home figure, never a sum of several months.",
            },
            employer: { type: "string", description: "Employer name as printed, or empty." },
          },
          required: ["month", "amount", "employer"],
        },
      },
    },
    required: ["readable", "note", "months"],
  },
};

const SYSTEM = `You read Singapore payslips and report the monthly income on them.

These figures decide how much someone is lent, so accuracy matters more than
completeness:

- Report GROSS monthly pay - before CPF and deductions. Ascend scores on gross.
- Report the month the pay is FOR, not the date it was paid. A payslip for
  August paid on 1 September is 2026-08.
- Never report a year-to-date or cumulative total as a month's pay. Payslips
  often show both; the YTD column is not what is wanted.
- If a document is not a payslip, is unreadable, or does not state a monthly
  amount, set readable to false and say why. Do not estimate, do not average,
  and do not infer a missing month from the others.

Call report_income exactly once when you have read every document.`;

export type ExtractionOutcome =
  | (ExtractionReview & { note: string | null })
  | { kind: "unreadable"; reason: string; months: ExtractedMonth[] };

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
    return { kind: "unreadable", reason: "No documents were provided.", months: [] };
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
    text: `Read the ${documents.length} document(s) above and report the monthly income.`,
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
    };
  }

  const reported = call.input as {
    readable: boolean;
    note: string;
    months: Array<{ month: string; amount: number; employer: string }>;
  };

  const months: ExtractedMonth[] = reported.months.map((m) => ({
    month: m.month,
    amount: m.amount,
    employer: m.employer || null,
  }));

  if (!reported.readable) {
    return {
      kind: "unreadable",
      reason: reported.note || "The documents could not be read as payslips.",
      months,
    };
  }

  return { ...reviewExtraction(months), note: reported.note || null };
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
