# Income verification - test cases

What to try on staging, and what should happen. Written for testing and for
explaining the step to marketing; see `income-verification.md` for the rules
behind it.

**Before you start**
- Test files are in `Downloads/test-payslips/<person>/`. Folder names say what
  to expect (`valid`, `expect-refused-wrong-name`, `gig-app`, ...). Every file
  is fictional and marked as sample data.
- Bank statements use a fictional bank. On staging set
  `TEST_RECOGNISED_BANKS=HARBOURFRONT` (Preview only), then redeploy.
- Log in with the Singpass test account that matches the person's name. The
  name on every document is checked against it.
- Months are relative to today. In **October 2026** the latest document must be
  for **October, September or August**, and the three months used are the
  latest one and the two before it. Missing months count as **S$0**.
- A reading is not final until Submit. Each test ends on the results page, so
  check the figures there, then Submit and check what was sent (api_logs, the
  `income_readings` and `income_documents` tables).

**Test people**

| Login | Residency | Born | Why use them |
|---|---|---|---|
| Siti Don Ashim | Citizen | 2000 | Most files; CPF is taken off salary |
| Felicia Tan Wei Lin | PR | 1993 | Second person; PR also pays CPF |
| Christopher David Lee | Foreigner | 1999 | No CPF: nothing is added back |
| Test User | Citizen | 1990 | Quick runs |

---

## 1. Payslips only

| # | Upload (Siti) | Expect |
|---|---|---|
| 1.1 | Payslips Jul + Aug + Sep (`valid/`) | S$3,800 each month (gross, not the S$3,040 take-home). Non-panel. Card suggests adding a bank statement for a higher limit |
| 1.2 | Aug + Sep only | Sep and Aug S$3,800, July **S$0**. Page says July counts as S$0 and lowers the average |
| 1.3 | Sep only | S$3,800, S$0, S$0 |
| 1.4 | March payslip only | Not accepted: asks for the latest payslip, for September or August |
| 1.5 | Jul only (older than August) | Same refusal: the latest must be September or August (or October) |
| 1.6 | Jul + Aug + Sep + the March payslip | March is left out, and the page says so. March is **not** sent to Ascend |
| 1.7 | A payslip dated a later month than today | Not used; does not count as evidence |
| 1.8 | Two payslips for the same month | Not double counted (not yet tried: note what happens) |

## 2. Bank statement only

Needs `TEST_RECOGNISED_BANKS=HARBOURFRONT`.

| # | Upload (Siti) | Expect |
|---|---|---|
| 2.1 | Statements Jul + Aug + Sep (`matches-payslip/`) | The salary deposit is S$3,040. It is **taken back up to gross, S$3,800**, as a payslip would show. Type: bank statement. Card suggests adding payslips |
| 2.2 | Aug statement of "other income" (`bank-statement-only/`) | Money from PayNow, cash or other sources counts as it arrived. No CPF added back |
| 2.3 | Aug + Sep only | Jul S$0, with the advice saying so |
| 2.4 | A month with nothing coming in | Says which month shows nothing, rather than asking for the statement again |
| 2.5 | The same statement uploaded twice | Each credit counted once |
| 2.6 | A statement cut mid-month (two part-statements) | Joined into the calendar month they cover |
| 2.7 | Statement from a bank that is not a recognised Singapore bank (or the test env var removed) | Refused: could not confirm it is a Singapore bank |
| 2.8 | Christopher with a bank statement | Salary counted as deposited: **no** gross-up (foreigner) |
| 2.9 | Interest, refunds, own-account transfers, loans | Not counted as income |

## 3. Payslips and a bank statement together (matching)

| # | Upload (Siti) | Expect |
|---|---|---|
| 3.1 | Payslips Jul-Sep + statements Jul-Sep (`matches-payslip/`) | Figures are the payslip gross, S$3,800. **Panel** payslips: each payslip's take-home pay is seen arriving |
| 3.2 | Felicia: payslips Aug + Sep + her statements | Panel, gross from the payslips |
| 3.3 | Pay credited in the first days of the next month | Still matched (within 20 days of the period end) |
| 3.4 | Payslips Jul-Sep + statements for only two of the months | Non-panel: every month has to be seen arriving |

## 4. Payslips and a bank statement for different months

These are the mixes where behaviour matters most. Results below are what the
step does **today**.

| # | Upload (Siti) | Expect today |
|---|---|---|
| 4.1 | Payslips Sep + Aug, statement for Jul only | Sep and Aug S$3,800, Jul **S$0**. The Jul statement is sent but not counted, and the page says "no payslip for July". **Known gap, see below** |
| 4.2 | Payslip Sep, statements Jul + Aug | Sep S$3,800, **S$0, S$0**. Same gap |
| 4.3 | Payslip **Jul** + statement **Sep** | **Refused** ("latest payslip for September or August") although the statement is September. Same gap |
| 4.4 | Payslips Jul-Sep + statement for Aug + Sep | Payslip figures for all three; non-panel (July not seen arriving) |

> **Decision pending.** Payslips win; a bank statement only confirms them. The
> proposed change lets a statement fill a month with no payslip (salary grossed
> up) and count towards "latest month". Until then, 4.1-4.3 are expected as
> above. If the change is made, 4.1 gives S$ about 5,000 for July from the
> statement, and 4.3 is accepted.

