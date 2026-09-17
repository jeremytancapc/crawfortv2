# Ascend Open API

Reference for the endpoints this funnel uses. Ascend is the lending system of
record: it owns the credit decision and, once an application exists, the loan
(see `docs/adr/0001-ascend-owns-the-borrowable-amount.md`).

Transcribed from the Ascend Open API documentation. Where behaviour was
established against the live endpoint rather than written in the spec, it is
marked **(observed)** — those are the ones that cost time to rediscover.

## Environments

| Name | Base URL |
| --- | --- |
| test | `https://api-mms.newtime.top` |
| uat  | `https://api-admin-uat-ascend.crawfort.com` |
| prod | `https://api-admin-ascend.crawfort.com` |

**(observed)** Our credentials are accepted by `test` only; `uat` answered 401
when last smoke-tested. That is why `ASCEND_BASE_URL` is an environment
variable rather than derived from a name.

## Request envelope

Every call is a POST carrying the same five fields:

| Field | Type | Notes |
| --- | --- | --- |
| `appId` | string | |
| `timestamp` | string | Unix **milliseconds**. Rejected if more than 5 minutes from Ascend's clock. |
| `nonce` | string | Fresh per request. |
| `sign` | string | See below. |
| `data` | object | The endpoint-specific payload. |

### Signing

HMAC-SHA256 over the request parameters:

1. Exclude `sign` itself.
2. Drop parameters that are null or empty.
3. Sort keys by ASCII, ascending.
4. Join as `key=value` with `&`.
5. HMAC-SHA256 with the shared secret.

Three details are **(observed)**, and each fails the call on its own:

- The digest is **uppercase hex**. Lowercase or base64 returns code `600`.
- `data` participates in the signed string **as its JSON string**. Omitting it
  returns `600`.
- `data` is sent in the body as an **object**, not as that string. Sending the
  string returns `505`.

The last two together are the trap: one field is a string when signed and an
object when sent, so both must come from a single serialisation. Implemented in
`lib/ascend/sign.ts`.

### Response envelope

```json
{ "code": "10000", "msg": "The operation succeeded", "data": {} }
```

`code` is a **string**, and `"10000"` — not `"200"` — means success.

## The funnel sequence

Order matters, and two steps are expensive.

```
1. /openApi/users          idNumber + phone  → userId, newCustomer, hasMyinfo
   └─ newCustomer = false → Reloan Customer, leaves the web funnel here.
      No order is created and no credit pull is spent (ADR-0001).

2. /openApi/apply/credit   myinfo OR userId, desiredAmount
   → orderId, risk.riskStatus, creditScore{...}, newCustomer
   └─ NOT a quote. It creates an Order. Once per applicant, guarded by a
      persisted orderId — enforced by ascend_orders.applicant_id UNIQUE.

3. /openApi/query/credit   orderId          → poll while riskStatus = PENDING

4. /openApi/income/credit  income + orderId + orderFile   (when income needed)

5. /openApi/docusign       multipart; signing
6. /openApi/lending        orderId; disbursement (only after signing)
```

## Endpoints

### `/openApi/users` — identify the applicant

`data`: `idNumber` (from MyInfo), `phone`.

Returns `userId`, `newCustomer` (boolean), `hasMyinfo` (boolean).

This both looks up and **creates** the user in Ascend, returning the `userId`
that `/openApi/apply/credit` later consumes. So it is cheap but not free of
side effects: it is the authority on New vs Reloan, and its `userId` must be
passed onward rather than re-derived.

**(observed)** `hasMyinfo` is not static, and submitting MyInfo to
`/openApi/apply/credit` sets it. A first application must send the whole
`myinfo` object; afterwards Ascend holds it and `userId` alone is enough. So
the `userId`-only failure (`600: The user has not authorized myinfo`) is
self-healing rather than permanent, and a returning applicant can be
identified with a request 8.6 KB smaller.

### `/openApi/apply/credit` — the credit decision

`data`: `desiredAmount` (required), and **either** `myinfo` (the object) **or**
`userId` — one of the two is required. `userId` only works if that user has
authorised MyInfo. Optional `sccb`, `mlcb` (Ascend fetches them if omitted),
`remark`.

Returns:

| Field | Meaning |
| --- | --- |
| `orderId` | The Order. Signing and disbursement consume it. |
| `userId` | |
| `newCustomer` | |
| `risk.riskStatus` | `PASS` / `PENDING` / `REJECT` |
| `risk.riskMsg` | Present when `REJECT` |
| `creditScore.creditLimit` | **A-Card Limit** — what Ascend will lend |
| `creditScore.mlcbMaxLoanAmount` | **Maximum Loan Quantum** — MLCB ceiling |
| `creditScore.creditLevel` | |
| `creditScore.creditScore` | |

`PENDING` is returned when there is no income on file — that is the case the
credit-review queue exists for, not an error.

