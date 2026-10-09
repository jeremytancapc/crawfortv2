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
      /** The window's three months, most recent first - Ascend's shape. */
      m1: number;
      m2: number;
      m3: number;
      /** The months actually read, most recent first. */
      months: ExtractedMonth[];
      /** Window months with no document. Sent to Ascend as S$0, never as a guess. */
      missing: string[];
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

/**
 * Checks the months read inside `window` (oldest first, three months) and
 * puts them in Ascend's shape.
 *
 * One month is enough to go ahead. A month with no document is sent as S$0:
 * we do not know what they earned, so we do not put a figure there - not the
 * average of the others, which would be assuming their salary. Ascend averages
 * m1-m3, so each missing month lowers the average by a third, and the
 * applicant is told so before they submit. `missing` records which months.
 */
export function reviewExtraction(months: ExtractedMonth[], window: string[]): ExtractionReview {
  const read = months
    .filter((m) => window.includes(m.month))
    .sort((a, b) => b.month.localeCompare(a.month));

  if (read.length === 0) {
    return { kind: "needs_review", reason: "No month could be read.", months: read };
  }

  const amounts = read.map((m) => m.amount);
  if (amounts.some((a) => !Number.isFinite(a) || a <= 0)) {
    return { kind: "needs_review", reason: "One of the months has no usable amount.", months: read };
  }

  const highest = Math.max(...amounts);
  const lowest = Math.min(...amounts);
  if (highest / lowest > YTD_RATIO) {
    return {
      kind: "needs_review",
      reason:
        `One month (${highest.toLocaleString("en-SG")}) is far larger than the others ` +
        `(lowest ${lowest.toLocaleString("en-SG")}) - this is usually a year-to-date total read as one month.`,
      months: read,
    };
  }

  const byMonth = new Map(read.map((m) => [m.month, m.amount]));
  const [m1, m2, m3] = [...window].reverse().map((month) => byMonth.get(month) ?? 0);

  return {
    kind: "usable",
    m1,
    m2,
    m3,
    months: read,
    missing: window.filter((month) => !byMonth.has(month)),
  };
}

// ── Reading the documents ─────────────────────────────────────────────────

import { grossUpSalary, type CpfProfile } from "@/lib/income-cpf";
import Anthropic from "@anthropic-ai/sdk";

import { isRecognisedSgBank, nameBelongsTo } from "./income-identity";
import {
  assembleMonths,
  bankStatementMonths,
  latestAllowed,
  paidIntoBank,
  planIncomeMonths,
  type Assembly,
  type IncomeCredit,
  type IncomeSource,
  type PayPeriod,
} from "./income-periods";

export type { IncomeSource } from "./income-periods";

/**
 * The incomeType /openApi/income/credit is told, and the fileType each
 * uploaded document is sent as.
 *
 * A payslip on its own is NON_PANEL. It becomes PANEL when a bank statement
 * uploaded with it shows that pay arriving - the payslip is then confirmed
 * rather than taken on trust. A platform's earnings statement (Grab and
 * similar) is treated exactly as a payslip.
 */
export type AscendIncomeType = "PANEL_PAYSLIP" | "NON_PANEL_PAYSLIP" | "BANK_STATEMENT_OTHER_INCOME";

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
    net: {
      type: "number",
      description:
        "Take-home (net) pay for THIS period as printed, in SGD - never a year-to-date " +
        "total. 0 if the document does not print one.",
    },
    employer: { type: "string", description: "Employer or platform name as printed, or empty." },
    document: { type: "integer", description: "The number of the document it was read from." },
  },
  required: ["start", "end", "gross", "net", "employer", "document"],
} as const;

/**
 * What a bank credit is. The reader sorts; `COUNTED_CREDITS` decides which
 * sorts are income, so the rule can change without re-reading anything.
 */
const CREDIT_CATEGORIES = [
  "salary",
  "platform_payout",
  "transfer_from_others",
  "cash_deposit",
  "cpf_life",
  "government_payout",
  "own_account_transfer",
  "interest",
  "refund_or_reversal",
  "loan_disbursement",
  "other",
] as const;

type CreditCategory = (typeof CREDIT_CATEGORIES)[number];

/**
 * A bank statement on its own is income as everything coming in, as agreed
 * on 30 Sep: salary, PayNow and transfers from other people, cash deposits,
 * CPF LIFE and other payouts - less interest and refunds.
 *
 * Two more are left out, which "total deposits" would otherwise count: money
 * moved in from the applicant's own accounts, and loans paid out to them.
 * Neither is earned, and counting either lends against the applicant's own
 * savings or someone else's credit.
 */
