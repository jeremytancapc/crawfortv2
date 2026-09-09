import { redirect } from "next/navigation";

import { enforceApplyFunnel } from "@/lib/apply-funnel-enforce";
import { applyRedirectPath } from "@/lib/apply-variant-server";
import { getBookingConfirmation } from "@/lib/booking-confirmation";

import { BookedScreen } from "./booked-screen";

export const dynamic = "force-dynamic";

export default async function V2BookedPage() {
  await enforceApplyFunnel("/apply/booked");

  const booking = await getBookingConfirmation();
  if (!booking) redirect(await applyRedirectPath("/"));

  return <BookedScreen booking={booking} />;
}
