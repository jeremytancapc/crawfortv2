/**
 * The page staff open in Ascend to review an order that needs a person.
 *
 * Not a guess: it is the shape Ascend itself puts on AirConnect's leads. Read
 * from AirConnect's production database on 2026-10-16, all 869 of its
 * verification links (27 Jun 2025 to that day) are exactly
 *
 *   https://api-admin-ascend.crawfort.com/order/pending/notify?orderId=<orderId>
 *
 * - the same host as Ascend's API, and the order id alone. AirConnect shows it
 * to agents as a "Verify in Ascend" button.
 */

export function ascendOrderReviewLink(
  orderId: string,
  baseUrl: string | undefined = process.env.ASCEND_BASE_URL,
): string | null {
  const base = (baseUrl ?? "").trim().replace(/\/+$/, "");
  // Order ids are long plain numbers. Anything else is not put into a URL.
  if (!base || !/^\d{6,}$/.test(orderId)) return null;
  return `${base}/order/pending/notify?orderId=${orderId}`;
}
