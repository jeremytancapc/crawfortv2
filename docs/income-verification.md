# Income verification - how it works, in plain language

For marketing and support. Describes what the product does today (branch
`stg-caken`), not what is planned. Where a rule is still undecided it says so.

## When an applicant sees this step

Only when Ascend says it needs income proof for the application (CPF or tax
data did not settle it). Everyone else skips it.

## What they can upload

PDF, JPG or PNG, up to 10 MB each, up to 6 files, all on one page.

| Document | Who it is for | Notes |
|---|---|---|
| Payslips | Full-time employees | Latest 3 months |
| Bank statements | Everyone else, or alongside payslips | Must be from a Singapore bank |
| Platform earnings statements | Grab and PHV drivers | Treated exactly like payslips |

Gig-app screenshots (for example a foodpanda Payments screen) are read as
earnings statements.

## Which months count

The latest document must be for last month or the one before (in October:
September or August). We then ask for the two months before it.

One month is enough to go ahead. Any month we could not read is filled in as
the average of the months we did read, so a missing document does not drag the
applicant's income down. **Undecided:** whether a missing month should instead
count as zero, or whether all three should be required.

## Which figure we take

The gross figure, before CPF and deductions (for example a foodpanda June of
$626.47, not the $548.79 paid out). Weekly or part-month pay periods are split
by day into calendar months. We never guess: if the documents do not clearly
say, the application goes to a person.

## Is it the applicant's own document?

- **Payslips and bank statements:** the name on the document must match the
  applicant's Singpass name. Joint accounts pass if one holder is them. A bank
  statement must be from a recognised Singapore bank. A document with no name,
  or someone else's, is refused.
- **Gig-app earnings screenshots:** these often show no name at all, so
  *silence is allowed*. We only refuse one that shows a name which is not the
  applicant's. When a screenshot is accepted without a name, we record it and
  leave a note on the Ascend order so staff reviewing it can see that the
  income rests on an unnamed screenshot. For a stronger case, applicants can
  include their profile screen showing their name.

## What the applicant is told

On the results page we show the income we read, then a "Want a higher limit?"
card:
- payslips only: add a bank statement showing the pay arriving - it can
  increase the credit limit;
- bank statement only: add payslips;
- payslips plus a bank statement that did not match: check it covers the same
  months and shows the pay arriving.

We say "can increase", never "will": Ascend decides the limit. The applicant
can always carry on with what we read - "Submit income" is the main button.

## What we keep, and for how long

- Files are saved the moment they are added, and everything after works from
  that saved copy, so what was read is exactly what is kept and sent.
- Removed by the applicant: the file is deleted straight away.
- Added but never submitted: deleted after 7 days (needs the daily clean-up
  job scheduled; see `CRON_SECRET`).
- Submitted: kept, as the record behind the credit decision.
- Every step (added, read, removed, deleted, submitted, refused) is written to
  an audit log, per applicant.

## Open questions

- Whether foodpanda gives riders a downloadable or emailed statement. Not
  confirmed; check with a rider. Until then screenshots are the fallback.
- The missing-month rule above.
- The year on a screenshot that only says "June" can be misread; the
  latest-month rule catches the worst cases.
