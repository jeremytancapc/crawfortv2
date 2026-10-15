/**
 * Finds anything that looks like a real person's identifier in text.
 *
 * The eval files are committed, and each one is a document of a person. Every
 * person in them is invented. This is the guard that keeps it so: a real NRIC,
 * mobile number, email or bank account pasted into a fixture is found here, in
 * the normal test run, before it is pushed.
 *
 * Pure code. It reads text and answers; evals/identifiers.test.ts runs it over
 * the files.
 */

export type Finding = { kind: "nric" | "email" | "phone" | "account"; text: string; line: number };

/**
 * Account numbers that appear on the fixtures. They are invented, and listed
 * here by hand so that a new one is a decision, not an accident.
 *
 *   0710000771   the bank account on the UAT staging persona's payslips
 */
export const FICTIONAL_NUMBERS = ["0710000771"];

/** The fictional bank's account numbers all carry this block: 301-000555-1. */
const FICTIONAL_BANK_BLOCK = "000555";

const EXAMPLE_DOMAINS = /(^|\.)(example\.(com|org|net)|test|invalid|localhost)$/i;

/** A document is a test document if it says so, in either of the two wordings used. */
export function isMarkedAsTest(text: string): boolean {
  return /\bSAMPLE\b/.test(text) || /\bnot a real payslip\b/i.test(text);
}

export function findIdentifiers(text: string): Finding[] {
  const found: Finding[] = [];
  const lines = text.split("\n");

  lines.forEach((content, at) => {
    const line = at + 1;
    const flagged: Array<[number, number]> = [];
    const overlaps = (start: number, end: number) => flagged.some(([s, e]) => start < e && end > s);
    const take = (kind: Finding["kind"], match: RegExpMatchArray) => {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (overlaps(start, end)) return;
      flagged.push([start, end]);
      found.push({ kind, text: match[0], line });
    };

    // S/T/F/G/M, seven digits, a check letter. Masked forms (S****083H) have
    // asterisks in place of digits and do not match.
    for (const m of content.matchAll(/\b[STFGM]\d{7}[A-Z]\b/gi)) take("nric", m);

    for (const m of content.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g)) {
      if (!EXAMPLE_DOMAINS.test(m[1])) take("email", m);
    }

    // Singapore numbers: eight digits starting 3, 6, 8 or 9, optionally with
    // +65 and a space or hyphen in the middle. Not when it sits inside an
    // amount (5,200.00), a longer number, or a date. Checked before accounts,
    // because a +65 number is also ten digits.
    for (const m of content.matchAll(/(?<![\d.,-])(?:\+?65[ -]?)?[3689]\d{3}[ -]?\d{4}(?![\d,]|\.\d|-\d)/g)) take("phone", m);

    // Bank account numbers: hyphenated groups, or a long run of digits. A run
    // of one repeated digit (0000000000) is a placeholder, not an account.
    for (const m of content.matchAll(/\b\d{3}-\d{3,6}-\d{1,3}\b/g)) {
      if (!m[0].includes(FICTIONAL_BANK_BLOCK)) take("account", m);
    }
    for (const m of content.matchAll(/(?<![\d.,-])\d{9,16}(?![\d.,-])/g)) {
      if (!FICTIONAL_NUMBERS.includes(m[0]) && !/^(\d)\1+$/.test(m[0])) take("account", m);
    }
  });

  return found;
}
