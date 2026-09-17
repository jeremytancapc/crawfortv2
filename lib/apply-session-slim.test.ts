import { describe, expect, it } from "vitest";

import { buildActivateSessionCookie, buildActivateToken } from "./apply-session-slim";
import { decodeSession, encodeSession } from "./apply-session-codec";

const MERGED = {
  amount: 5000,
  tenure: 6,
  authMethod: "singpass" as const,
  fullName: "FELICIA TAN WEI LIN",
  nric: "S7790721A",
  singpassRawKey: "6dc1a401-1fd7-453f-92ee-84f509fd1ecb",
};

describe("buildActivateSessionCookie", () => {
  it("carries the applicant id, so submit can find them without the cookie", () => {
    // draft_lead is set on a response the browser reaches by a cross-site
    // redirect from the Lambda, and does not always survive it. When it is
    // lost, submit cannot tell a returning applicant from a new one and
    // inserts a second row - leaving the first stranded as `in_progress`.
    const session = buildActivateSessionCookie(MERGED, "a8b03c68-7b2f-4c62-a7b4-bccdb724cbf1");

    expect(session.leadId).toBe("a8b03c68-7b2f-4c62-a7b4-bccdb724cbf1");
  });

  it("survives the cookie round trip", () => {
    const session = buildActivateSessionCookie(MERGED, "a8b03c68-7b2f-4c62-a7b4-bccdb724cbf1");
    const decoded = decodeSession(encodeSession(session));

    expect(decoded?.leadId).toBe("a8b03c68-7b2f-4c62-a7b4-bccdb724cbf1");
  });

  it("omits the id entirely when there is no applicant yet", () => {
    // An applicant without an amount never gets a row at activate, and a
    // leadId of "" would read as present and send submit looking for nothing.
    const session = buildActivateSessionCookie(MERGED, null);

    expect(session).not.toHaveProperty("leadId");
  });

  it("still drops the heavy MyInfo arrays", () => {
    const session = buildActivateSessionCookie(MERGED, "a8b03c68-7b2f-4c62-a7b4-bccdb724cbf1");

    // The cookie has a ~4 KB budget; CPF and NOA are re-read from the database.
    expect(session.cpfContributions).toEqual([]);
    expect(session.noaHistory).toEqual([]);
  });
});

describe("buildActivateToken", () => {
  it("leaves the CPF and NOA arrays out", () => {
    const token = buildActivateToken(
      { fullName: "FELICIA TAN WEI LIN", cpfContributions: [{ month: "2026-02", amount: 2516, employer: "X", paidOn: "2026-02-01" }], noaHistory: [] },
      "6dc1a401-1fd7-453f-92ee-84f509fd1ecb",
    );

    expect(token.cpfContributions).toEqual([]);
    expect(token.noaHistory).toEqual([]);
  });

  it("keeps the key that lets activate fetch them back", () => {
    const token = buildActivateToken({}, "6dc1a401-1fd7-453f-92ee-84f509fd1ecb");

    expect(token.singpassRawKey).toBe("6dc1a401-1fd7-453f-92ee-84f509fd1ecb");
  });

  it("encodes small enough to survive a URL", () => {
    // It travels as a query parameter. Some proxies and older browsers
    // truncate past ~2000 bytes, and a truncated token fails to verify
    // rather than arriving short.
    const patch = {
      fullName: "FELICIA TAN WEI LIN",
      nric: "S7790721A",
      address: "288A JURONG EAST STREET 21 #8-367",
      email: "myinfotesting@gmail.com",
      cpfContributions: Array.from({ length: 15 }, (_, i) => ({
        month: `2026-${String(i + 1).padStart(2, "0")}`,
        amount: 2516,
        employer: "1Aaaaaaaa 2AAAAAAAA 3AAAAAAAA 4AAAAAAAA 5AAAAAAAA",
        paidOn: `2026-${String(i + 1).padStart(2, "0")}-01`,
      })),
      noaHistory: [],
    };

    const encoded = encodeSession(buildActivateToken(patch, "6dc1a401-1fd7-453f-92ee-84f509fd1ecb"));
    expect(encoded.length).toBeLessThan(2000);
  });
});
