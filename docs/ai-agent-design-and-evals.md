# Designing around the document reader, and testing it properly

Written 2026-10-13 for branch `stg-caken`. Plain English; every claim is cited with a key like [S3] that points to the source list at the end.

**Summary**

1. The "agent" here is one model call inside a fixed pipeline (a *workflow* in Anthropic's vocabulary), not a free-running agent. That keeps the testing problem small: documents in, structured fields out, graded.
2. "The model reports what is printed, code decides" fits Anthropic's guidance but is not stated by it in those words. What is stated: schema checks guarantee shape, not truth [S4]; validate high-stakes output [S8]; credit decisions need a qualified human reviewer and disclosure [S11].
3. Our unit tests fake the model, so they only test what we imagined it would say. All six failures below came from something the model or Ascend did that the fakes did not contain.
4. Anthropic's eval guidance maps cleanly onto our gaps: a golden set built from real failures [S7], graded automatically field by field [S3], repeated runs because output varies [S7, S17].
5. Biggest design gap found: we do not store the model's raw reply, the model id or the prompt version with each reading, so a decision cannot be replayed. First fix is cheap (section A5, first task in C5).

Related notes, not repeated here: `docs/income-verification.md` (what the product does), `docs/income-test-cases.md` (manual staging cases), `docs/adr/0001-ascend-owns-the-borrowable-amount.md` (Ascend decides the limit).

---

## 0. The six failures, verified in this repo

| # | What happened | Evidence in repo | Which side was wrong |
|---|---|---|---|
| 1 | Holder name sometimes came back as `CHRISTOPHER DAVID LEE (300771)`; code refused the payslip as someone else's. About 1 run in 4. Same files passed at 14:23, failed at 16:29. | Commit `add533c` (2026-10-09 16:37). Its message records the 14:23/16:29 times and "twelve repeats that failed three times before now pass sixteen of sixteen". Fix: `lib/income-identity.ts` drops any token with a digit; the prompt in `lib/income-extraction.ts` now says to omit the number. | Model varied; code was brittle |
| 2 | Year-to-date check (month > 6x smallest) refused a freelancer's bank statement (Aug 3,082.73, Sep 2,880.41, Oct 432.73). | Commit `7d89ee6` (2026-10-12). `reviewExtraction` now takes `checkYearToDate`, false for bank statements. | Our rule applied to the wrong input type |
| 3 | A statement printed to 31 Oct was read on 12 Oct; October counted as a whole month. | Same commit: `bankStatementMonths(..., today)` never treats days after today as covered (`lib/income-periods.ts`). | Our rule; the model reported the printed dates faithfully |
| 4 | Rule "unemployed without income counts only CPF payout" added, then reverted four minutes later because it was not confirmed. | `a940702` (12:47) then `53d6636` (12:51), both 2026-10-12. The earlier "UNEMPLOYED WITH INCOME means CPF only" rule (`creditsCountedFor`, `lib/income-extraction.ts`) is still in the file. | A business decision, not model behaviour |
| 5 | Ascend started returning PASS with an empty `creditScore` (limit arrived about 1s later). Noticed only when testers reached the pending page. | Fix `79be53e` (2026-10-09 11:55), `lib/ascend/after-income.ts`: re-ask up to three more times. The code comment cites order 1558084373801472000 on 2026-10-09. The "from 2026-10-08 15:20" cut-over time is the developer's own observation; it is not recorded in the repo. | External system changed without notice |
| 6 | Reader checked on 18 real payslips (2026-09-17) and later on generated payslips with traps (YTD column, net-pay line, payment date a month later, expense claims). | Header comment of `lib/income-extraction.ts`. This was a manual golden set. | Process gap |
| 7 (extra) | On those 18 real payslips, two slow scanned images came back with the model's own tool-call syntax inside the `note` sentence. | Comment on `applicantSafeNote`, `lib/income-extraction.ts`. A real case that belongs in the golden set. | Model output |

---

## A. Design: where the model stops and code starts

### A1. What kind of system is this?

**Anthropic says:** a *workflow* is LLMs and tools orchestrated through predefined code paths; an *agent* decides its own steps. Start with the simplest solution and add complexity only when it demonstrably improves outcomes [S1].

`extractIncome` is a workflow: one call with one tool (`report_income`, forced by schema, not by `tool_choice`), then plain code. Calling it an agent matters because most "agent testing" advice (long tool loops, path grading) does not apply. Ours reduces to input document, structured output, graded fields.

### A2. "The model reports what is printed, code decides"

**Anthropic says (supports it, does not state it):**
- Strict tool use and structured outputs guarantee that the output matches the schema. The page promises valid JSON, correct types, required fields; it makes no claim that the values are right [S4]. So `strict: true` removes missing-field bugs and nothing else (the comment above `PERIOD_ITEM` says this correctly).
- Anthropic's hallucination guidance says the techniques reduce but do not eliminate errors, and that critical information should be validated, especially for high-stakes decisions [S8].
- Credit is a named high-risk area in the Acceptable Use Policy (section A4) [S11].

**No primary source found** for the exact principle "model extracts, code decides". Treat it as sound engineering that these sources are consistent with, not as Anthropic's rule.

**What this repo already does well, and what it should keep:**

| Ask the model (it reads, sorts) | Compute in code (it must be reproducible) |
|---|---|
| `kind`, `holderName`, `issuer` per document | Whose document it is: `nameBelongsTo`, `isRecognisedSgBank` (`lib/income-identity.ts`) |
| Pay period `start`/`end`, `gross`, `net` as printed | Month assembly, weekly-to-month split, overlaps (`assembleMonths`, `lib/income-periods.ts`) |
| Each credit's date, amount, payer, `category` | Which categories count (`COUNTED_CREDITS`, `creditsCountedFor`), CPF gross-up (`grossUpSalary`), the window, S$0 for missing months |
| `readable` plus a one-sentence `note` | What the applicant sees (`applicantSafeNote` screens the note) and the Ascend `incomeType` |

The split by `category` is the best design choice in the file: the model sorts, `COUNTED_CREDITS` decides, "so the rule can change without re-reading anything" (the code comment). Failure 4 was a rule change and needed no model call at all. That only works if the raw sort is kept (A5).

**Tool design:** Anthropic says detailed descriptions are the most important factor in tool performance [S5], and recommends making mistakes harder by changing the arguments (their "poka-yoke" advice) [S1, S6]. The schema descriptions ("Never a year-to-date total, never a net figure") already follow this.

**Defence in depth (from failure 1):** a prompt instruction alone (omit the employee number) is not enough, and tolerant code alone is not enough. We needed both, because the model varies run to run (A5, B3).

**Hardening proposals (ours):**
- `call.input as Reported` is a type cast, not a check. Validate the reply at runtime (for example with zod) and treat a failed validation as `unreadable`. Anthropic notes that capitalisation of enum values is not guaranteed [S4], and the code compares `kind === "other"` directly.
- A guard encodes an assumption about its input (failure 2). Every guard in `reviewExtraction` should name the input type it applies to, as `checkYearToDate` now does.
- Branch on `stop_reason`. **Anthropic says:** `refusal` arrives as HTTP 200 with a `stop_reason` and a `stop_details` field, and the suggested handling is to retry on another model; `max_tokens` truncation can leave a tool call incomplete, fix is a higher `max_tokens` [S10, S4]. Today a missing tool call becomes "The documents could not be read. Please upload clear payslips" (`lib/income-extraction.ts`), which blames the applicant for what may be our token limit. Log `stop_reason` and retry once before telling the applicant anything.

### A3. Uncertainty and refusal paths

**Anthropic says:** give the model explicit permission to say it does not know; it "can drastically reduce" false output. Another listed technique, best-of-N, runs the same prompt several times and treats disagreement as a warning sign [S8].

We have two exits already: `readable: false` and `needs_review` (human). Missing months are sent as S$0, never guessed (`reviewExtraction`). That is the right default for lending.

**Proposal (ours):** for the readings that will go to Ascend, consider reading twice and requiring the key fields (holder name, period dates, gross) to agree; disagreement goes to `needs_review`. It doubles model cost per submission, so it is a decision (section D), not a given.

### A4. Human in the loop for lending

**Anthropic says:** the Acceptable Use Policy lists "Credit" as a high-risk area, defined as including approving, denying, or setting the amount, rate or limit of a loan or credit line. For a high-risk AI recommendation the user must have a qualified person meaningfully review it, with authority to change it, before it is implemented, and must tell the affected individual that AI was used [S11].

**In this repo:** `needs_review` and `unreadable` go to a person. A `usable` reading goes to Ascend after the applicant presses Submit on the results page (`docs/income-verification.md`), and Ascend sets the limit (ADR 0001). I searched the verify-income page, the loan form and the AXS legal text for wording that says an AI reads the documents (terms "AI", "automated", "artificial") and found none. That search was shallow.

Whether our setup meets [S11] is a question for the business owner and compliance, not something this note can settle. It is listed in section D.

### A5. Idempotency and replay

> **Done 13 Oct 2026.** `extractIncome` is split into `readDocuments()` (the only model call) and a pure `decide()`; every call, usable or refused, is written to `income_model_calls` (migration `0009`) with the raw report, model id, prompt version, stop reason, usage and the date the rules ran against, kept five years (confirmed by finance). The text below describes the gap as it was found.

What `insertIncomeReading` stores (`lib/db/income-documents.ts`): `income_type`, `months`, `average`, `m1`-`m3`, `advice`, document ids, `name_not_shown_for`, `used_document_ids`. Files are kept after submission (`docs/income-verification.md`). Submit-once is enforced (`submitting_at`, `submitted_at`).

**Not stored:** the raw `report_income` input, the model id, the prompt text or a version, `stop_reason`, token usage, and the `today` used to pick the window. The comment above `ExtractionOutcome` says `periods` and `assembly` "are what make it replayable", but the route (`app/api/apply/income/extract/route.ts`) does not save them.

Why it matters: re-running the model on the stored files is not a replay. **Anthropic says** `temperature`, `top_p` and `top_k` are rejected on Claude 4.7 and later [S17], and that even at temperature 0 identical inputs can give different outputs [S18]. The model id `claude-opus-5` is a pinned snapshot [S12], so it will not drift silently, but it will be retired (not before 24 July 2027, at least 60 days' notice) [S13].

**Proposal (ours):**
- Split `extractIncome` at the `Reported` type: `readDocuments()` (the only function that calls the model) and `decide(reported, options)` (pure).
- Store with each reading: `model_report jsonb` (raw tool input), `model_id`, `prompt_version` (or a hash of `SYSTEM` + the tool schema), `stop_reason`, `usage`, `read_today`.
- With that, any past decision can be re-derived exactly, and a rule change (failure 4) can be run over the last N stored reports to see who it would have changed before it ships. A bad reading can be inspected without paying for another call.
- Retention: the raw report holds names and amounts, so it needs a retention rule (section D).

Anthropic's own advice points the same way: review raw transcripts, because "what agents omit" can matter more than what they say [S6], and transcripts are how you check an eval is measuring the right thing [S7].

### A6. Ascend as an untrusted dependency

**No primary source found** for this (it is about Ascend, not Anthropic). The general lesson is from failure 5: the contract is whatever Ascend does today. Proposal (ours):
- Parse every Ascend reply against a schema and log the raw reply (`lib/external-api-logger.ts` exists; confirm it keeps the body).
- Model "PASS without a limit" as an explicit unresolved state, as `after-income.ts` now does, rather than as PASS.
- Run a scheduled canary on staging that submits a known income and asserts the reply shape, and alert on the share of PASS replies with an empty `creditScore` over the last hour. The Ascend change was found by testers hitting a pending page; a dashboard should find it first. Anthropic notes production monitoring catches what synthetic evals miss but is reactive [S7].

---

## B. Testing layers, mapped to the failures

| Layer | What it catches | Failures it would have caught | Cannot catch |
|---|---|---|---|
| 1. Unit tests, model faked (have) | Rule logic: months, windows, thresholds, name matching | 4 (rule is testable), 2 and 3 once someone thinks of them | Anything the model does that the fake does not contain: 1, 7 |
| 2. Extraction evals, real model, golden set | Reader mistakes on real-looking documents | 1, 2, 3, 7, and the traps in 6 | Rare layouts not in the set |
| 3. Repeat runs (N samples) | Flakiness | 1 | Consistent errors |
| 4. Metamorphic tests | Behaviour that must not change (or must change) when the input is altered | 1, 2, 3 | Unknown unknowns |
| 5. Regression cases from every failure | Repeat of a known failure | all of them, after the first time | First occurrences |
| 6. Contract tests and monitoring (Ascend, model replies) | External change, drift | 5 | Wrong-but-valid answers |
| 7. Cost and latency budgets | Slow or expensive prompt/model changes | none of the six | Correctness |

### B1. Layer 1: what we have, and its blind spot

`lib/income-extraction.read.test.ts` replaces the model with a hand-written `Report` (`reporting()`), then checks everything after it. That is the right test for rules. Its blind spot is structural: the fake is written by the same person (or AI) who wrote the prompt and the code, so it contains the model behaviour they expected. Failure 1 passed these tests because no fake `holderName` had a digit until `add533c` added one. Failure 2 passed because every earlier bank-statement test used even amounts. Failure 3 passed because statement dates in fakes were consistent with `TODAY`.

### B2. Layer 2: extraction evals (golden set)

**Anthropic says:**
- Good success criteria are specific and measurable, with a threshold, and most use cases need several at once (for example accuracy plus latency) [S2].
- Evals should mirror the real task distribution, include edge cases, be automated where possible, and favour many automatically graded cases over few hand-graded ones [S3].
- Grading by code (exact match, string match) is fast and reproducible; use deterministic graders where possible and LLM graders only where necessary [S3, S7].
- "20-50 simple tasks drawn from real failures is a great start"; a good task is one where two domain experts would reach the same verdict; write a reference answer for each [S7].
- Grade what was produced, not the path taken; give partial credit [S7].
- Test both when a behaviour should occur and when it should not: "one-sided evals create one-sided optimization" [S7].

**Proposal (ours):** section C.

### B3. Layer 3: repeat runs

**Anthropic says:** results vary between runs. `pass@k` is the chance of at least one success in k tries; `pass^k` is the chance all k succeed, and suits systems that must be consistent. A 75% per-run success rate gives about a 42% chance of passing three in a row [S7]. Identical inputs can differ even at temperature 0 [S18], and we cannot set temperature on current models anyway [S17].

For a lending reader the right measure is `pass^k`, because every applicant is one run. Failure 1 is the proof: at roughly a 1-in-4 error rate, one run passes 75% of the time, so a single green run says almost nothing.

**Our arithmetic (not Anthropic guidance):** if a case fails with probability p per run, N runs all pass with probability (1-p)^N.

| True failure rate p | Chance N=1 shows it | N=5 | N=12 | N=60 |
|---|---|---|---|---|
| 25% (failure 1) | 25% | 76% | 97% | about 100% |
| 5% | 5% | 23% | 46% | 95% |

So N=5 catches a failure-1-sized flake most of the time; catching a 5% flake needs about 60 runs, which is why those are reserved for cases we suspect.

### B4. Layer 4: metamorphic tests

**No primary source found** in Anthropic's material for this by name; the closest is the edge-case and balanced-set advice [S3, S7]. A metamorphic test says: change the input in a way that should (or should not) change the answer, and check that it does (or does not). Two kinds:

*Model-free (cheap, run in CI, extend Layer 1):*
- Feed `decide()` a fake report whose `holderName` has a trailing employee number, a masked NRIC, a title, reordered names. Expected: same accept/refuse as the clean name. (This is what `add533c` pinned for `nameBelongsTo` only.)
- Bank months of 3,082 / 2,880 / 432 and 100 / 100 / 5,000: expected usable for bank statements, `needs_review` for payslips (failure 2).
- Statement `end` after `today`: the later days are never covered; a month in progress is left out (failure 3). Pin `today`; test the day before month-end, month-end, day after.
- Current month in progress with payslip vs bank statement.

*Model-in-the-loop (nightly):* take one synthetic payslip and generate variants by script: add `(300771)` after the name; swap name order; add a YTD column; shift the payment date a month later; add an expense claim line; reflow to a screenshot. Expected reader output is the base case's, except where the change is meant to alter it.

### B5. Layer 5: a regression case from every failure

**Anthropic says:** convert user-reported failures into test cases so the suite reflects actual usage; regression suites should sit near 100% [S7]. Rule: **no fix is merged without a case that fails before it.** Failures 1, 2, 3, 5 and 7 each get a case (C2). Failure 4 gets a different artefact: a written, confirmed rule (D).

### B6. Layer 6: contract tests and monitoring

**Anthropic says:** combine automated evals, production monitoring and periodic human review; no one layer catches everything, and monitoring is reactive [S7]. Track tool errors, token use and runtime, not only accuracy [S6].

**Proposal (ours):** log per read: `stop_reason`, token usage, latency, outcome kind and refusal reason. Alert if the rate of `unreadable` or `needs_review` moves sharply. Ascend items are in A6.

### B7. Layer 7: cost and latency budgets

**Anthropic says:** latency and price are legitimate success criteria, written as thresholds (their example is 95% of responses under a set time) [S2]. Thinking tokens are billed as output tokens [S16]. `claude-opus-5` costs $5 per million input tokens and $25 per million output tokens; the Batch API is 50% off [S14]. The models page recommends Opus 5.5 ($4/$20) as the starting point for most workloads and lists Opus 5 under legacy models [S12].

**Proposal (ours):** record cost and p95 latency per case in every eval run, and set the budget after the first measurement rather than inventing one now. The same eval answers "can a cheaper or newer model do this?", which Anthropic also recommends testing well before a model's retirement [S13].

---

## C. Proposal for this repo

### C1. Layout

```
evals/
  README.md                 how to run, how to add a case
  cases/
    payslip/   *.case.json
    bank/      *.case.json
    platform/  *.case.json
    variants/  *.variant.json   (metamorphic recipes)
  fixtures/                 synthetic documents only, each stamped SAMPLE
  baseline.json             last accepted pass rates per case (committed)
  grade.ts                  field-by-field graders (no model calls)
  run.ts                    npm run eval -- --n 5 [--case id] [--model id]
  results/                  gitignored: one JSONL line per run, raw reply included
lib/income-extraction.ts    split into readDocuments() and decide()
```

`run.ts` calls `readDocuments()` and grades the raw `Reported` (reader eval), then passes it to `decide()` and grades the outcome (pipeline eval). Grading both separates "the model misread" from "our rule is wrong".

### C2. Sample cases

Values are drafts: run once, then have a second person confirm the expected values by looking at the document, before the case counts [S7: two experts would agree]. Names, banks and amounts are fictional (the repo already uses `HARBOURFRONT` as a fictional bank, `docs/income-verification.md`).

`evals/cases/payslip/ytd-and-employee-number.case.json` (failures 1, 6)
```json
{
  "id": "payslip-ytd-empno",
  "origin": ["add533c", "header comment lib/income-extraction.ts"],
  "tags": ["regression", "payslip", "name-with-number", "ytd-column"],
  "today": "2026-10-02",
  "applicant": { "name": "CHRISTOPHER DAVID LEE" },
  "employmentType": "EMPLOYED",
  "documents": [
    { "file": "fixtures/chris-aug.pdf", "mediaType": "application/pdf" }
  ],
  "expect": {
    "reader": {
      "documents": [{ "index": 1, "kind": "payslip", "holderName": "CHRISTOPHER DAVID LEE", "issuer": "HARBOUR FOODS PTE LTD" }],
      "periods": [{ "start": "2026-08-01", "end": "2026-08-31", "gross": 4280.00, "net": 3424.00, "document": 1 }]
    },
    "pipeline": { "kind": "usable", "m1": 0, "m2": 4280.00, "m3": 0, "incomeType": "NON_PANEL_PAYSLIP" }
  },
  "critical": ["reader.documents[].holderName", "reader.periods[].gross", "reader.periods[].start", "reader.periods[].end"],
  "properties": ["holderName has no digit"]
}
```
The document prints `CHRISTOPHER DAVID LEE (300771)`, a YTD gross of 34,240.00 beside the month, and payment on 1 Sep.

`evals/cases/bank/freelancer-future-dated.case.json` (failures 2, 3)
```json
{
  "id": "bank-freelancer-future-dated",
  "origin": ["7d89ee6"],
  "tags": ["regression", "bank", "uneven-months", "future-dated"],
  "today": "2026-10-12",
  "applicant": { "name": "SITI DON ASHIM" },
  "employmentType": "SELF-EMPLOYED",
  "documents": [{ "file": "fixtures/siti-harbourfront-aug-oct.pdf", "mediaType": "application/pdf" }],
  "expect": {
    "reader": {
      "documents": [{ "index": 1, "kind": "bank_statement", "holderName": "SITI DON ASHIM", "issuer": "HARBOURFRONT" }],
      "statements": [{ "start": "2026-08-01", "end": "2026-10-31" }],
      "credits": [
        { "date": "2026-08-14", "amount": 3082.73, "category": "transfer_from_others" },
        { "date": "2026-09-20", "amount": 2880.41, "category": "platform_payout" },
        { "date": "2026-10-03", "amount": 432.73,  "category": "cpf_life" },
        { "date": "2026-09-30", "amount": 0.62,    "category": "interest" }
      ]
    },
    "pipeline": { "kind": "usable", "m1": 2880.41, "m2": 3082.73, "m3": 0, "incomeType": "BANK_STATEMENT_OTHER_INCOME" }
  },
  "critical": ["reader.credits[].amount", "reader.credits[].category", "pipeline.m1", "pipeline.m2"]
}
```
October is excluded because it has not ended on 12 Oct; July is S$0 (missing), per the rules in `docs/income-verification.md`.

### C3. How grading works

| Field | Method | Source of idea |
|---|---|---|
| `kind`, `issuer`, document count | exact (issuer: case-insensitive match) | exact match, code-graded [S3] |
| `holderName` | exact after trim and upper-case, and a property check: contains no digit | property is ours (failure 1) |
| Dates (`start`, `end`, credit `date`) | exact string | [S3] |
| `gross`, `net`, credit `amount` | absolute difference of at most 0.01 | tolerance is ours; Anthropic warns against verifiers strict enough to reject correct answers [S6] |
| Credits | pair each expected credit to an output credit by (date, amount). Recall of credits that count must be 100%. Category is graded two ways: exact, and "counted vs not counted" (what `COUNTED_CREDITS` actually uses). Extra credits are reported as a precision warning | ours; the two category views separate a harmless mislabel from a wrong total |
| `readable:false` cases | reader must set it and `applicantSafeNote(note)` must be a sentence, not markup | failure 7 |
| `pipeline.kind`, `incomeType`, `m1`-`m3` | exact kind and type; amounts within 0.01 | [S3] |

Do not grade the model's reasoning or wording, only the outputs [S7]. Use no LLM grader at all at first; every field here is checkable by code. Add one only for free text, and calibrate it against human grades [S7]. Anthropic suggests a grader model different from the one being tested [S3].

### C4. Thresholds, CI and nightly

All numbers are **our proposal**. Anthropic gives the shape (regression near 100%, capability evals start low) [S7] but no numbers for this task.

- A case passes only if every *critical* field is right in all N runs (`pass^N`). N=5 by default; N=12 for cases tagged flaky-prone.
- Merging a change to the prompt, tool schema or model id requires: 100% of `regression`-tagged cases pass; at least 95% of all other cases pass; no case worse than `baseline.json`. Update the baseline in the same PR, with the reason.
- Fast gate (CI, free, every push): existing vitest suites, plus the model-free metamorphic tests (B4), plus **replay tests**: recorded real `report_income` replies stored as JSON, fed to `decide()`, outcome asserted. Recording one reply after each production or staging failure turns it into a CI test with no API cost.
- Slow gate (on demand, and nightly on `stg`): `npm run eval`, real model, real cost, results kept in `evals/results/`.
- Validate the harness itself: check out the prompt as of `add533c^` and confirm the eval shows failures on the name case. An eval that cannot fail on a known bug is not measuring anything [S7].

**Cost per run (estimate; assumptions are mine).** Price: `claude-opus-5` is $5 input and $25 output per million tokens, Batch is half [S14]. Anthropic says a PDF page typically costs 1,500-3,000 text tokens plus image tokens for the page image [S15]. I assume about 3,500 tokens per page all-in, a 3,000-token prompt and schema, and output (including thinking, billed as output [S16]) of about 4,000 tokens for three payslips and 10,000 for a three-month statement. That gives roughly $0.17 per payslip case and $0.43 per bank case; say $0.30 average. 30 cases at N=5 is 150 calls, about $45 on Opus 5 ($22 through the Batch API). The same suite on `claude-sonnet-5-5` ($2/$10 [S14]) would be about $18. Replace these with real `usage` figures after the first run; the token-counting endpoint also gives exact input counts [S15].

### C5. Keeping personal data out of the repo

Real payslips and statements carry names, NRIC fragments, salaries and account numbers.
- Commit only synthetic or redacted fixtures, each visibly stamped SAMPLE (as `docs/income-test-cases.md` already does for `Downloads/test-payslips`). Fictional banks only; a real bank's layout would be a forgery of its document.
- The 18 real payslips stay in the private bucket (`scripts/read-payslips.mjs` already reads `s3://`). Cases refer to them by file hash from a gitignored `fixtures.local.json`; only aggregate pass rates are committed.
- `evals/results/` is gitignored because raw replies contain names and amounts.
- Add a CI check that fails if a PDF or image appears outside `evals/fixtures/` or contains a `[STFGM]\d{7}[A-Z]` (NRIC-shaped) pattern.

### C6. First three things to do this week

1. **Split and persist.** Split `extractIncome` into `readDocuments()` and `decide()`. Add `model_report`, `model_id`, `prompt_version`, `stop_reason`, `usage`, `read_today` to `income_readings` (one migration). Everything else depends on this.
2. **Ten cases, one baseline.** Build `evals/` with ten synthetic cases covering failures 1, 2, 3, 6 and 7. Run each 12 times. Record cost and p95 latency. Confirm the harness fails on the pre-`add533c` prompt.
3. **Close the cheap gaps.** Add the model-free metamorphic tests (B4) to CI, a `stop_reason` branch with one retry (A2), and a rule that any new business rule needs a named confirmer before merge (D). Set up the Ascend canary and the empty-`creditScore` alert (A6).

---

## D. What we do not know / needs a decision

| Question | Why it matters | Who |
|---|---|---|
| Is "unemployed with income counts only CPF payout" confirmed, and is "unemployed without income" different? | `a940702` was reverted for lack of confirmation, and the first rule is still in `creditsCountedFor`. Lending outcomes depend on it. | Business owner; name one person who confirms rules |
| Does reading documents with an AI and sending the figures to Ascend count as a high-risk AI recommendation needing qualified human review and applicant disclosure? | [S11] makes both mandatory for credit decisions. I found no applicant-facing AI disclosure. | Compliance / legal; I cannot answer this |
| Who owns the golden set and labels expected values? | The labeller must not be the AI that wrote the prompt, or the blind spot of layer 1 returns [S7: two experts agree] | Needs a named human, plus a second reviewer |
| Acceptable flake rate in production | Proposed 0% on critical fields in regression cases; the true rate is unknown until C6 step 2 | Product + engineering |
| Read twice in production (A3)? | Halves a class of errors, doubles cost and latency | Engineering |
| Raw reply retention period | **Decided: five years, confirmed by finance.** Contains personal data; still to build: the clean-up that deletes rows past `retain_until` (earliest due October 2031). | Done; clean-up to schedule |
| Model choice: Opus 5, Opus 5.5 or Sonnet 5.5? | Cost differs by 2-3x [S14]; let the eval decide | Engineering, after the first baseline |
| Latency and cost budgets | Not measured today | Set after C6 step 2 |
| What the applicant sees on refusal or `max_tokens` | Today it says "upload clearer documents" | Product |
| Is a synthetic set enough? Scanned, slow, skewed images produced failure 7 | Synthetic PDFs may be too clean | Add scanned and photographed variants of the synthetic cases |

---

## Sources

Anthropic material was fetched on 2026-10-13. WebFetch returns a processed version of each page; where wording matters I paraphrased. The Claude API skill's eval guides (`tool-use-concepts.md`, `prompt-audit.md`, `evals/`) were not found on this machine (`/private/tmp/claude-501/bundled-skills` does not exist and a filesystem search found no such files), so none are cited.

| Key | Source | Used for |
|---|---|---|
| S1 | https://www.anthropic.com/engineering/building-effective-agents | workflows vs agents, start simple, poka-yoke, human checkpoints |
| S2 | https://platform.claude.com/docs/en/test-and-evaluate/define-success | specific, measurable criteria; thresholds; latency/price as criteria |
| S3 | https://platform.claude.com/docs/en/test-and-evaluate/develop-tests | task-specific evals, edge cases, volume, grading methods |
| S4 | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | schema guarantees and limits; refusal and `max_tokens` caveats |
| S5 | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools | tool description best practices; forced `tool_choice` limits on 5.5 models |
| S6 | https://www.anthropic.com/engineering/writing-tools-for-agents | eval tasks, held-out sets, metrics, reading transcripts, avoiding over-strict verifiers |
| S7 | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents | graders, `pass@k`/`pass^k`, regression vs capability, tasks from failures, balanced sets, monitoring |
| S8 | https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations | allow "I don't know", best-of-N, validate high-stakes output |
| S10 | https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons | `refusal`, `max_tokens` handling |
| S11 | https://www.anthropic.com/legal/aup (High-risk Use Case Requirements) | credit as high-risk area; human review; disclosure |
| S12 | https://platform.claude.com/docs/en/about-claude/models/overview | model IDs are pinned snapshots; Opus 5.5 as default recommendation; Opus 5 legacy |
| S13 | https://platform.claude.com/docs/en/about-claude/model-deprecations | `claude-opus-5` not retired before 24 Jul 2027; 60 days' notice; test newer models early |
| S14 | https://platform.claude.com/docs/en/about-claude/pricing | per-token prices; Batch 50% off |
| S15 | https://platform.claude.com/docs/en/build-with-claude/pdf-support | tokens per PDF page; token counting |
| S16 | https://platform.claude.com/docs/en/build-with-claude/thinking | thinking tokens billed as output |
| S17 | https://platform.claude.com/docs/en/build-with-claude/working-with-messages | temperature, top_p, top_k rejected on 4.7 and later |
| S18 | https://platform.claude.com/docs/en/about-claude/glossary (Temperature) | not fully deterministic even at temperature 0 |
| (S9) | https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/increase-consistency | read; not relied on. Points to structured outputs for guaranteed schema conformance |

Repo evidence: `lib/income-extraction.ts`, `lib/income-extraction.read.test.ts`, `lib/income-extraction.test.ts`, `lib/income-periods.ts`, `lib/income-identity.ts`, `lib/ascend/after-income.ts`, `lib/db/income-documents.ts`, `app/api/apply/income/extract/route.ts`, `scripts/read-payslips.mjs`, `docs/income-verification.md`, `docs/income-test-cases.md`, `docs/adr/0001-ascend-owns-the-borrowable-amount.md`; commits `add533c`, `7d89ee6`, `a940702`, `53d6636`, `79be53e`.
