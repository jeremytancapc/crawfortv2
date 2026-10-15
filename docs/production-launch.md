# Going to production at get.crawfort.com

Written 2026-10-15. Production today is `main` (last merged 1 Oct). It has **no
database migrations and none of the income-reading code**, so this release is a
large jump, not a small update: a new database, a new S3 bucket, a new Anthropic
key, a new Singpass app setup and a new domain all arrive together.

`get.crawfort.com` is chosen (DNS had no record for it on 14 Oct).
`apply.crawfort.com` is the live app on Vercel and stays as it is until it is
deliberately replaced.

Owner column: **Dev** = engineering, **Ops** = whoever holds the account
(Vercel, AWS, DNS), **Biz** = business sign-off, **Ext** = Singpass, Ascend,
AirConnect, AXS.

## 0. Settle first - these block everything else

| # | Item | Owner |
|---|---|---|
| 0.1 | **Is `apply.crawfort.com` attached to this Vercel project's Production?** If yes, merging `stg` into `main` replaces what is live on `apply.crawfort.com` too, whatever happens on `get`. If you want the old app to stay, `get.crawfort.com` needs its **own Vercel project** (own env vars, own production branch). Decide this before anything is merged. | Dev + Ops |
| 0.2 | Privacy sign-off: applicants' payslips and bank statements (names, NRIC details) are sent to Anthropic's API. PDPA overseas-transfer check, data-handling terms or zero-retention setting, privacy notice update, and whether applicants are told an AI reads their documents. | Biz / DPO |
| 0.3 | A named person confirms each income rule (Wenting's 30 Sep rules, unemployed-with-income counts the CPF payout only, bank statements count all money in for others). | Biz |
| 0.4 | Foreigners: proof of residence was never built. Build it, or launch knowing foreigners cannot prove residence. | Biz + Dev |
| 0.5 | Jeremy's self-declare path was removed in the merge. Confirm nobody needs it at launch (an applicant with no documents at all). | Biz |

## 1. Build the production side

Each item has its own production value. **Nothing is shared with staging.**

| # | Item | How | Owner |
|---|---|---|---|
| 1.1 | **Production database** | New Neon project, separate from staging. Set `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`. Run `npm run db:migrate` against it: `0001` to `0009` all apply, because production has none. Check with `npm run db:status`. | Ops + Dev |
| 1.2 | **Documents bucket** | `scripts/setup-documents-bucket.sh` creates a private bucket. Use an IAM user that can only read, write and delete in that bucket. Set `DOCUMENTS_S3_BUCKET`, `DOCUMENTS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `DOCUMENTS_URL_SECRET`. Without all five, uploads fail. | Ops |
| 1.3 | **Anthropic** | Production API key, a monthly spend limit and an alert. Reads cost about $0.04 each (Opus 5.5, 6 files max). Check the account's rate limits against the volume you expect. Set `ANTHROPIC_API_KEY`. | Ops |
| 1.4 | **Singpass** | Production app in the Singpass developer portal with `https://get.crawfort.com/api/auth/callback` as the registered redirect. Production approval for the `cpfcontributions` and `noahistory` scopes. A **different key pair from staging** (public JWKS pasted into the portal). Production Lambda: `MYINFO_AUTH_URL` must not be a `/stg/` endpoint, and the Lambda needs the production client id and redirect. Set `SINGPASS_ENV=production`, `SINGPASS_CLIENT_ID`, `SINGPASS_REDIRECT_URI`, `SINGPASS_SIG_PRIVATE_JWK`, `SINGPASS_ENC_PRIVATE_JWK`. Start this first: approval is the slowest step and not in our hands. | Ops + Ext |
| 1.5 | **Ascend** | Production credentials: `ASCEND_ENABLED=true`, `ASCEND_BASE_URL=https://api-admin-ascend.crawfort.com`, `ASCEND_APP_ID`, `ASCEND_APP_SECRET`. Agree with Ascend how test applications are marked and cleaned up. Ask them about the two PASS replies without `mlcbMaxLoanAmount` (12 Oct) and what we should do if a PASS never returns a credit limit. | Dev + Ext |
| 1.6 | **AirConnect and AXS** | Production `AIRCONNECT_API_KEY`, `AIRCONNECT_APPOINTMENTS_URL`, `AIRCONNECT_LEADS_URL`, `AXS_PARTNER_API_KEY`, `AXS_TOKEN_SECRET`. | Ops + Ext |
| 1.7 | **App secrets and flags** | `APPLY_SESSION_SECRET` (32+ random characters, unique to production), `CRON_SECRET`, `NEXT_PUBLIC_APP_BASE_URL=https://get.crawfort.com`. **Off:** `MYINFO_EDITOR_ENABLED=false`, `MYINFO_CAPTURE_ENABLED=false`. **Empty:** `TEST_RECOGNISED_BANKS`. App store links if booking uses them. | Dev |
| 1.8 | **Vercel** | Set every variable above in the Production scope only. Add `get.crawfort.com` to the project. In DNS add a record for `get` pointing where Vercel's domain screen says (`apply` uses a Vercel CNAME that is not proxied, so use the same kind of record). Wait for the certificate. | Ops |
| 1.9 | **Cron jobs** | `vercel.json` has none. Schedule `/api/cron/income-documents` (deletes documents added but never submitted, after 7 days) and `/api/cron/ascend-shape` (reports when Ascend changes how it answers). Both need `CRON_SECRET`. Decide where the Ascend alert goes. | Dev |

## 2. Code to settle before the release

| # | Item |
|---|---|
| 2.1 | `app/api/axs/submit/route.ts` falls back to `https://apply.crawfort.com` when `NEXT_PUBLIC_APP_BASE_URL` is unset. A missing variable would send booking links to the old app. Make it fail loudly instead. |
| 2.2 | `npm run check:env` passes (it did on 14 Oct), then `npx vitest run`, `npx next build`. |
| 2.3 | Run the evals once on the exact code being released: `npx tsx --env-file=.env.local evals/run.mts --n 5` (about $4). It must say no case is worse than baseline. |
| 2.4 | The 31 type errors in test files (`lib/credit-score.test.ts`, `lib/singpass-session-budget.test.ts`). They do not affect the build; fix when convenient. |

## 3. Release

1. All of section 1 done. The environment variables are in the Production scope.
2. Database migrated (1.1) **before** the deploy.
3. Open a pull request from `stg` into `main` (the existing PR 1 goes the other way, `main` into `stg`; do not use it). Get Jeremy's approval. `stg` and the release must be the same commit that was tested.
4. Merge. Vercel deploys Production. Open `https://get.crawfort.com` and check the certificate.
5. **Do not announce yet.** Nothing links to `get.crawfort.com` until section 4 passes.

## 4. Smoke test on production, before customers

Production applications are **real**: real Singpass, real Ascend. Use staff with their own accounts, tell Ops and Ascend first, and agree how the test applications are cleaned up.

- [ ] Singpass login with a real account lands on review, with CPF and NOA data shown as received (nothing invented).
- [ ] Income step: a real payslip, a real bank statement from at least two banks, and a Grab-style statement each read correctly. Check on a phone.
- [ ] A document in someone else's name is refused, with the right message.
- [ ] Submit reaches Ascend. The reply is PASS, PENDING or REJECT as expected, and a PASS shows a credit limit.
- [ ] The document link given to Ascend opens (signed link on `get.crawfort.com`), and a changed link does not.
- [ ] Accept, booking and AirConnect/AXS steps work. The booking link in the message starts with `https://get.crawfort.com`.
- [ ] `income_model_calls` has a row for each read, with `retain_until` five years out.
- [ ] The editor routes are closed: `/api/dev/myinfo-edit` and `/api/dev/myinfo-strip` answer with an error, and the Edit NOA / CPF button is absent.
- [ ] Both cron routes answer with the right secret and refuse without it.

## 5. Watch, and be ready to back out

- **First week:** daily look at `income_model_calls` (refusals, `max_tokens`, read failures, cost), the Ascend watch, Anthropic spend and Vercel errors.
- **Back out:** Vercel Instant Rollback to the previous production deployment. The database changes only add tables, so a rollback leaves them in place harmlessly. Write down who may press it and what triggers it.
- **Later:** schedule the 2031 clean-up for `income_model_calls` (GitHub issue 11); decide when `apply.crawfort.com` moves to the new app, and redirect one name to the other.
