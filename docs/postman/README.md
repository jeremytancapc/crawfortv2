# Ascend Open API — Postman diagnostics

Import `ascend.postman_collection.json` and one of the environment files.
Fill in `appId` and `appSecret`. Work through the folders in order.

Every request's **Test tab** prints a plain-English verdict in the Postman
console, so you can tell where the problem is before asking anyone.

## Order of work

| Folder | Question it answers |
| --- | --- |
| **0. Auth** | Is this appId/secret accepted at all? |
| **1. Known-good** | Do the calls that were working still work? |
| **2. file/upload** | Does upload fail differently from everything else? |

**Start with 0.** `0a` sends no credentials, establishing what a rejected
request looks like. `0b` sends yours. If both return the same thing, your
credentials are being treated as absent and nothing further can be concluded.

## Reading the codes

| Code | Means |
| --- | --- |
| `10000` | Success |
| `401` | Not authenticated. An **unsigned** request returns this too |
| `600` | Business error — **and** what a bad signature returns. Read `msg` |
| `502` | Parameter error. The request was understood; the payload is wrong |
| `500` | Their system error. Not a signature problem — that returns 600 |
| `404` | Endpoint not present on this environment |

That distinction is the whole value of the collection. A `500` on
`file/upload` while `0b` returns `10000` means the endpoint is at fault and
your signing is not, and nobody has to take your word for it.

## What has been observed, and when

On 2026-09-17, against `test`:

| | `0b` / `users` | `file/upload` |
| --- | --- | --- |
| Earlier | `10000` | `500 System error` |
| Later | `401` | `401` |

While the control was succeeding, the `500` was specific to `file/upload` —
same credentials, same signing, different result.

The later `401` applies to **every** endpoint including the control, and to
`test`, `uat` and `prod` alike. That is a separate problem: the credentials
stopped being accepted. Ruled out: clock skew (zero against Ascend's own
`Date` header), stray whitespace or quotes in the secret, and nonce reuse.

Worth knowing: the `appId` in use is **`10001`**, which is the value in
Ascend's own documentation example. It did work earlier. If their recent
update retired a shared demo credential, that would explain all of it.

## Why upload matters

`/openApi/income/credit` refuses income with no documents behind it:

```
600: orderFile is required
```

`orderFile` takes the URLs `file/upload` returns. Until it works, an applicant
Ascend leaves `PENDING` — *"There is no income, please submit income"* —
cannot finish their application. That is the entire payslip path.

## Things to be careful with

- **`1a` creates a user.** `/openApi/users` is not read-only.
- **`1b` creates an Order** and spends a credit pull. Once per applicant.
- Each request signs freshly. Reusing a `nonce` returns `401`, which reads
  like bad credentials and is not — it cost us an hour.

## Without Postman

```bash
node scripts/ascend-call.mjs users --nric S7790721A --phone 91234567
node scripts/ascend-upload-probe.mjs <userId> <path-to-file>
```

Both read credentials from `.env.local`.
