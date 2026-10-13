# Evals for the document reader

The reader is one model call that reads payslips, bank statements and platform
earnings statements and returns structured fields. Our code then decides.
These evals run the **real model** on a fixed set of documents, many times, and
grade both halves. Why this exists and how it fits together:
[`docs/ai-agent-design-and-evals.md`](../docs/ai-agent-design-and-evals.md).

## Run it

```bash
npx tsx --env-file=.env.local evals/run.mts --n 5                       # everything, 5 runs each
npx tsx --env-file=.env.local evals/run.mts --case payslip-empno-3months --n 12
npx tsx --env-file=.env.local evals/run.mts --lib /path/to/older/checkout --n 12   # an older reader
npx tsx --env-file=.env.local evals/run.mts --n 5 --model claude-sonnet-5-5       # another model, same reader code
npx tsx --env-file=.env.local evals/run.mts --n 5 --write-baseline                # record this run as the baseline
```

Every run ends by comparing each case with [`baseline.json`](baseline.json): `WORSE` for a
case that passes less often than recorded, `better` for one that passes more. It also says
when the prompt or tool schema changed since the baseline. Re-record the baseline only after
a run you accept, on all cases with the reader's own model; the file is committed so a change
to it shows in review.

**It costs money.** Each run is a model call. Measured on 13 Oct 2026 at list
price: about **$0.05 a run**, so the whole suite at 12 runs each (120 calls) was
**$5.54**, and a call takes about 5 s (p95 13 s). The summary prints the cost.

`grade.ts` is plain code with its own tests (`npx vitest run evals/`), so it runs
in the normal test suite for free. Only `run.mts` calls the model.

## What a result means

Each run is graded twice, because the two failures look alike and are fixed in
different places:

| Column | Meaning |
|---|---|
| `reader` | what the model reported was wrong (a misread name, amount, date, category) |
| `rules`  | what our code decided from the report was wrong |

A case passes a run only if nothing **critical** failed. A case should pass **every**
run (`pass^N`): each applicant is one run, so a case that fails 1 run in 4 is a
failing case even though one green run looks fine. Warnings (a label that changes
no total, an extra credit) are listed, never fail a run.

Raw replies go to `evals/results/` - **git-ignored**, because they contain names
and amounts. `identifiers.test.ts` guards the other direction: it runs with the normal
tests and fails if any committed file under `evals/` (cases, generator, README, and the
text of every PDF) holds an NRIC, email, Singapore phone or bank account number, or a
PDF that is not marked SAMPLE or "not a real payslip". An invented number that must stay
goes in `FICTIONAL_NUMBERS` in `identifiers.ts`, by hand. It runs on every pull request
and on pushes to `stg` and `stg-caken` (`.github/workflows/tests.yml`).

## The cases

Twenty-three, all synthetic (fictional people, a fictional bank, every document stamped
SAMPLE). Each case's expected answer is generated from the same numbers printed on
its document, in `make-fixtures.mts`.

| Case | What it guards |
|---|---|
| `payslip-empno-3months` | the name flake: header `NAME (employee no.)` returned inside the name (the original files, newest first) |
| `payslip-masked-id-name` | a masked NRIC after the name; a `BINTE` name |
| `payslip-classic-ytd-netpay` | net pay beside a year-to-date total, paid a month later |
| `payslip-scanned-skewed` | a skewed, soft image: the note must be a sentence, never markup |
| `payslip-semimonthly` | September as two half-month payslips; they add up |
| `payslip-half-month-only` | only 16-30 September: ask for the missing days by date |
| `payslip-two-employers` | two jobs in one month: both count, added together |
| `payslip-too-old` | only a June payslip on 9 Oct: the latest must be September or August |
| `payslip-weekly` | five weekly payslips: only a monthly payslip is used, so ask for one |
| `payslip-same-period-twice` | an original and a "revised" payslip for the same period: refuse, do not add or pick |
| `payslip-bank-confirms-panel` | the bank shows the payslip's net pay arriving: panel |
| `payslip-bank-no-match` | the bank shows a different amount: not panel |
| `earnings-statement-alone` | a platform statement: earnings after commission and rental, unconfirmed |
| `earnings-statement-multi-cashout-panel` | four weekly cash-outs within 10% of the earnings: panel |
| `letter-platform-payout` | a platform's letter stating one month's pay-out, treated as an earnings statement |
| `bank-freelancer-future-dated` | uneven months; a month printed to the 31st, read on the 12th |
| `bank-cut-mid-month` | statements cut on the 15th: only a month covered end to end counts |
| `bank-employed-mixed-credits` | what counts as income for an employed applicant |
| `bank-unemployed-cpf-life` | unemployed with income: only the CPF payout counts |
| `bank-month-without-income` | a month with only interest: say so, do not ask for the statement again |
| `bank-wrong-name` | someone else's statement must be refused |
| `bank-unrecognised-bank` | a bank that is not a recognised Singapore bank must be refused |
| `letter-not-income` | a letter that is no income document must be refused |

