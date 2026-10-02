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

export function isRecognisedSgBank(name: string): boolean {
  const upper = name.toUpperCase();
  return SG_BANKS.some((bank) => bank.test(upper));
}
