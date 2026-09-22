import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pushAppointmentToAirConnect, pushNewLeadToAirConnect } from "./notify";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubEnv("AIRCONNECT_API_KEY", "test-key-123");
  vi.stubEnv("AIRCONNECT_LEADS_URL", "https://airconnect.test/api/ascend/leads/manualverify");
  vi.stubEnv("AIRCONNECT_APPOINTMENTS_URL", "https://airconnect.test/api/appointments/ascend");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

vi.mock("@/lib/external-api-logger", () => ({
  logExternalApi: vi.fn(),
}));

function mockResponse(status = 200, body = "{}") {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  });
}

describe("pushNewLeadToAirConnect", () => {
  const PAYLOAD = {
    applicantId: "11111111-2222-3333-4444-555566667777",
    customerName: "Tan Ah Kow",
    phoneNumber: "+6591234567",
  };

  it("posts to the leads URL with x-api-key auth and no cfh5Id/leadId/loanAmount", async () => {
    mockResponse(200);

    const ok = await pushNewLeadToAirConnect(PAYLOAD);

    expect(ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://airconnect.test/api/ascend/leads/manualverify");
    expect(init.headers).toMatchObject({ "x-api-key": "test-key-123" });
    expect(init.headers).not.toHaveProperty("apikey");

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      app: "cfh5",
      customerName: "Tan Ah Kow",
      phoneNumber: "+6591234567",
    });
  });

  it("includes idNumber only when provided", async () => {
    mockResponse(200);

    await pushNewLeadToAirConnect({ ...PAYLOAD, idNumber: "S1234567A" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.idNumber).toBe("S1234567A");
  });

  it("no-ops and returns false when the leads URL is not configured", async () => {
    vi.stubEnv("AIRCONNECT_LEADS_URL", "");

    const ok = await pushNewLeadToAirConnect(PAYLOAD);

    expect(ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("no-ops and returns false when the API key is not configured", async () => {
    vi.stubEnv("AIRCONNECT_API_KEY", "");

    const ok = await pushNewLeadToAirConnect(PAYLOAD);

    expect(ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false on a non-2xx response without throwing", async () => {
    mockResponse(500, "internal error");

    expect(await pushNewLeadToAirConnect(PAYLOAD)).toBe(false);
  });

  it("returns false on a network error without throwing", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));

    expect(await pushNewLeadToAirConnect(PAYLOAD)).toBe(false);
  });
});

describe("pushAppointmentToAirConnect", () => {
  const PAYLOAD = {
    applicantId: "11111111-2222-3333-4444-555566667777",
    customerName: "Tan Ah Kow",
    phoneNumber: "+6591234567",
    appointmentDate: "2026-09-25",
    timeSlot: "10:30 am",
  };

  it("posts to the appointments URL with no query params and no cfh5Id/leadId/loanAmount", async () => {
    mockResponse(200);

    const ok = await pushAppointmentToAirConnect(PAYLOAD);

    expect(ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://airconnect.test/api/appointments/ascend");
    expect(init.headers).toMatchObject({ "x-api-key": "test-key-123" });

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      app: "cfh5",
      customerName: "Tan Ah Kow",
      phoneNumber: "+6591234567",
      appointmentDate: "2026-09-25",
      timeSlot: "10:30 am",
    });
  });

  it("no-ops and returns false when the appointments URL is not configured", async () => {
    vi.stubEnv("AIRCONNECT_APPOINTMENTS_URL", "");

    const ok = await pushAppointmentToAirConnect(PAYLOAD);

    expect(ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
