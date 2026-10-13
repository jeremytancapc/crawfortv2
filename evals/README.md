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
```

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
and amounts.

## The cases

Ten, all synthetic (fictional people, a fictional bank, every document stamped
SAMPLE). Each case's expected answer is generated from the same numbers printed on
its document, in `make-fixtures.mts`.

| Case | What it guards |
|---|---|
| `payslip-empno-3months` | the name flake: header `NAME (employee no.)` returned inside the name |
| `payslip-masked-id-name` | a masked NRIC after the name; a `BINTE` name |
| `payslip-classic-ytd-netpay` | net pay beside a year-to-date total, paid a month later |
| `payslip-scanned-skewed` | a skewed, soft image: the note must be a sentence, never markup |
| `bank-freelancer-future-dated` | uneven months; a month printed to the 31st, read on the 12th |
| `bank-employed-mixed-credits` | what counts as income for an employed applicant |
| `bank-unemployed-cpf-life` | unemployed with income: only the CPF payout counts |
| `bank-wrong-name` | someone else's statement must be refused |
| `bank-unrecognised-bank` | a bank that is not a recognised Singapore bank must be refused |
| `letter-not-income` | a letter that is no income document must be refused |

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

## Before changing the prompt, the tool schema or the model

Run `--n 5` and check nothing got worse. Regression cases must pass every run.