### `/openApi/query/credit` — re-check a PENDING order

`data`: `orderId`. Same response shape as apply.

### `/openApi/income/credit` — submit income

`data`: `orderId`, `income`, `orderFile[]`.

`income`: `incomeType`, `documentTypes[]`, `incomeFile` (boolean, "is this
credible income"), `m1`/`m2`/`m3` (previous three months), `monthlyIncome`,
`yearlyIncome`.

`incomeType` / `fileType` enum: `CPF`, `NOA`, `PANEL_PAYSLIP`,
`NON_PANEL_PAYSLIP`, `BANK_STATEMENT_OTHER_INCOME`, `INCOME_STATEMENT`.

### Supporting endpoints

| Endpoint | Purpose |
| --- | --- |
| `/openApi/user/myinfo` | Fetch stored MyInfo by `userId`. **(observed)** 404s on `test` |
| `/openApi/user/sccb` | SCCB record. Requires MyInfo authorised or passed in |
| `/openApi/user/mlcb` | MLCB record. Needs `myinfo`, `income`, `expectedAmount` |
| `/openApi/singPass/v5/authUrl` | Ascend's own MyInfo v5 authorisation URL |
| `/openApi/file/upload` | multipart; returns a file URL |
| `/openApi/order/file/relate` | Attach an uploaded file to an order |
| `/openApi/order/comments` | Free-text note against an order. **(observed)** Validates the order (`600: order not found`); accepts more than one per order, but there is no read-back endpoint so append-vs-overwrite is unconfirmed |
| `/openApi/orderList` | GET, paginated. `ACTIVE` / `OVERDUE` / `SETTLED` |
| `/openApi/docusign` | multipart; initiate signing |
| `/openApi/docusign/notify` | Signing callback (`xmlData`) |
| `/openApi/lending` | Disburse. Only after signing |
| `/openApi/dbsQrcode` | Repayment QR as base64 |
| `/openApi/getCallbackStatus` | GET; payment result boolean |

## Identity: Ascend keys on `sub`, not the NRIC

**(observed)** `/openApi/apply/credit` resolves the user from the MyInfo
`sub` claim — the Singpass UUID — and not from `uinfin`.

Established by submitting a payload with a changed NRIC but the original
`sub`, which came back as the **original** `userId`. Changing `sub` as well
produced a new one. By contrast `/openApi/users`, which has no `sub` to work
from, creates a distinct user per NRIC.

Two consequences:

- Test personas are not separated by editing the NRIC. Change `sub` too, or
  every fabricated applicant collapses into one Ascend user — which is exactly
  what happened while testing this, and briefly looked like Ascend ignoring
  identity altogether.
- **FAPI 2.0 changed the shape of `sub`.** It used to be
  `s=<NRIC>,u=<UUID>`; under the new API it is the bare UUID. If the legacy
  Lambda and the FAPI 2.0 Lambda hand Ascend different `sub` values for the
  same person, Ascend will see two users — a duplicate customer, and a
  returning borrower wrongly reported as `newCustomer: true`. Worth confirming
  against a person who exists under both before production.

## Order status gates income

**(observed)** `/openApi/income/credit` is rejected with
`600: order status is not CREATE or ELIGIBILITY` once an order has passed. It
applies only while the order is still awaiting income, which is the PENDING
path:

```
apply/credit (no CPF/NOA)  → PENDING, riskMsg "There is no income, please submit income"
                             creditScore is {} — every field undefined
income/credit (m1/m2/m3)   → PASS, creditLimit 2000, mlcbMaxLoanAmount 21000
```

`riskMsg` is documented as REJECT-only but is present on PENDING too.

Note the limits differ sharply by income source: the same desired amount
returned an A-Card Limit of 8000 from CPF/NOA data, and 2000 from declared
payslip figures.

## Error codes

| Code | Meaning |
| --- | --- |
| `10000` | Success |
| `600` | Busy, already funded, MLCB API error — **(observed)** also a bad signature |
| `502` | Parameter error |
| `20044` | Order signing record not found (not signed) |
| `20059` | Borrower has no payment account |

## Notes for implementers

- `/openApi/singPass/v5/authUrl` means Ascend can run the MyInfo authorisation
  itself. We currently use our own Lambda instead. Worth knowing the
  alternative exists before building more of our own.
- `orderId` values are large numeric strings (e.g. `1523633858296446976`).
  Beyond `Number.MAX_SAFE_INTEGER` — keep them as strings end to end.
- `riskStatus` is UPPERCASE on the wire (`PASS`), which is not the spelling
  used in `CONTEXT.md` (passed / pending / rejected). Map at the boundary.
- **(observed)** The A-Card Limit can EXCEED the Desired Amount: asking for
  5000 returned a limit of 8000. Never show the requested figure as though it
  were the offer.
- **(observed)** `creditScore` is fractional (588.26), not an integer.
