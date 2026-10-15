/**
 * Smoke-test one Ascend Open API endpoint from the command line.
 *
 *   node scripts/ascend-call.mjs users --nric S7790721A --phone 91234567
 *   node scripts/ascend-call.mjs query --orderId 1523633858296446976
 *
 * Credentials come from .env.local, so this file holds no secrets and is safe
 * to commit - unlike the ad-hoc scripts .gitignore still excludes.
 *
 * It imports lib/ascend/sign.ts directly, because signing is the part with
 * the three undocumented rules that are expensive to get wrong, and a second
 * copy of it would drift. The envelope handling below is duplicated from
 * client.ts on purpose: Node's ESM resolver will not follow that module's
 * extensionless imports, and contorting application code to suit a smoke test
 * is the wrong way round.
 *
 * `users` CREATES the user in Ascend, so it prompts before firing.
 */

import { createInterface } from "node:readline/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { buildSignedRequest } = await import(join(ROOT, "lib/ascend/sign.ts"));

const config = {
  baseUrl: (process.env.ASCEND_BASE_URL ?? "").replace(/\/+$/, ""),
  appId: process.env.ASCEND_APP_ID ?? "",
  secret: process.env.ASCEND_APP_SECRET ?? "",
};

const missingNames = [
  !config.baseUrl && "ASCEND_BASE_URL",
  !config.appId && "ASCEND_APP_ID",
  !config.secret && "ASCEND_APP_SECRET",
].filter(Boolean);

if (missingNames.length) {
  console.error(`Missing from .env.local: ${missingNames.join(", ")}`);
  console.error("\nAdd them yourself - do not paste the secret into a chat.");
  process.exit(1);
}

console.log(`▸ ${config.baseUrl}  appId=${config.appId}\n`);