const COUNTED_CREDITS = new Set<CreditCategory>([
  "salary",
  "platform_payout",
  "transfer_from_others",
  "cash_deposit",
  "cpf_life",
  "government_payout",
  "other",
]);

/**
 * Someone who says they are not working but have income lives on something
 * other than a wage - and the one thing a bank statement shows that we can
 * tell is theirs is the CPF payout. So for them it is the only credit that
 * counts, whatever else is paid in. Everyone else keeps COUNTED_CREDITS.
 */
const UNEMPLOYED_WITH_INCOME = "UNEMPLOYED WITH INCOME";
const CPF_ONLY = new Set<CreditCategory>(["cpf_life"]);

function creditsCountedFor(employmentType: string | undefined): Set<CreditCategory> {
  return employmentType === UNEMPLOYED_WITH_INCOME ? CPF_ONLY : COUNTED_CREDITS;
}

const REPORT_INCOME_TOOL: Anthropic.Tool = {
  name: "report_income",
  description:
    "Report what each of the applicant's documents is and the income on it. Call this once, " +
    "after reading every document provided.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      readable: {
        type: "boolean",
        description:
          "false if the documents are illegible, or state no period and no amount.",
      },
      note: {
        type: "string",
        description: "If readable is false, what is wrong, in one sentence an applicant could act on.",
      },
      documents: {
        type: "array",
        description:
          "One entry per document, using the number it was given: what it is, whose it is, " +
          "and who issued it.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index: { type: "integer", description: "The document's number, as labelled." },
            kind: {
              type: "string",
              enum: ["payslip", "bank_statement", "earnings_statement", "other"],
              description:
                "earnings_statement is a ride-hailing, delivery or other platform's statement " +
                "of a worker's earnings. other is anything that is none of these.",
            },
            holderName: {
              type: "string",
              description:
                "The employee's or account holder's name exactly as printed - every holder, " +
                "joined with \" & \", on a joint account. Empty if the document names no one.",
            },
            issuer: {
              type: "string",
              description:
                "Who issued it, as printed: the employer on a payslip, the bank on a bank " +
                "statement, the platform on an earnings statement. Empty if none is named.",
            },
          },
          required: ["index", "kind", "holderName", "issuer"],
        },
      },
      periods: {
        type: "array",
        description:
          "Payslips and earnings statements: one entry per pay period found, exactly as " +
          "printed. Several may come from one document. Empty when there are none.",
        items: PERIOD_ITEM,
      },
      statements: {
        type: "array",
        description:
          "Bank statements: the dates each statement covers, as printed. Empty when there are none.",
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
          "Bank statements: EVERY credit (money in), one entry per transaction line, sorted " +
          "into a category. Empty when there are none.",
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
            category: { type: "string", enum: [...CREDIT_CATEGORIES] },
          },
          required: ["date", "amount", "payer", "category"],
        },
      },
    },
    required: ["readable", "note", "documents", "periods", "statements", "credits"],
  },
};

