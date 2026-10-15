# Income rules - for sign-off before production

Every rule below is what the code does today (`stg`, 15 Oct 2026), with the exact
numbers. Each needs a name beside it before launch: the person who owns the rule,
not the person who built it. "Source" says where the rule came from so it can be
checked against what was agreed.

Fill in the last column. A rule nobody will sign for is a rule to change or remove
before launch.

## A. What the upload screen allows

| # | Rule | Exactly what happens | Source | Signed by / date |
|---|---|---|---|---|
| A1 | File types | PDF, JPG or PNG only. | Product | |
| A2 | File size | 10 MB per file. Larger is refused. | Product | |
| A3 | How many | Up to 6 files in total. The same file uploaded twice is kept once. | Product | |
| A4 | The note on screen | "Documents must match your Singpass name." Label: "Upload up to 3 months of documents (latest: Sep or Aug)" - the months follow today's date. | Jeremy's wording, 30 Sep | |
| A5 | No documents | There is no skip and no self-declaration. An applicant with no document cannot pass this step. | Caken, 15 Oct | |

## B. Whose document it is (the name must match)

| # | Rule | Exactly what happens | Source | Signed by / date |
|---|---|---|---|---|
| B1 | The name is read **inside the document**, not from the file name. | The reader copies the holder's name off the page. A file called `john.pdf` with the right name inside passes. | Caken, 12 Oct | |
| B2 | The name must be the applicant's Singpass name. | Names are compared as sets of words, in any order and any case: `TAN CAKEN`, `CAKEN TAN`, `TAN, CAKEN` and `Mr Tan Caken` are all the same person. | Product | |
| B3 | Every word in the printed name must be theirs. | A printed name with an extra word that is not in their Singpass name is refused (`TAN CAKEN JOHN`). Initials are allowed in place of their other names when two names are still written in full: for `TAN WEI LIN FELICIA`, `TAN W L FELICIA` passes. | Product | |
| B4 | At least two words must match, in full. | A surname alone is refused. Someone whose Singpass name is one word needs that one word. | Product | |
| B5 | Titles, connectors and numbers are dropped from **both** names before comparing. | Dropped from the name on the document and from their Singpass name alike: titles (Mr, Mrs, Ms, Miss, Mdm, Madam, Dr) and connectors (bin, binte, bte, binti, s/o, d/o, al). So Singpass `MUHAMMAD BIN ALI` matches `MUHAMMAD BIN ALI`, `MUHAMMAD ALI` and `ALI MUHAMMAD` on a document. Any token containing a digit is dropped from the printed name: an employee number `(1000012)` or a masked NRIC `S****083H`. | Product | |
| B6 | Aliases. | Other names Singpass holds for them (alias, Hanyu Pinyin, married name) are accepted. | Product | |
| B7 | Joint accounts. | If a document names several holders (joined by `&` or `AND`), it passes when any one holder is the applicant. | Product | |
| B8 | One wrong document stops all. | If any document does not carry the applicant's name, nothing is read off any of them. The applicant is told which file to replace. | Product | |
| B9 | Gig-app screenshots with no name. | Allowed (many show none). A screenshot showing a name that is not theirs is refused. An accepted unnamed screenshot is noted on the Ascend order for staff. | Product | |
| B10 | Bank statements must be from a recognised Singapore bank. | DBS, POSB, OCBC, UOB, Standard Chartered, HSBC, Citibank, Maybank, Bank of China, ICBC, CIMB, RHB, Trust Bank, GXS, MariBank, ANEXT. Any other bank, or none named, is refused. | Product | |
| B11 | A payslip or bank statement with no readable name is refused, whatever the file type. | PDF, JPG and PNG are treated the same. The reader reports the name it can read; an empty name on a payslip or bank statement gives "We could not find your name on <file>". Only a platform earnings statement may show no name (B9). The document type is the reader's judgement: a cropped payslip photo the reader calls an earnings statement would pass unnamed. | Product | |

## C. Which months count