async function callAscend(path, data) {
  const body = buildSignedRequest(data, config);
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}, non-JSON response: ${text.slice(0, 200)}`);
  }
  if (envelope.code !== "10000") {
    const extra = envelope.code === "600" ? "  (600 is also what a bad signature returns)" : "";
    throw new Error(`${envelope.code}: ${envelope.msg}${extra}`);
  }
  return envelope.data;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function confirm(question) {
  if (process.argv.includes("--yes")) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y/i.test(answer);
}

try {
  const command = process.argv[2];

  if (command === "users") {
    const idNumber = arg("nric");
    const phone = arg("phone");
    if (!idNumber || !phone) {
      console.error("usage: users --nric <NRIC> --phone <phone>");
      process.exit(1);
    }
    console.log("/openApi/users CREATES the user in Ascend and returns the userId");
    console.log("that /openApi/apply/credit later consumes. This is not read-only.\n");
    if (!(await confirm(`Call /openApi/users for ${idNumber} / ${phone}?`))) {
      console.log("Aborted.");
      process.exit(0);
    }
    const data = await callAscend("/openApi/users", { idNumber, phone });
    console.log(`\n${JSON.stringify(data, null, 2)}\n`);
    console.log(`  userId:      ${data.userId}`);
    console.log(
      `  newCustomer: ${data.newCustomer}  → ${data.newCustomer ? "New Customer" : "RELOAN - leaves the web funnel"}`,
    );
    console.log(`  hasMyinfo:   ${data.hasMyinfo}`);
  } else if (command === "apply") {
    const amount = Number(arg("amount"));
    const userId = arg("userId");
    const myinfoPath = arg("myinfo");

    if (!amount || (!userId && !myinfoPath)) {
      console.error("usage: apply --amount <n> [--userId <id>] [--myinfo <path-to-json>]");
      console.error("       one of --userId or --myinfo is required");
      process.exit(1);
    }

    const data = { desiredAmount: amount };
    if (userId) data.userId = userId;
    if (myinfoPath) {
      const raw = JSON.parse(readFileSync(myinfoPath, "utf8"));
      // Accept either a bare MyInfo object or the {myinfo:{...}} envelope.
      data.myinfo = raw.myinfo ?? raw;
    }

    console.log("/openApi/apply/credit is NOT a quote. It creates an Order and");
    console.log("spends a credit pull. ADR-0001: once per applicant.\n");
    console.log(`  desiredAmount: ${amount}`);
    console.log(`  userId:        ${userId ?? "(not sent)"}`);
    console.log(`  myinfo:        ${myinfoPath ? `${myinfoPath} (${JSON.stringify(data.myinfo).length} bytes)` : "(not sent)"}\n`);

    if (!(await confirm("Create an Order?"))) {
      console.log("Aborted.");
      process.exit(0);
    }

    const result = await callAscend("/openApi/apply/credit", data);
    console.log(`\n${JSON.stringify(result, null, 2)}\n`);
    console.log(`  orderId:              ${result.orderId}`);
    console.log(`  riskStatus:           ${result.risk?.riskStatus}${result.risk?.riskMsg ? `  (${result.risk.riskMsg})` : ""}`);
    console.log(`  A-Card Limit:         ${result.creditScore?.creditLimit}`);
    console.log(`  Maximum Loan Quantum: ${result.creditScore?.mlcbMaxLoanAmount}`);
    console.log(`  newCustomer:          ${result.newCustomer}`);
    if (result.risk?.riskStatus === "PENDING") {
      console.log("\n  PENDING means Ascend has no income on file - that is the");
      console.log("  credit-review queue case, not an error. Re-check with:");
      console.log(`    npm run ascend -- query --orderId ${result.orderId}`);
    }
  } else if (command === "myinfo") {
    // Read-only: fetches what Ascend already holds for this user.
    const userId = arg("userId");
    if (!userId) {
      console.error("usage: myinfo --userId <id>");
      process.exit(1);
    }
    const data = await callAscend("/openApi/user/myinfo", { userId });
    const mi = data.myinfo ?? {};
    const value = (k) => mi[k]?.value ?? mi[k]?.nbr?.value ?? "(absent)";
    console.log(`  userId:    ${data.userId}`);
    console.log(`  fields:    ${Object.keys(mi).length}`);
    console.log(`  uinfin:    ${value("uinfin")}`);
    console.log(`  name:      ${value("name")}`);
    console.log(`  dob:       ${value("dob")}`);
    console.log(`  noa rows:  ${mi.noahistory?.noas?.length ?? 0}`);
    console.log(`  cpf months:${mi.cpfcontributions?.history?.length ?? 0}`);
    if (process.argv.includes("--full")) console.log(`\n${JSON.stringify(mi, null, 2)}`);
  } else if (command === "income") {
    // Stands in for: customer uploads a payslip, AI extracts the figures.
    // The numbers are passed in directly here - the extraction step is not
    // what is being tested.
    const orderId = arg("orderId");
    const m1 = Number(arg("m1"));
    const m2 = Number(arg("m2"));
    const m3 = Number(arg("m3"));
    const incomeType = arg("type") ?? "PANEL_PAYSLIP";

    if (!orderId || !m1 || !m2 || !m3) {
      console.error("usage: income --orderId <id> --m1 <n> --m2 <n> --m3 <n> [--type PANEL_PAYSLIP]");
      process.exit(1);
    }

    const monthlyIncome = Number(((m1 + m2 + m3) / 3).toFixed(2));
    const data = {
      orderId,
      income: {
        incomeType,
        documentTypes: [incomeType],
        // "credible income" - whether a document backs these figures.
        incomeFile: true,
        m1,
        m2,
        m3,
        monthlyIncome,
        yearlyIncome: Number((monthlyIncome * 12).toFixed(2)),
      },
      orderFile: [
        {
          fileType: incomeType,
          fileName: arg("fileName") ?? "payslip.pdf",
          fileUrl: arg("fileUrl") ?? "https://example.invalid/payslip.pdf",
        },
      ],
    };

    console.log(`  orderId:       ${orderId}`);
    console.log(`  incomeType:    ${incomeType}`);
    console.log(`  m1/m2/m3:      ${m1} / ${m2} / ${m3}`);
    console.log(`  monthlyIncome: ${monthlyIncome}   yearly: ${data.income.yearlyIncome}`);
    console.log(`  orderFile:     ${data.orderFile[0].fileUrl}\n`);

    if (!(await confirm("Submit income against this order?"))) {
      console.log("Aborted.");
      process.exit(0);
    }

    const result = await callAscend("/openApi/income/credit", data);
    console.log(`\n${JSON.stringify(result, null, 2)}\n`);
    console.log(`  riskStatus:           ${result.risk?.riskStatus}${result.risk?.riskMsg ? `  (${result.risk.riskMsg})` : ""}`);
    console.log(`  A-Card Limit:         ${result.creditScore?.creditLimit}`);
    console.log(`  Maximum Loan Quantum: ${result.creditScore?.mlcbMaxLoanAmount}`);
  } else if (command === "comment") {
    const orderId = arg("orderId");
    const comments = arg("text");
    if (!orderId || !comments) {
      console.error('usage: comment --orderId <id> --text "..."');
      process.exit(1);
    }
    console.log(`  orderId: ${orderId}`);
    console.log(`  text:    ${comments}\n`);
    // callAscend throws unless code is "10000", so reaching here IS the
    // success signal. `data` is {} by design, which reads like a failure if
    // printed raw.
    const result = await callAscend("/openApi/order/comments", { orderId, comments });
    console.log(`  ✓ accepted (code 10000, data ${JSON.stringify(result ?? {})})`);
  } else if (command === "query") {
    const orderId = arg("orderId");
    if (!orderId) {
      console.error("usage: query --orderId <id>");
      process.exit(1);
    }
    console.log(JSON.stringify(await callAscend("/openApi/query/credit", { orderId }), null, 2));
  } else {
    console.error("commands: users, apply, income, comment, myinfo, query");
    process.exit(1);
  }
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
}
