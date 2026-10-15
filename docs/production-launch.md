# Going to production at get.crawfort.com

Written 2026-10-15. Production today is `main` (last merged 1 Oct). It has **no
database migrations and none of the income-reading code**, so this release is a
large jump, not a small update: a new database, a new S3 bucket, a new Anthropic
key, a new Singpass app setup and a new domain all arrive together.

`get.crawfort.com` is chosen (DNS had no record for it on 14 Oct).
`apply.crawfort.com` is a different app and is not part of this release.

Owner column: **Dev** = engineering, **Ops** = whoever holds the account
(Vercel, AWS, DNS), **Biz** = business sign-off, **Ext** = Singpass, Ascend,
AirConnect, AXS.

## 0. Settle first - these block everything else

| # | Item | Owner |
|---|---|---|
| 0.1 | `get.crawfort.com` is already attached to this project (15 Oct: it resolves to Vercel and serves the old `main` build). Confirm in the Vercel dashboard that the **Production branch is `main`**. (`apply.crawfort.com` is a different app and is not touched.) | Ops |
| 0.2 | Privacy. **Disclosure is covered:** the website terms already say applicants' documents are processed this way before they onboard (Caken, 15 Oct). Still unchecked: Anthropic's data-handling terms for the API (what they keep, and for how long) against our own retention. | Biz / DPO |
| 0.3 | Income rules signed off by name: every rule in [income-rules-signoff.md](income-rules-signoff.md) has an owner and a date. | Biz |
| 0.4 | Foreigners: proof of residence is deferred (Caken, 15 Oct: "we will wait first"). Launch with foreigners going through the same steps as everyone else. | Biz |
| 0.5 | Applicants with no documents are **not allowed to pass** (Caken, 15 Oct). Jeremy's skip and self-declare are removed; the form has no skip. | Decided |

## 1. Build the production side

Each item has its own production value. **Nothing is shared with staging.**

| # | Item | How | Owner |
|---|---|---|---|
| 1.1 | **Production database** | **Done 15 Oct.** Neon endpoint `ep-winter-waterfall-b32synfg` (Postgres 18.6), empty (0 applicants). The full schema was already there but untracked; it was compared with a database built from `0001`-`0009` (identical apart from Postgres 18's NOT NULL constraints and `fips_mode`), then `0001`-`0009` were recorded in `schema_migrations`. `node scripts/db-migrate.mjs --status` says nothing pending. Future migrations: run `db-migrate.mjs` with the production URLs **before** deploying the code that needs them. | Ops + Dev |
| 1.2 | **Documents bucket** | Run `scripts/setup-documents-bucket-prod.sh` with the **production** AWS account's administrator login: first with no options (a dry run that shows the account), then with `--apply --account <number>`. It creates `crawfort-applicant-documents-prod` (private, versioned, encrypted), a lifecycle that really removes deleted files after 14 days (without it, a deleted document's bytes stay in a versioned bucket for ever), a user that can only read, write and delete in that bucket, and writes the new key into `.env.vercel-production` without printing it. | Ops |
| 1.3 | **Anthropic** | Production API key, a monthly spend limit and an alert. Reads cost about $0.04 each (Opus 5.5, 6 files max). Check the account's rate limits against the volume you expect. Set `ANTHROPIC_API_KEY`. | Ops |
| 1.4 | **Singpass** | Production app in the Singpass developer portal with `https://get.crawfort.com/api/auth/callback` as the registered redirect. Production approval for the `cpfcontributions` and `noahistory` scopes. A **different key pair from staging** (public JWKS pasted into the portal). Production Lambda: `MYINFO_AUTH_URL=https://lss57v8zd2.execute-api.ap-southeast-1.amazonaws.com/prod/auth` (given 15 Oct; a `/prod/` endpoint, not `/stg/`). The Lambda is not in this repo: whoever owns it must confirm it uses the production client id and posts the MyInfo payload to `https://get.crawfort.com/api/auth/callback`. Set `SINGPASS_ENV=production`, `SINGPASS_CLIENT_ID`, `SINGPASS_REDIRECT_URI`, `SINGPASS_SIG_PRIVATE_JWK`, `SINGPASS_ENC_PRIVATE_JWK`. Start this first: approval is the slowest step and not in our hands. | Ops + Ext |
| 1.5 | **Ascend** | Production credentials: `ASCEND_ENABLED=true`, `ASCEND_BASE_URL=https://api-admin-ascend.crawfort.com`, `ASCEND_APP_ID`, `ASCEND_APP_SECRET`. Agree with Ascend how test applications are marked and cleaned up. Ask them about the two PASS replies without `mlcbMaxLoanAmount` (12 Oct) and what we should do if a PASS never returns a credit limit. | Dev + Ext |
| 1.6 | **AirConnect and AXS** | Production `AIRCONNECT_API_KEY`, `AIRCONNECT_APPOINTMENTS_URL`, `AIRCONNECT_LEADS_URL`, `AXS_PARTNER_API_KEY`, `AXS_TOKEN_SECRET`. | Ops + Ext |
| 1.7 | **App secrets and flags** | `APPLY_SESSION_SECRET` (32+ random characters, unique to production), `CRON_SECRET`, `NEXT_PUBLIC_APP_BASE_URL=https://get.crawfort.com`. **Off:** `MYINFO_EDITOR_ENABLED=false`, `MYINFO_CAPTURE_ENABLED=false`. **Empty:** `TEST_RECOGNISED_BANKS`. App store links if booking uses them. | Dev |
| 1.8 | **Vercel** | Set every variable above in the Production scope only. Add `get.crawfort.com` to the project. In DNS add a record for `get` pointing where Vercel's domain screen says (`apply` uses a Vercel CNAME that is not proxied, so use the same kind of record). Wait for the certificate. | Ops |
| 1.9 | **Cron jobs** - scheduled in `vercel.json` (done 15 Oct): `/api/cron/income-documents` daily 03:00 Singapore time (deletes documents added but never submitted, after 7 days) and `/api/cron/ascend-shape` daily 09:00 (reports when Ascend changes how it answers; returns an error on a new problem). Both refuse without `CRON_SECRET`, which Vercel sends automatically once it is set. Still to decide: where the Ascend alert goes. | Dev + Ops |

## 2. Code to settle before the release

| # | Item |
|---|---|
| 2.1 | Done 15 Oct: the booking link in `app/api/axs/submit/route.ts` no longer falls back to `apply.crawfort.com`; without `NEXT_PUBLIC_APP_BASE_URL` it uses the request's own address. |
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
- **Later:** schedule the 2031 clean-up for `income_model_calls` (GitHub issue 11).
