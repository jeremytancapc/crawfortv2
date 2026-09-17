# Ascend `/openApi/file/upload` — reproduction

`/openApi/file/upload` answers `{"code":"500","msg":"System error"}` on the
`test` environment for every request shape and every file type tried.

This collection exists to show that from the outside, without anyone having to
take our word for the signing being right.

## Read this first

Two separate states have been observed on `test`, hours apart on 2026-09-17:

| | `/openApi/users` (control) | `/openApi/file/upload` |
| --- | --- | --- |
| Earlier | `10000` success | `500 System error` |
| Later | `401 Authentication failed` | `401 Authentication failed` |

While the control was succeeding, the 500 was specific to `file/upload` - same
credentials, same signing code, different result. That is the finding worth
raising.

The later 401 applies to **every** endpoint including the control, so it is a
separate problem: the credentials themselves stopped being accepted. Local
clock skew against Ascend's own `Date` header was zero, so it is not the
five-minute timestamp window.

**Run the control first.** If it returns 401, the credentials need sorting out
before anything can be concluded about the upload.

## Using it

1. Import `ascend-file-upload.postman_collection.json`.
2. Set `appId` and `appSecret` in the collection variables. `baseUrl` already
   points at `test`.
3. Run **1. users (CONTROL)**. It should return `code: 10000` and captures a
   real `userId` for the next request.
4. Attach any PDF, JPG or PNG to the `file` field of **2. file/upload** and
   run it.

Both requests are signed by the same collection-level pre-request script. That
is the point: if the control succeeds and the upload returns 500, the
credentials and the signature are not the difference.

## What was already ruled out

Every one of these returns the same `500 System error`:

| Varied | Tried |
| --- | --- |
| Envelope | documented `fileInfo`; signed envelope with `data`; both together; fileInfo flattened into separate form fields; no envelope at all |
| File type | PDF, a real PNG, plain text |
| File size | 70 bytes to a few KB |

A malformed request returns `502 Parameter error` by Ascend's own error table,
and a bad signature returns `600`. A `500` across every shape points at the
endpoint rather than the caller.

The same environment returns `404` for `/openApi/user/myinfo`, which is also
documented.

## Why it matters

`/openApi/income/credit` refuses income with no documents behind it:

```
600: orderFile is required
```

`orderFile` takes the URLs `file/upload` returns. So until upload works, an
applicant Ascend leaves `PENDING` — "There is no income, please submit income"
— cannot complete their application at all. That is the whole payslip path.

## Without Postman

`scripts/ascend-upload-probe.mjs` does the same from the command line, trying
each request shape in turn:

```bash
node scripts/ascend-upload-probe.mjs <userId> <path-to-file>
```

It reads credentials from `.env.local`.