| # | Rule | Exactly what happens | Source | Signed by / date |
|---|---|---|---|---|
| C1 | The latest document must be recent. | It must be for this month, last month or the month before (in October: October, September or August). This month counts only once it is complete. Anything older is refused with a message. | Wenting, 30 Sep | |
| C2 | The window is that month and the two before it. | A document outside the window is not used and is not sent to Ascend. The applicant is told which file was left out. | Product | |
| C3 | One month is enough. | The applicant is told. | Wenting, 30 Sep | |
| C4 | A month with no document counts as **S$0**. | Nothing is assumed. Ascend averages three months, so each missing month lowers the average by a third. The applicant sees this before submitting. | Product | |
| C5 | Bank statements: a month counts only if every day is covered. | A statement ending part-way through a month does not count that month. A month that has not yet ended does not count. | Product | |

## D. Payslips and platform statements

| # | Rule | Exactly what happens | Source | Signed by / date |
|---|---|---|---|---|
| D1 | The figure is gross pay, before CPF and deductions. | For a platform (Grab, PHV, foodpanda), the earnings after the platform's costs. | Wenting, 30 Sep | |
| D2 | Monthly payslips only. | Weekly and fortnightly payslips are read and shown but not used. The applicant is asked for the monthly payslip. Half-month payslips (two for one month) are added. | Product | |
| D3 | Two payslips for the same month from different employers. | Both count and are added together. | Caken | |
| D4 | Two payslips for the same period from the same employer. | Refused. We do not pick one. | Product | |
| D5 | A month more than 6 times the smallest of the three. | Held for review, because it is almost always the year-to-date column read as one month. | Product | |
| D6 | A payslip alone. | Sent to Ascend as `NON_PANEL`. | Wenting, 30 Sep | |
| D7 | A payslip plus a bank statement showing the pay arriving. | Sent as `PANEL`. "Arriving" means one credit within S$1 of the payslip's net pay, dated from the start of the pay period to 20 days after its end. | Wenting, 30 Sep | |
| D8 | A platform statement plus a bank statement. | `PANEL` when the platform's payouts to the bank add up to within 10% of the earnings, dated from the period's start to 7 days after its end. Several payouts can add up. | Wenting, 30 Sep | |
| D9 | The applicant is told a bank statement "can increase" the limit. | Never "will". Ascend decides the limit. | Product | |

## E. Bank statements on their own

| # | Rule | Exactly what happens | Source | Signed by / date |
|---|---|---|---|---|
| E1 | **Counted as income:** all money in. | Salary, platform payouts, transfers from other people (including PayNow), cash deposits, CPF LIFE payouts, government payouts, and anything else that is money in. | Wenting, 30 Sep | |
| E2 | **Never counted:** | Interest, refunds and reversals, transfers between the applicant's own accounts, and loans paid out to them. | Product | |
| E3 | **Applicants who said "unemployed with income":** only the CPF payout counts. | Everything else on the statement is ignored for them. "Unemployed without income" and every other type count all money in (E1). | Caken, 13 Oct | |
| E4 | Salary on a bank statement is after CPF, so it is put back up to gross. | For Singapore citizens and PRs only. Employee CPF rate by age: up to 55: 20%; 56-60: 15%; 61-65: 9.5%; 66-70: 7%; over 70: 5%. Stops at a monthly wage ceiling of S$8,000. Only deposits read as salary; PayNow, cash and platform payouts are counted as they arrive. | Wenting, 30 Sep | |
| E5 | A bank statement alone caps the loan amount. | Said by Iris, relayed 13 Oct. Confirm Ascend applies this and we do not need to. | Iris | |

## F. What happens next

| # | Rule | Exactly what happens | Source | Signed by / date |
|---|---|---|---|---|
| F1 | We do not decide credit. | The figures go to Ascend. Ascend returns PASS, PENDING or REJECT, and a limit on PASS. | ADR-0001 | |
| F2 | A PASS with no limit. | We ask Ascend again, up to three more times, 1.5 s, 2.5 s and 3.5 s apart. If there is still no limit, the applicant is shown the pending page. **Open: what Ascend wants us to do here.** | Product | |
| F3 | A reading that cannot be used. | The applicant is told in one plain sentence which file to replace and why. After one retry for a technical stop, they are asked to try again or upload fewer documents. | Product | |
| F4 | Retention. | Every model reading is kept 5 years (finance, 13 Oct). Documents added but never submitted are deleted after 7 days. Submitted documents are kept as the record behind the decision. | Finance | |

## Open, not decided

- **Proof of residence for foreigners.** Wenting said it is needed; deferred (Caken, 15 Oct: "we will wait first"). Until then foreigners go through the same steps as everyone else.
