import { setDeclineReason } from "@/lib/db/applicants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { leadId, reason } = (await request.json()) as {
      leadId?: string;
      reason?: string;
    };

    if (!leadId || !reason) {
      return new Response("Missing leadId or reason", { status: 400 });
    }

    await setDeclineReason(leadId, reason);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[decline-reason]", err);
    return new Response("Server error", { status: 500 });
  }
}
