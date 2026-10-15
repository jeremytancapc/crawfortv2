import { afterEach, describe, expect, it, vi } from "vitest";

import { ascendApplyCredit, ascendSubmitIncome } from "./client";

/**
 * Ascend's guide makes `riskStep` a required field on apply/credit and
 * income/credit: 1 is the CREATE-stage check (what the app has always done),
 * 2 the ELIGIBILITY stage, reserved for later. We stop at 1, and say so on
 * the wire rather than relying on the default.
 */

const config = { baseUrl: "https://ascend.test", appId: "10001", secret: "test-secret" };

function sentData(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { data: unknown };
  return (typeof body.data === "string" ? JSON.parse(body.data) : body.data) as Record<string, unknown>;
}

function answering(data: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ code: "10000", msg: "ok", data }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("riskStep", () => {
  it("is sent as 1 on apply/credit", async () => {
    const fetchMock = answering({ orderId: "1", risk: { riskStatus: "PENDING" } });

    await ascendApplyCredit({ desiredAmount: 5000, userId: "9", borrowerMyInfo: {} }, { config });

    expect(sentData(fetchMock).riskStep).toBe(1);
  });

  it("is sent as 1 on income/credit", async () => {
    const fetchMock = answering({ orderId: "1", risk: { riskStatus: "PENDING" } });

    await ascendSubmitIncome(
      { orderId: "1", incomeType: "NON_PANEL_PAYSLIP", m1: 3000, m2: 3000, m3: 3000, incomeFile: true, files: [] },
      { config },
    );

    expect(sentData(fetchMock).riskStep).toBe(1);
  });
});