const SYSTEM = `You read Singapore income documents - payslips, bank statements, and
earnings statements from platforms like Grab, Gojek or Foodpanda - and report
what each one is and the income printed on it.

These figures decide how much someone is lent, so report only what the
documents say. The arithmetic is done elsewhere.

EVERY DOCUMENT
- Each document is labelled with a number. For every one, say what kind it
  is, the name of the employee or account holder exactly as printed, and who
  issued it. Do not correct, complete or reorder a name. Report the name only:
  leave out an employee number, staff ID, or any other number printed beside it
  (for "TAN CAKEN (100257)" report "TAN CAKEN").

PAYSLIPS
- Report the pay PERIOD as printed - its first and last day. Do not convert it
  to a month, do not round it to month boundaries, and do not merge periods.
  A payslip for 16-31 August is start 2025-08-16, end 2025-08-31.
- If a payslip names a month but no dates, use that month's first and last day.
- Report GROSS pay for that period - before CPF and deductions. Ascend scores
  on gross.
- Also report the NET (take-home) pay printed for that period: the amount
  paid into the bank. 0 if no net figure is printed.
- The period is what the pay is FOR, never the date it was paid. A payslip for
  August paid on 1 September is 2025-08-01 to 2025-08-31.
- Never report a year-to-date or cumulative total as a period's pay. Payslips
  often show both, sometimes as "345.00 / 7795.00" where the second figure is
  the running total. The larger one is not what is wanted.
- Exclude expense reimbursements from gross. They are not income.

EARNINGS STATEMENTS (ride-hailing, delivery and other platform work)
- Report them as periods, like payslips: the dates the statement covers and
  the earnings for them.
- GROSS is what the worker earned after the costs the statement takes off:
  the platform's commission or service fee, vehicle rental, and any other
  charge deducted from their earnings. It is BEFORE any CPF: a line such as
  "Withheld earnings for CPF" or "CPF contribution" is the worker's own money
  set aside, not a cost, so it is not taken off gross. A statement with income
  of 1,542.50, CPF withheld of 191.27 and a net payment of 1,351.23 has gross
  1,542.50.
- NET is what was actually paid out to them, after everything including CPF
  withheld (1,351.23 in that example). If nothing is withheld, net equals gross.
- Leave out cash collected from customers that is not earnings.

BANK STATEMENTS
- Report the dates each statement covers, as printed.
- Report EVERY credit - every line where money came in - with its posting
  date, amount and payer as printed, and the category that fits it:
    salary                 pay from an employer (GIRO/FAST, often "SALARY",
                           "SAL" or "PAYROLL")
    platform_payout        a payout from Grab, Gojek, Foodpanda or similar
    transfer_from_others   PayNow, FAST or GIRO from another person or company
                           that is not salary
    cash_deposit           cash paid in at a machine or counter
    cpf_life               a CPF LIFE payout (monthly annuity from the CPF
                           Board), however the line describes it
    government_payout      any other government payment: CPF withdrawals,
                           GST Voucher and similar
    own_account_transfer   a transfer from another account in the account
                           holder's own name
    interest               interest or bonus interest from the bank
    refund_or_reversal     a refund, reversal, chargeback or cashback
    loan_disbursement      a loan or credit line paid out
    other                  anything else
- Report a credit once even when two documents both show it. Do not add
  credits up.

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
 * for bank statements, the months their credits sum to) and the arithmetic
 * that turned them into months. A lending decision has to be explainable
 * after the fact, and these are what make it replayable.
 *
 * `source` is what the figures were taken from. On the usable branch,
 * `incomeType` is what Ascend is told, `fileTypes` the type of each uploaded
 * file in upload order, and `advice` which months would confirm the figure.
 */
export type ExtractionOutcome =
  | (Extract<ExtractionReview, { kind: "usable" }> & {
      note: string | null;
      source: IncomeSource;
      incomeType: AscendIncomeType;
      fileTypes: AscendIncomeType[];
      advice: string | null;
      /**
       * Files accepted although they show no name. Recorded and passed on to
       * staff, because nothing ties these to the applicant but the applicant.
       */
      nameNotShown: string[];
      /**
       * Positions (in the order uploaded) of files that fed none of the three
       * months - a March payslip sent in October. They are not evidence for
       * this decision and are not sent to Ascend.
       */
      ignoredIndices: number[];
      periods: PayPeriod[];
      assembly: Assembly;
    })
  | {
      kind: "needs_review" | "unreadable";
      reason: string;
      note?: string | null;
      source: IncomeSource;
      months: ExtractedMonth[];
      periods: PayPeriod[];
      assembly: Assembly;
    };

const EMPTY_ASSEMBLY: Assembly = { months: [], incomplete: [], overlapping: [] };

type DocumentKind = IncomeSource | "other";

type Reported = {
  readable: boolean;
  note: string;
  documents: Array<{ index: number; kind: DocumentKind; holderName: string; issuer: string }>;
  periods: Array<{ start: string; end: string; gross: number; net: number; employer: string; document?: number }>;
  statements: Array<{ start: string; end: string }>;
  credits: Array<{ date: string; amount: number; payer: string; category: CreditCategory }>;
};

type SeenDocument = Reported["documents"][number];

/**
 * An earnings statement that shows no name at all. Gig-app screens - Grab and
 * foodpanda payments pages - often do not print one, so absence is not
 * evidence against the applicant the way it is on a payslip or a bank
 * statement, which always carry the holder's name. A name that IS shown and
 * is not theirs is still refused; only silence is let through.
 */
function namesNobody(found: SeenDocument | undefined): boolean {
  return found?.kind === "earnings_statement" && !found.holderName.trim();
}

/**
 * Why these documents cannot be taken as the applicant's, or null when they
 * can: each is an income document, each names them (an earnings statement
 * that names no one is let through - see namesNobody), and each bank
 * statement is from a Singapore bank.
 */
function documentProblem(
  documents: IncomeDocument[],
  seen: Array<SeenDocument | undefined>,
  applicant: { name: string; aliases?: string[] } | undefined,
): string | null {
  for (const [i, doc] of documents.entries()) {
    const found = seen[i];
    if (found?.kind === "other") {
      return `${doc.fileName} does not look like a payslip, bank statement or earnings ` +
        "statement. Please remove it or upload the right document.";
    }
    if (!applicant) continue;
    if (namesNobody(found)) continue;
    if (!found || !nameBelongsTo(found.holderName, applicant.name, applicant.aliases)) {
      return found?.holderName.trim()
        ? `${doc.fileName} appears to belong to someone else, and we do not accept ` +
            "documents for another person. Please upload documents in your own name."
        : `We could not find your name on ${doc.fileName}. Please upload documents that show ` +
            "your name as it appears in Singpass.";
    }
    if (found.kind === "bank_statement" && !isRecognisedSgBank(found.issuer)) {
      return `We could not confirm ${doc.fileName} is from a Singapore bank. Please upload ` +
        "statements from your bank in Singapore.";
    }
  }
  return null;
}

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
  options?: {
    client?: Anthropic;
    today?: Date;
    /**
     * Whose documents these should be. Every document must name them, or
     * nothing is read off any of them. Omitted only where there is no
     * applicant to check against, never on the upload step.
     */
    applicant?: { name: string; aliases?: string[] };
    /**
     * Their CPF position. A salary deposit on a bank statement is after the
     * employee's CPF, so it is taken back up to gross (see lib/income-cpf.ts).
     * Omitted, deposits are counted as they arrive.
     */
    cpf?: CpfProfile;
    /**
     * What they said their employment is, in Ascend's words. Decides which
     * bank-statement credits are income: for UNEMPLOYED WITH INCOME only the
     * CPF payout; for anyone else, everything that is money in.
     */
    employmentType?: string;
  },
): Promise<ExtractionOutcome> {
  const refuse = (
    kind: "needs_review" | "unreadable",
    reason: string,
    source: IncomeSource = "payslip",
  ): ExtractionOutcome => ({ kind, reason, source, months: [], periods: [], assembly: EMPTY_ASSEMBLY });

  if (documents.length === 0) return refuse("unreadable", "No documents were provided.");

  const client = options?.client ?? new Anthropic();
  const today = options?.today ?? new Date();

  // Each file is numbered so the reader can say what each one is and whose
  // name is on it, and a refusal can name the file to replace.
  const content: Anthropic.ContentBlockParam[] = documents.flatMap((doc, i) => [
    { type: "text" as const, text: `Document ${i + 1}:` },
    doc.mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: doc.bytes.toString("base64"),
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: doc.mediaType as "image/jpeg" | "image/png",
            data: doc.bytes.toString("base64"),
          },
        },
  ]);

  content.push({
    type: "text",
    text: `Read the ${documents.length} document(s) above and report the income on them.`,
  });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    // Reading a payslip correctly is worth thinking about: the YTD column and
    // the month's pay sit next to each other and look alike. A bank statement
    // is worse - sorting forty credits is a judgement.
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
    return refuse(
      "unreadable",
      "The documents could not be read. Please upload clear payslips or bank statements.",
    );
  }

  const reported = call.input as Reported;

  if (!reported.readable) {
    return refuse(
      "unreadable",
      applicantSafeNote(reported.note) ?? "The documents could not be read. Please upload clear copies.",
    );
  }

  const byIndex = new Map(reported.documents.map((d) => [d.index, d]));
  const seen = documents.map((_, i) => byIndex.get(i + 1));

  // Before any figure is taken: income off someone else's payslip is not
  // this applicant's income, however clearly it reads.
  const problem = documentProblem(documents, seen, options?.applicant);
  if (problem) return refuse("needs_review", problem);

  const kinds = new Set(seen.map((d) => d?.kind));
  const hasPayslip = kinds.has("payslip");
  const hasEarnings = kinds.has("earnings_statement");
  const hasBank = kinds.has("bank_statement");

  const source: IncomeSource = hasPayslip ? "payslip" : hasEarnings ? "earnings_statement" : "bank_statement";
  const credits: IncomeCredit[] = reported.credits.map((c) => ({
    date: c.date,
    amount: c.amount,
    payer: c.payer || null,
  }));

  let periods: PayPeriod[];
  let withoutIncome: string[] = [];
  if (source === "bank_statement") {
    ({ periods, withoutIncome } = bankStatementMonths(
      reported.statements,
      reported.credits
        .filter((c) => creditsCountedFor(options?.employmentType).has(c.category))
        .map((c) => ({
          date: c.date,
          // Only a salary has CPF taken off it. Transfers, cash and platform
          // payouts arrive whole.
          amount: c.category === "salary" ? grossUpSalary(c.amount, options?.cpf, today) : c.amount,
          payer: c.payer || null,
        })),
    ));
  } else {
    periods = reported.periods.map((p) => ({
      start: p.start,
      end: p.end,
      gross: p.gross,
      net: p.net || null,
      employer: p.employer || null,
      platform: seen[(p.document ?? 0) - 1]?.kind === "earnings_statement",
    }));
  }

  const assembly = assembleMonths(periods);
  const months: ExtractedMonth[] = assembly.months.map((m) => ({
    month: m.month,
    amount: m.amount,
    employer: m.employer,
  }));
  const note = applicantSafeNote(reported.note);
  const notReady = (reason: string): ExtractionOutcome => ({
    kind: "needs_review",
    reason,
    note,
    source,
    months: MONTHLY_ONLY ? months.filter((_, i) => assembly.months[i].exact) : months,
    periods,
    assembly,
  });

  const plan = planIncomeMonths(assembly, { monthlyOnly: MONTHLY_ONLY, today, source });

  // A recent statement month with nothing coming in is not a missing
  // statement, and asking for it again would send the applicant looking for
  // a document they have already given us.
  const recent = new Set([...latestAllowed(today), ...(plan.kind === "ready" ? plan.window : [])]);
  const empty = withoutIncome.filter((m) => recent.has(m)).sort();
  if (empty.length > 0) {
    const names = empty.map((m) => monthParts(m).label).join(" and ");
    return notReady(
      options?.employmentType === UNEMPLOYED_WITH_INCOME
        ? `We could not find a CPF payout in ${names}. For your employment status we count ` +
            "only your CPF payout. If it is paid into another account, please upload that " +
            "account's statements."
        : `We could not find any money coming in during ${names}. If you were paid into ` +
            "another account, please upload that account's statements, or upload your payslips instead.",
    );
  }

  if (plan.kind === "ask") return notReady(plan.ask);

  const review = reviewExtraction(months, plan.window);
  if (review.kind === "needs_review") return notReady(review.reason);

  const payslipType: AscendIncomeType =
    hasBank && paidIntoBank(periods, credits, plan.held) ? "PANEL_PAYSLIP" : "NON_PANEL_PAYSLIP";
  // Earnings statements are payslips to Ascend: the same type, panel on the
  // same evidence - and summed with a payslip for the same month, like a
  // second job.
  const typeOf = (kind: DocumentKind | undefined): AscendIncomeType =>
    kind === "payslip" || kind === "earnings_statement" ? payslipType : "BANK_STATEMENT_OTHER_INCOME";

  // A file counts as used when one of its pay periods touches a month in the
  // window. Only worked out when every period says which file it came from -
  // if the reader left that out, nothing is called unused, because wrongly
  // dropping a real document is worse than keeping an extra one. Bank
  // statements are always kept: they corroborate rather than supply months.
  const windowMonths = new Set(plan.window);
  const everyPeriodNamesItsFile =
    source !== "bank_statement" && reported.periods.every((p) => Number.isInteger(p.document));
  const usedFiles = new Set<number>();
  if (everyPeriodNamesItsFile) {
    for (const p of reported.periods) {
      if (windowMonths.has(p.start.slice(0, 7)) || windowMonths.has(p.end.slice(0, 7))) {
        usedFiles.add((p.document as number) - 1);
      }
    }
  }
  const ignoredIndices = everyPeriodNamesItsFile
    ? documents.flatMap((_, i) => (seen[i]?.kind === "bank_statement" || usedFiles.has(i) ? [] : [i]))
    : [];

  return {
    ...review,
    note,
    source,
    ignoredIndices,
    incomeType: typeOf(source),
    fileTypes: seen.map((d) => typeOf(d?.kind)),
    advice: plan.advice,
    nameNotShown: documents.filter((_, i) => namesNobody(seen[i])).map((d) => d.fileName),
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
