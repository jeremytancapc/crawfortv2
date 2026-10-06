/**
 * Whether an income document is the applicant's own.
 *
 * Income read off someone else's payslip is someone else's income, and lending
 * against it is lending to a person who cannot repay. The figures are checked
 * elsewhere; this checks whose they are.
 *
 * Names are compared as sets of words, because payrolls and banks print them
 * their own way: "Caken Tan", "TAN, CAKEN" and "MR TAN CAKEN" are all TAN
 * CAKEN. What it will not do is accept a surname alone - "TAN" is a fifth of
 * Singapore.
 */

const TITLES = new Set(["MR", "MRS", "MS", "MISS", "MDM", "MADAM", "DR"]);

/** Words that join a name rather than being one: BIN, BINTE, S/O, D/O. */
const CONNECTORS = new Set(["BIN", "BINTE", "BTE", "BINTI", "SO", "DO", "AL"]);

function words(name: string): string[] {
  return name
    .toUpperCase()
    .replace(/\b([SD])\/O\b/g, "$1O")
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !TITLES.has(word) && !CONNECTORS.has(word));
}

/** One account, payslip or statement can name more than one holder. */
function holders(printed: string): string[] {
  return printed.split(/\s*&\s*|\s+AND\s+/i).filter((holder) => holder.trim());
}

function holderMatches(holder: string, allowed: Set<string>, needed: number): boolean {
  const printed = words(holder);
  if (printed.length === 0) return false;

  let whole = 0;
  for (const word of printed) {
    if (allowed.has(word)) {
      whole += 1;
    } else if (word.length === 1 && [...allowed].some((name) => name.startsWith(word))) {
      // An initial standing in for one of their names: "TAN W L FELICIA".
    } else {
      return false;
    }
  }
  return whole >= needed;
}

/**
 * True when a name printed on a document is the applicant's: every word in it
 * is one of theirs (or an initial of one), and at least two of their names
 * appear in full - one, for someone who has only one.
 *
 * `aliases` are other names Singpass holds for them (alias, Hanyu Pinyin,
 * married name). A joint account matches when any one holder is them.
 */
export function nameBelongsTo(printed: string, applicant: string, aliases: string[] = []): boolean {
  const own = words(applicant);
  if (own.length === 0) return false;

  const allowed = new Set([...own, ...aliases.flatMap(words)]);
  const needed = Math.min(2, own.length);
  return holders(printed).some((holder) => holderMatches(holder, allowed, needed));
}

/**
 * Banks licensed to take salary deposits in Singapore, as their statements
 * name them. A statement from anything else - or that names no bank - is not
 * one we can stand behind.
 */
const SG_BANKS = [
  /\bDBS\b/, /\bPOSB\b/, /\bOCBC\b/, /\bUOB\b/, /UNITED OVERSEAS BANK/,
  /STANDARD CHARTERED/, /\bHSBC\b/, /\bCITI(BANK)?\b/, /\bMAYBANK\b/,
  /BANK OF CHINA/, /\bICBC\b/, /\bCIMB\b/, /\bRHB\b/,
  /TRUST BANK/, /\bGXS\b/, /\bMARI ?BANK\b/, /\bANEXT\b/,
];

/** The same banks, in words, for anyone who needs to see the list. */
export const RECOGNISED_SG_BANK_NAMES = [
  "DBS", "POSB", "OCBC", "UOB", "Standard Chartered", "HSBC", "Citibank", "Maybank",
  "Bank of China", "ICBC", "CIMB", "RHB", "Trust Bank", "GXS", "MariBank", "ANEXT",
] as const;

/**
 * Extra bank names accepted for TESTING, from TEST_RECOGNISED_BANKS
 * (comma-separated, e.g. "HARBOURFRONT"). It exists so a fictional bank can
 * stand in for a real one in staging - the alternative being a fake statement
 * that names DBS or OCBC, which is a forged document rather than a fixture.
 *
 * Ignored on production, whatever it is set to: the real list is the whole
 * point of this check. Names under four characters are ignored too, because a
 * short token would match half the banks in the world.
 */
export function testBankNames(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.VERCEL_ENV === "production" || env.SINGPASS_ENV === "production") return [];
  return (env.TEST_RECOGNISED_BANKS ?? "")
    .split(",")
    .map((name) => name.trim().toUpperCase())
    .filter((name) => name.length >= 4);
}

/** Every bank name currently accepted - the real list plus any test banks. */
export function acceptedBankNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return [...RECOGNISED_SG_BANK_NAMES, ...testBankNames(env).map((name) => `${name} (test)`)];
}

export function isRecognisedSgBank(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const upper = name.toUpperCase();
  if (SG_BANKS.some((bank) => bank.test(upper))) return true;

  const test = testBankNames(env).find((bank) => upper.includes(bank));
  if (test) {
    console.warn(`[income-identity] accepted "${name}" as a TEST bank (${test}); not for production`);
    return true;
  }
  return false;
}