## 5. Payslip does not match the name

| # | Upload | Expect |
|---|---|---|
| 5.1 | Siti logged in, payslip for **LIM AH BENG** | Refused: "appears to belong to someone else, and we do not accept documents for another person". The other person's name is not printed back |
| 5.2 | Payslip with **no name** (`expect-refused-no-name/`) | Refused: "We could not find your name on ...". A payslip always carries a name |
| 5.3 | Siti's payslips while logged in as another person | Refused with the same "someone else" message |
| 5.4 | Name written differently (order, spacing, upper/lower case) | Accepted when it is clearly the same person |
| 5.5 | Valid payslips + one wrong-name payslip | Whole set is held back and the file is named |

## 6. Bank statement does not match the name

| # | Upload | Expect |
|---|---|---|
| 6.1 | Siti logged in, statement for **LIM AH BENG** (`expect-refused-wrong-name/`) | Refused: belongs to someone else |
| 6.2 | Logged in as Siti, Felicia's statements | Refused |
| 6.3 | A statement with no name | Refused. Unlike a gig-app screen, a statement always has a name |
| 6.4 | Payslips in the applicant's name + a bank statement in another's name | Held back, naming the statement |

## 7. Bank statement amount is different from the payslip

| # | Upload (Siti) | Expect |
|---|---|---|
| 7.1 | Payslips Jul-Sep + statement with Aug pay of S$1,500 (`pay-does-not-match-payslip/`) | Figures still S$3,800 (payslip gross). Set is **non-panel** because Aug's take-home does not appear. Card says the statement did not match and to check it covers the same months |
| 7.2 | A statement with no salary credit at all | Non-panel, payslip figures used |
| 7.3 | Deposit much lower than the payslip, such as S$2,000 against S$5,000 | **Currently not flagged**: scored on the payslip, non-panel. Staff note under consideration |
| 7.4 | Deposit slightly different (within S$1) | Still matches |

## 8. Gig-app earnings (Grab, foodpanda, SwiftDrop, ...)

| # | Upload | Expect |
|---|---|---|
| 8.1 | Screens with **no name** (`expect-accepted-flagged-no-name/`) | Accepted, and flagged. Ascend staff are told the name was not shown |
| 8.2 | Profile + Payments screen with the name (`expect-accepted-name-shown/`) | Accepted, no flag |
| 8.3 | Screen with another person's name | Refused |
| 8.4 | March screen only | Asks for the latest month |
| 8.5 | SwiftDrop Aug with **CPF withheld** | Takes income **before** CPF (S$1,542.50), not the payment after (S$1,351.23) |
| 8.6 | Platform commission, fees and rental taken off | Earnings are after those, before CPF |
| 8.7 | Gig screen + a payslip for the same month | Added together, like a second job |
| 8.8 | Gig screen + bank statement with the payouts | Panel when the payouts add up to the earnings; non-panel when well short |
| 8.9 | Cash collected from customers | Not counted as earnings |

## 9. Handling of files

| # | Do this | Expect |
|---|---|---|
| 9.1 | Add a file, then remove it, then submit | Removed file is not sent and its stored copy is deleted |
| 9.2 | Press Submit twice, or refresh and submit | Ascend receives it **once** |
| 9.3 | Upload six files in total, three used | Only the used files are sent; the page says which were left out |
| 9.4 | Upload something that is not an income document | Named and refused: remove it or upload the right one |
| 9.5 | Blurred, cropped or partly cut-off file | Cannot be read: asks for a clearer copy, applicant can still continue |
| 9.6 | Password-protected PDF | Cannot be read; clear message (not yet tried: note what happens) |
| 9.7 | Very large file or too many files | Refused with a plain message |
| 9.8 | Image and PDF together | Both read |
| 9.9 | Add files and leave | After 7 days the stored copies are deleted. **The daily clean-up is not scheduled yet** |
| 9.10 | After any run | `income_document_events` shows every upload, read, removal and submission |
| 9.11 | A document that was submitted | Stays on file as the record of the decision |

## 10. What the applicant sees

| # | Check | Expect |
|---|---|---|
| 10.1 | Accepted documents listed on the page | Always visible |
| 10.2 | Applicant can always continue | Yes, even with S$0 months, or with nothing read |
| 10.3 | "Want a higher limit?" card | Payslips only: add a bank statement. Statement only: add payslips. Payslips plus a statement that did not match: check months |
| 10.4 | Wording for the gig-app route | The page title still says "payslips" even for earnings statements |
| 10.5 | Error message for another person's document | Never prints the other person's name |
| 10.6 | Mobile width | Page, file list and messages fit without side scrolling |

## 11. Other things worth trying

- Weekly or fortnightly payslips (pay periods split by day into months).
- A payslip showing both the month and year-to-date totals: the month is used.
- A payslip with an expense reimbursement: reimbursement is not income.
- A bonus month: counted as paid, then average over three months.
- Applicant aged over 55 and bank statement only: the lower employee rate
  applies when salary is taken back up (15% at 55-60, 9.5% at 60-65, 7% at
  65-70, 5% above 70).
- Salary above S$8,000 a month on a bank statement: CPF stops at the ceiling.
- A statement that has no salary label but a regular deposit: depends on how
  the deposit is classed; note the result.
- Production safety: the test-bank variable has no effect when the deployment
  is production.
