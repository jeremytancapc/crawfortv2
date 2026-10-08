/**
 * Adding documents on the results page.
 *
 * The first page asks for documents; the results page shows what was read and
 * lets the applicant add more to strengthen it - but never take any away. The
 * two rules here are what make adding safe.
 */

/** The most documents one reading takes. The extract route enforces the same. */
export const MAX_INCOME_FILES = 6;

/**
 * How many of `incoming` files fit alongside the `current` ones. The rest are
 * not added, and the applicant is told - a file silently dropped looks like it
 * was counted.
 */
export function roomForMore(
  current: number,
  incoming: number,
): { accept: number; message: string | null } {
  const accept = Math.max(0, Math.min(incoming, MAX_INCOME_FILES - current));
  const left = incoming - accept;
  return {
    accept,
    message:
      left > 0
        ? `You can add up to ${MAX_INCOME_FILES} documents. ${left} ${left === 1 ? "was" : "were"} not added.`
        : null,
  };
}

/**
 * What the page does once the added documents have been read again.
 *
 *   replace        the new reading is usable: show its figures.
 *   keep_previous  it is not, but the figures from before still stand - they
 *                  came from documents that are all still there - so they stay
 *                  on screen and the reason is shown beside them. Throwing
 *                  them away would make adding a document cost the applicant
 *                  what they already had.
 *   show_ask       there is nothing to keep: say what is missing.
 */
export function afterReread(args: {
  hadReading: boolean;
  readUsable: boolean;
}): "replace" | "keep_previous" | "show_ask" {
  if (args.readUsable) return "replace";
  return args.hadReading ? "keep_previous" : "show_ask";
}