**Baseline, 13 Oct 2026 (on Opus 5.5):** all 23 cases pass every run, 115 of 115 (5 runs each), at
$4.24 list price, p50 4.5 s and p95 9.3 s a call. (On Opus 5 it was $5.41, 5.8 s and 8.7 s;
the rule mutations below were shown on Opus 5.) Each of the 13 added cases was shown to
fail when the rule it guards is broken on purpose (weekly pay accepted, the bank never
confirming a payslip, the payout tolerance set to zero, a same-period duplicate not refused,
an empty bank month ignored): the failure lands in the `rules` column and nowhere else.

## Which model reads

Same 23 cases, same reader code, 5 runs each, 13 Oct 2026, list price
(`--model` swaps only the model name sent):

| Model | Passed | Cases clean | Cost | $/run | p50 | p95 |
|---|---|---|---|---|---|---|
| `claude-opus-5` (used until 13 Oct) | 115/115 | 23/23 | $5.41 | $0.047 | 5.8 s | 8.7 s |
| `claude-opus-5-5` (in use from 13 Oct; the baseline) | 115/115 | 23/23 | $4.24 | $0.037 | 4.5 s | 9.3 s |
| `claude-sonnet-5-5` | 113/115 | 22/23 | $2.10 | $0.018 | 3.7 s | 6.9 s |

* **Sonnet 5.5 is 61% cheaper and faster, but missed `letter-platform-payout` in 2 of 5 runs**:
  it called a platform's pay-out letter `other` rather than an earnings statement, so our
  rules asked the applicant to re-upload. Every other case, including the name, the bank and
  the unemployed rules, was clean. That is a real applicant being told to resubmit a valid
  document, so it does not meet the rule that every case passes every run. Five runs is also
  a small sample: it says Sonnet is close, not that the gap is exactly 2 in 5.
* **Opus 5.5 matched Opus 5 on every run for 22% less, and is now the reader's model.** Beyond the
  115/115 above, it passed 36/36 at `--n 12` on the three cases that have ever flaked
  (`payslip-empno-3months`, `bank-freelancer-future-dated`, `letter-platform-payout`): 151 runs, no failure.
* Prices are from the pricing page on the date above; update `PRICES` in `run.mts` when they change.

## Add a case from a failure

1. Add it to `make-fixtures.mts` (document + expected reader fields + expected outcome).
2. `npx tsx evals/make-fixtures.mts` (needs Google Chrome; the outputs are committed, so
   running the evals does not).
3. Run it **on the old code first** (`--lib` a checkout from before the fix) and confirm it
   fails, then on the fixed code and confirm it passes. A case that cannot fail on the bug it
   was written for measures nothing.

Keep real customers' documents out of this folder. If the real file is needed to reproduce
a failure, keep it private and rebuild the trap synthetically - **and check the synthetic one
fails**; see below.

## Findings from building it

* **A lookalike fixture did not reproduce the bug; the original files did.** The name flake
  showed 0 failures in 36 runs on a freshly built payslip, and 6 in 12 on the exact files from
  the day. Layout details matter. Keep the original bytes for a regression case.
* **Document order mattered.** The same three files, old reader: 0 of 12 failures oldest
  first, 6 of 12 newest first (the order the upload step sends). No unit test could have shown
  this; only repeated runs on real input order did.
* **A fixture can hide a wrong expectation.** `letter-not-income` first "failed" because it
  demanded one specific refusal route. Both routes are correct refusals; the grader accepts
  either.

* **Two of the 13 new cases first failed, and neither was a product bug.** One bank statement
  credited an amount the payslip did not print as its net pay (a fixture error: "confirms" means
  the bank shows the payslip's *printed* net). One note of `;` beside a good reading failed a
  grader that was stricter than production, which throws such a note away; it now only matters
  when the document could not be read and the note is shown. Check a failing case's own
  expectation before blaming the model or the rules.

## Before changing the prompt, the tool schema or the model

Run `--n 5` and check nothing got worse. Regression cases must pass every run.
